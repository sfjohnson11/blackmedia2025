// app/watch/[channelId]/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  getSupabase,
  toUtcDate,
  addSeconds,
  parseDurationSec,
  getVideoUrlForProgram,
  fetchChannelById,
  fetchProgramsForChannel,
  type Program,
  type Channel,
} from "@/lib/supabase";
import { getStandbyUrlForChannel } from "@/lib/standby";

const CH21 = 21;

export default function WatchPage({ params }: { params: { channelId: string } }) {
  const supabase = useMemo(() => getSupabase(), []);
  const search = useSearchParams();

  const rawParam = String(params.channelId || "");
  const srcOverride = search?.get("src") || null;

  const [channelId, setChannelId] = useState<number | null>(null);
  const [channel, setChannel] = useState<Channel | null>(null);
  const [videoSrc, setVideoSrc] = useState<string | null>(null);
  const [activeTitle, setActiveTitle] = useState<string | null>(null);
  const [nextTitle, setNextTitle] = useState<string | null>(null);
  const [nextStart, setNextStart] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  // Normalize URL param to numeric channel id (you said you only use numeric ids for channels)
  useEffect(() => {
    const s = rawParam.trim();
    if (!/^\d+$/.test(s)) {
      setErr(`Channel id must be numeric (got "${s}")`);
      setChannelId(null);
      return;
    }
    const n = Number(s.replace(/^0+/, "") || "0");
    setChannelId(Number.isFinite(n) ? n : null);
  }, [rawParam]);

  // Load channel + decide what to play
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (channelId == null) return;
      try {
        setErr(null);
        setVideoSrc(null);
        setActiveTitle(null);
        setNextTitle(null);
        setNextStart(null);

        // channel row
        const ch = await fetchChannelById(supabase, channelId);
        if (!ch) throw new Error(`Channel not found (id=${channelId})`);
        if (cancelled) return;
        setChannel(ch);

        // CH21 → YouTube
        const ytId = (ch.youtube_channel_id || "").trim();
        if (channelId === CH21 && ytId) {
          const url = `https://www.youtube.com/embed/live_stream?channel=${encodeURIComponent(
            ytId
          )}&autoplay=1&mute=1`;
          setVideoSrc(url);
          setActiveTitle("YouTube Live");
          return;
        }

        // Pull programs for this channel
        const list = await fetchProgramsForChannel(supabase, channelId);
        const now = new Date();

        // pick "current" by UTC window
        let current: Program | null = null;
        for (const p of list) {
          const st = toUtcDate(p.start_time);
          if (!st) continue;
          const dur = Math.max(60, parseDurationSec(p.duration));
          const en = addSeconds(st, dur);
          if (now >= st && now < en) { current = p; break; }
        }

        const upcoming =
          list.find((p) => {
            const st = toUtcDate(p.start_time);
            return !!st && st > now;
          }) || null;

        setActiveTitle(current?.title ?? "Standby Programming");
        setNextTitle(upcoming?.title ?? null);
        setNextStart(upcoming?.start_time ?? null);

        // Build final source: ?src override → current program URL → per-channel standby
        const standbySrc = getStandbyUrlForChannel(channelId);
        const src =
          srcOverride ||
          (current ? getVideoUrlForProgram(current) : null) ||
          standbySrc;

        if (!src) throw new Error("No playable URL for program/standby");
        setVideoSrc(src);
      } catch (e: any) {
        if (!cancelled) setErr(e?.message || "Failed to load channel.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [supabase, channelId, srcOverride]);

  const isYouTube = channelId === CH21 && !!(channel?.youtube_channel_id || "").trim();

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
            onError={() => {
              if (channelId != null) {
                const s = getStandbyUrlForChannel(channelId);
                if (s !== videoSrc) setVideoSrc(s);
              }
            }}
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
            Next: {nextTitle}{" "}
            {nextStart
              ? `— ${toUtcDate(nextStart)?.toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}`
              : ""}
          </div>
        )}
      </div>
    </div>
  );
}
