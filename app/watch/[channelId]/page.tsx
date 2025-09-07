// app/watch/[channelId]/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useSupabase } from "@/components/SupabaseProvider";
import type { Channel, Program } from "@/lib/supabase";
import {
  fetchChannelDetails,
  fetchProgramsForChannel,
  getVideoUrlForProgram,
  toUtcDate, // keep this for rendering the "Next:" time
} from "@/lib/supabase";

const CH21 = 21;

// Your provided standby file (channel1 example)
const STANDBY_URL_SAMPLE =
  "https://msllqpnxwbugvkpnquwx.supabase.co/storage/v1/object/public/channel1/standby_blacktruthtv.mp4";

// Build a per-channel standby URL by swapping the channel number in the path.
// If the pattern isn't found, we just return the sample (channel1) URL.
function standbyUrlForChannel(id: number): string {
  return STANDBY_URL_SAMPLE.replace(/channel\d+\//, `channel${id}/`);
}

export default function WatchPage({ params }: { params: { channelId: string } }) {
  const supabase = useSupabase();
  const search = useSearchParams();

  const srcOverride = search?.get("src") || null;
  const debug = (search?.get("debug") ?? "0") === "1";

  // Strict: channel id must be an integer 1..30
  const channelNum = useMemo(() => {
    const n = Number(params.channelId);
    return Number.isInteger(n) && n >= 1 && n <= 30 ? n : null;
  }, [params.channelId]);

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
        setErr(null);
        setVideoSrc(null);
        setActiveTitle(null);
        setNextTitle(null);
        setNextStart(null);

        if (channelNum == null) throw new Error(`Channel id must be 1–30 (got "${params.channelId}")`);

        // Channels.id
        const ch = await fetchChannelDetails(supabase, channelNum);
        if (!ch) throw new Error(`Channel not found (id=${channelNum})`);
        if (cancelled) return;
        setChannel(ch);

        // CH21 -> YouTube Live (only if configured)
        if (channelNum === CH21 && (ch.youtube_channel_id || "").trim()) {
          const yt = `https://www.youtube.com/embed/live_stream?channel=${ch.youtube_channel_id}&autoplay=1&mute=1`;
          setVideoSrc(srcOverride || yt);
          setActiveTitle(null);
          return;
        }

        // Programs.channel_id
        const list = await fetchProgramsForChannel(supabase, channelNum);

        // Sort by start_time (UNIX seconds) ascending
        list.sort((a, b) => Number(a.start_time) - Number(b.start_time));

        const nowSec = Math.floor(Date.now() / 1000);

        // Find what's on now
        let current: Program | null = null;
        for (const p of list) {
          const st = Number(p.start_time);               // seconds
          const dur = Math.max(60, Number(p.duration) || 0); // seconds (min 60)
          if (!Number.isFinite(st) || !Number.isFinite(dur)) continue;

          const en = st + dur;
          if (nowSec >= st && nowSec < en) { current = p; break; }
        }

        // Next program strictly after now
        const upcoming = list.find((p) => Number(p.start_time) > nowSec) || null;

        setActiveTitle(current?.title ?? "Standby Programming");
        setNextTitle(upcoming?.title ?? null);
        setNextStart(upcoming ? new Date(Number(upcoming.start_time) * 1000).toISOString() : null);

        // Choose source with explicit standby fallback
        let src: string | null = srcOverride;
        if (!src) {
          if (current) {
            src = getVideoUrlForProgram(current); // expects to return a playable mp4 URL or null
          }
          if (!src) {
            src = standbyUrlForChannel(channelNum); // continuous standby for this channel
          }
        }

        if (!src) throw new Error("No playable URL for program/standby");
        if (!cancelled) setVideoSrc(src);
      } catch (e: any) {
        if (!cancelled) setErr(e?.message || "Failed to load channel.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [supabase, params.channelId, channelNum, srcOverride]);

  const isYouTube = channelNum === CH21 && !!(channel?.youtube_channel_id || "").trim();

  // If the current src errors (bad storage path/MIME/CORS), immediately fall back to channel standby.
  function handleVideoError() {
    if (!channelNum) return;
    const standby = standbyUrlForChannel(channelNum);
    if (videoSrc !== standby) {
      setActiveTitle("Standby Programming");
      setVideoSrc(standby);
      setErr(null);
    } else {
      setErr("Video failed to load (check storage URL/permissions/MIME).");
    }
  }

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
            onError={handleVideoError}
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
{JSON.stringify({ channelNum, videoSrc, activeTitle, nextTitle, nextStart }, null, 2)}
        </pre>
      )}
    </div>
  );
}
