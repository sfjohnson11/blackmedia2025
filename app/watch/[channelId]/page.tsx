// app/watch/[channelId]/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useSupabase } from "@/components/SupabaseProvider";
import type { Channel, Program } from "@/lib/supabase";
import {
  fetchChannelDetails,
  fetchProgramsForChannel,
  toUtcDate,
  addSeconds,
  parseDurationSec,
  getVideoUrlForProgram,
} from "@/lib/supabase";

const CH21 = 21;
const STANDBY_FILE = "standby_blacktruthtv.mp4";

export default function WatchPage({ params }: { params: { channelId: string } }) {
  const supabase = useSupabase();
  const search = useSearchParams();

  const srcOverride = search?.get("src") || null;
  const debug = (search?.get("debug") ?? "0") === "1";

  const rawParam = String(params.channelId || "");
  const channelNum = useMemo(() => {
    if (!/^\d+$/.test(rawParam)) return null;
    const n = Number(rawParam.replace(/^0+/, "") || "0");
    return Number.isFinite(n) ? n : null;
  }, [rawParam]);

  const [channel, setChannel] = useState<Channel | null>(null);
  const [videoSrc, setVideoSrc] = useState<string | null>(null);
  const [activeTitle, setActiveTitle] = useState<string | null>(null);
  const [nextTitle, setNextTitle] = useState<string | null>(null);
  const [nextStart, setNextStart] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setErr(null); setVideoSrc(null); setActiveTitle(null); setNextTitle(null); setNextStart(null);

        if (channelNum == null) throw new Error(`Channel id must be numeric (got "${rawParam}")`);

        // Channels.id
        const ch = await fetchChannelDetails(supabase, channelNum);
        if (!ch) throw new Error(`Channel not found (id=${channelNum})`);
        if (cancelled) return;
        setChannel(ch);

        // CH21 -> YouTube Live
        if (channelNum === CH21 && (ch.youtube_channel_id || "").trim()) {
          setVideoSrc(`https://www.youtube.com/embed/live_stream?channel=${ch.youtube_channel_id}&autoplay=1&mute=1`);
          setActiveTitle(null);
          return;
        }

        // Programs.channel_id
        const list = await fetchProgramsForChannel(supabase, channelNum);
        const now = new Date();

        let current: Program | null = null;
        for (const p of list) {
          const st = toUtcDate(p.start_time);
          if (!st) continue;
          const dur = Math.max(60, parseDurationSec(p.duration));
          const en = addSeconds(st, dur);
          if (now >= st && now < en) { current = p; break; }
        }

        const upcoming = list.find((p) => {
          const st = toUtcDate(p.start_time);
          return !!st && st > now;
        }) || null;

        setActiveTitle(current?.title ?? "Standby Programming");
        setNextTitle(upcoming?.title ?? null);
        setNextStart(upcoming?.start_time ?? null);

        const chosen: Program = current ?? {
          channel_id: channelNum,
          title: "Standby Programming",
          mp4_url: STANDBY_FILE,
          start_time: now.toISOString(),
          duration: 3600,
        };

        const src = srcOverride || getVideoUrlForProgram(chosen);
        if (!src) throw new Error("No playable URL for program/standby");
        setVideoSrc(src);
      } catch (e: any) {
        if (!cancelled) setErr(e?.message || "Failed to load channel.");
      }
    })();
    return () => { cancelled = true; };
  }, [supabase, rawParam, channelNum, srcOverride]);

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
        {activeTitle && <div className="font-semibold">{activeTitle}</div>}
        {nextTitle && (
          <div className="text-white/60">
            Next: {nextTitle} —{" "}
            {toUtcDate(nextStart || "")?.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </div>
        )}
      </div>

      {debug && (
        <pre className="m-4 p-3 text-[11px] bg-zinc-900/70 border border-zinc-800 rounded overflow-auto">
{JSON.stringify({ rawParam, channelNum, videoSrc }, null, 2)}
        </pre>
      )}
    </div>
  );
}
