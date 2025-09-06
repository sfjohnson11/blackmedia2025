// app/watch/[channelId]/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
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

  const [channel, setChannel] = useState<Channel | null>(null);
  const [channelNum, setChannelNum] = useState<number | null>(null);
  const [active, setActive] = useState<Program | null>(null);
  const [nextUp, setNextUp] = useState<Program | null>(null);
  const [videoSrc, setVideoSrc] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setErr(null); setVideoSrc(null); setActive(null); setNextUp(null);

        // channels.id is TEXT (e.g., "1"), slug OK too
        const ch = await fetchChannelDetails(supabase, norm);
        if (!ch) throw new Error(`Channel not found (id=${norm})`);
        if (cancelled) return;
        setChannel(ch);

        // convert to numeric if it's "1","2",… (for programs.channel_id)
        const num = /^\d+$/.test(ch.id) ? Number(ch.id) : null;
        setChannelNum(num);

        // YouTube live special case
        if (num === CH21 && (ch.youtube_channel_id || "").trim()) {
          setVideoSrc(`https://www.youtube.com/embed/live_stream?channel=${ch.youtube_channel_id}&autoplay=1&mute=1`);
          setActive(null); setNextUp(null);
          return;
        }

        // Fetch programs by numeric channel_id (1..30)
        if (!num) throw new Error(`Channel has non-numeric id for programs: ${ch.id}`);

        const { data: rows, error } = await supabase
          .from("programs")
          .select("channel_id, title, mp4_url, start_time, duration")
          .eq("channel_id", num)
          .order("start_time", { ascending: true });

        if (error) throw error;

        const now = new Date();
        const list = (rows || []) as Program[];

        // Pick current
        let current: Program | null = null;
        for (const p of list) {
          const st = toUtcDate(p.start_time);
          if (!st) continue;
          const dur = Math.max(60, parseDurationSec(p.duration));
          const en = addSeconds(st, dur);
          if (now >= st && now < en) { current = p; break; }
        }

        // Next
        const upcoming = list.find(p => {
          const st = toUtcDate(p.start_time);
          return !!st && st > now;
        }) || null;
        setNextUp(upcoming || null);

        // Choose source (program or standby)
        const chosen: Program = current ?? {
          channel_id: num,
          title: "Standby Programming",
          mp4_url: STANDBY_FILE,
          start_time: now.toISOString(),
          duration: 3600,
        };
        const resolvedSrc = srcOverride || getVideoUrlForProgram(chosen);
        if (!resolvedSrc) throw new Error("No playable URL for program/standby");

        setActive(current ?? chosen);
        setVideoSrc(resolvedSrc);
      } catch (e: any) {
        if (!cancelled) setErr(e?.message || "Failed to load channel.");
      }
    })();
    return () => { cancelled = true; };
  }, [norm, supabase, srcOverride]);

  const isYouTube = channelNum === CH21 && !!(channel?.youtube_channel_id || "").trim();

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
{JSON.stringify({ rawParam, resolvedAs: channel?.id, channelNum, videoSrc }, null, 2)}
        </pre>
      )}
    </div>
  );
}
