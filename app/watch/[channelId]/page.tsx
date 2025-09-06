"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useSupabase } from "@/components/SupabaseProvider";

type Program = {
  id: string | number;
  channel_id: number | string;
  title?: string | null;
  mp4_url?: string | null;
  duration?: number | string | null;
  start_time?: string | null;
};

type Channel = {
  id: number | string;
  name?: string | null;
  slug?: string | null;
  logo_url?: string | null;
  youtube_channel_id?: string | null;
};

const STANDBY_FILE = "standby_blacktruthtv.mp4";
const CH21 = 21;

function toUtcDate(s?: string | null): Date | null {
  if (!s) return null;
  try {
    return new Date(s.endsWith("Z") ? s : s + "Z");
  } catch {
    return null;
  }
}
const addSeconds = (d: Date, sec: number) => new Date(d.getTime() + sec * 1000);
const parseDuration = (v: any) => {
  const n = Number(String(v).trim());
  return Number.isFinite(n) ? Math.max(0, Math.round(n)) : 0;
};

export default function WatchPage({ params }: { params: { channelId: string } }) {
  const supabase = useSupabase();
  const { channelId } = params;

  const [channel, setChannel] = useState<Channel | null>(null);
  const [active, setActive] = useState<Program | null>(null);
  const [videoSrc, setVideoSrc] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);

  const loadChannel = useCallback(async () => {
    setErr(null);

    // 1) Resolve channel
    let resolvedId: number | null = null;
    if (/^\d+$/.test(channelId)) {
      resolvedId = Number(channelId);
    } else {
      const { data } = await supabase
        .from("channels")
        .select("*")
        .eq("slug", channelId.replace(/-/g, "_"))
        .maybeSingle();
      if (data?.id) resolvedId = Number(data.id);
    }
    if (!resolvedId) {
      setErr("Channel not found.");
      return;
    }

    // fetch channel row
    const { data: ch } = await supabase
      .from("channels")
      .select("*")
      .eq("id", resolvedId)
      .maybeSingle();
    if (!ch) {
      setErr("Channel not found.");
      return;
    }
    setChannel(ch);

    // 2) Special case: Channel 21 → YouTube live
    if (resolvedId === CH21 && ch.youtube_channel_id) {
      setActive(null);
      setVideoSrc(null);
      return;
    }

    // 3) Fetch programs for this channel
    const { data: progs } = await supabase
      .from("programs")
      .select("*")
      .eq("channel_id", resolvedId)
      .order("start_time", { ascending: true });

    const now = new Date();
    let current: Program | null = null;

    (progs || []).forEach((p: any) => {
      const st = toUtcDate(p.start_time);
      const dur = parseDuration(p.duration);
      if (!st || dur <= 0) return;
      const en = addSeconds(st, dur);
      if (now >= st && now < en) current = p;
    });

    if (current) {
      setActive(current);
      setVideoSrc(resolveVideoUrl(current));
    } else {
      // standby
      const standby: Program = {
        id: "standby",
        channel_id: resolvedId,
        title: "Standby Programming",
        mp4_url: STANDBY_FILE,
        start_time: now.toISOString(),
        duration: 300,
      };
      setActive(standby);
      setVideoSrc(resolveVideoUrl(standby));
    }
  }, [channelId, supabase]);

  useEffect(() => {
    void loadChannel();
  }, [loadChannel]);

  // Build a full storage URL for mp4
  const resolveVideoUrl = (p: Program): string | null => {
    const raw = (p?.mp4_url || "").trim();
    if (!raw) return null;
    if (/^https?:\/\//i.test(raw)) return raw;

    const bucket =
      typeof p.channel_id === "number" || /^\d+$/.test(String(p.channel_id))
        ? `channel${p.channel_id}`
        : `channel${String(p.channel_id)}`;
    return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${bucket}/${raw}`;
  };

  return (
    <div className="bg-black min-h-screen text-white">
      <div className="w-full aspect-video bg-black flex items-center justify-center">
        {err ? (
          <p className="text-red-400">{err}</p>
        ) : channel?.id === CH21 && channel.youtube_channel_id ? (
          <iframe
            src={`https://www.youtube.com/embed/live_stream?channel=${channel.youtube_channel_id}&autoplay=1&mute=1`}
            title="YouTube Live"
            allow="autoplay; encrypted-media"
            className="w-full h-full"
          />
        ) : videoSrc ? (
          <video
            ref={videoRef}
            src={videoSrc}
            poster={channel?.logo_url || undefined}
            autoPlay
            muted
            playsInline
            controls
            className="w-full h-full"
            onError={() => setErr("Video failed to load")}
          >
            <source src={videoSrc} type="video/mp4" />
          </video>
        ) : (
          <p>Loading…</p>
        )}
      </div>

      <div className="p-4">
        {active && (
          <>
            <h2 className="text-xl font-bold">{active.title}</h2>
            {active.id === "standby" && (
              <p className="text-sm text-yellow-400">Currently on standby</p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
