// app/watch/[channelId]/page.tsx
"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { useSupabase } from "@/components/SupabaseProvider";
import type { Program, Channel } from "@/lib/supabase";
import { toUtcDate, addSeconds, parseDurationSec, getVideoUrlForProgram, fetchChannelDetails, STANDBY_PLACEHOLDER_ID } from "@/lib/supabase";

const CH21 = 21;
const STANDBY_FILE = "standby_blacktruthtv.mp4";

export default function WatchPage({ params }: { params: { channelId: string } }) {
  const supabase = useSupabase();
  const search = useSearchParams();
  const debug = (search?.get("debug") ?? "0") === "1";
  const srcOverride = search?.get("src") || null;
  const rawParam = String(params.channelId || "");
  const norm = useMemo(() => rawParam.trim(), [rawParam]);

  const [resolvedId, setResolvedId] = useState<number | null>(null);
  const [channel, setChannel] = useState<Channel | null>(null);
  const [active, setActive] = useState<Program | null>(null);
  const [nextUp, setNextUp] = useState<Program | null>(null);
  const [videoSrc, setVideoSrc] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const resolveNumericId = useCallback(async (): Promise<number> => {
    if (/^\d+$/.test(norm)) return Number(norm.replace(/^0+/, "") || "0");
    const slug = norm.replace(/-/g, "_");
    const { data } = await supabase.from("channels").select("id, slug").eq("slug", slug).maybeSingle();
    if (data?.id != null && Number.isFinite(Number(data.id))) return Number(data.id);
    throw new Error(`Channel not found for "${norm}"`);
  }, [norm, supabase]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setErr(null); setVideoSrc(null); setActive(null); setNextUp(null);

        const id = await resolveNumericId();
        if (cancelled) return;
        setResolvedId(id);

        const ch = await fetchChannelDetails(supabase, id);
        if (!ch) throw new Error(`Channel not found (id=${id})`);
        if (cancelled) return;
        setChannel(ch);

        // YouTube special case
        const yt = (ch.youtube_channel_id || "").trim();
        if (id === CH21 && yt) {
          setVideoSrc(`https://www.youtube.com/embed/live_stream?channel=${yt}&autoplay=1&mute=1`);
          setActive(null); setNextUp(null);
          return;
        }

        // Programs strictly by numeric channel_id
        const { data: rows, error } = await supabase
          .from("programs")
          .select("id, channel_id, title, mp4_url, start_time, duration")
          .eq("channel_id", id)
          .order("start_time", { ascending: true });
        if (error) throw error;

        const now = new Date();
        const list = (rows || []) as Program[];

        const current = (() => {
          for (const p of list) {
            const st = toUtcDate(p.start_time);
            if (!st) continue;
            const dur = Math.max(60, parseDurationSec(p.duration));
            const en = addSeconds(st, dur);
            if (now >= st && now < en) return p;
          }
          return null;
        })();

        const upcoming = list.find(p => {
          const st = toUtcDate(p.start_time);
          return !!st && st > now;
        }) || null;
        setNextUp(upcoming);

        const chosen = current ?? {
          id: STANDBY_PLACEHOLDER_ID,
          channel_id: id,
          title: "Standby Programming",
          mp4_url: STANDBY_FILE,
          start_time: now.toISOString(),
          duration: 3600,
        };

        const resolvedSrc = srcOverride || getVideoUrlForProgram(supabase, chosen);
        if (!resolvedSrc) throw new Error("No playable URL found for program/standby");

        setActive(current ? current : (chosen as Program));
        setVideoSrc(resolvedSrc);
      } catch (e: any) {
        if (!cancelled) setErr(e?.message || "Failed to load channel.");
      }
    })();
    return () => { cancelled = true; };
  }, [resolveNumericId, supabase, srcOverride]);

  const isYouTube = resolvedId === CH21 && !!(channel?.youtube_channel_id || "").trim();

  return (
    <div className="bg-black min-h-screen text-white">
      <div className="w-full aspect-video bg-black grid place-items-center">
        {err ? (
          <p className="text-red-400 text-sm px-4 text-center">Error: {err}</p>
        ) : isYouTube && videoSrc ? (
          <iframe
            title="YouTube Live"
            className="w-full h-full"
            allow="autoplay; encrypted-media; picture-in-picture"
            src={videoSrc}
          />
        ) : videoSrc ? (
          <video
            className="w-full h-full"
            src={videoSrc}
            poster={channel?.logo_url || undefined}
            autoPlay
            muted
            playsInline
            controls
            onError={() => setErr("Video failed to load (check storage URL/permissions/MIME).")}
          >
            <source src={videoSrc} type="video/mp4" />
          </video>
        ) : (
          <div className="text-white/70 text-sm">Loading…</div>
        )}
      </div>

      <div className="p-4 space-y-1 text-sm">
        {active && <div className="font-semibold">{active.title || "Now Playing"}</div>}
        {nextUp && (
          <div className="text-white/60">
            Next: {nextUp.title || "Upcoming"} —{" "}
            {toUtcDate(nextUp.start_time)?.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </div>
        )}
      </div>

      {debug && (
        <pre className="m-4 p-3 text-[11px] bg-zinc-900/70 border border-zinc-800 rounded overflow-auto">
{JSON.stringify({ rawParam, resolvedId, videoSrc }, null, 2)}
        </pre>
      )}
    </div>
  );
}
