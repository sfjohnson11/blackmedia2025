"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  getSupabase,
  toUtcDate,
  addSeconds,
  getVideoUrlForProgram,
  fetchChannelById,
  fetchProgramsForChannel,
  type Program,
  type Channel,
} from "@/lib/supabase";

const CH21 = 21;
const REFRESH_MS = 30_000;
const DRIFT_TOLERANCE_S = 5;

function secs(x: unknown) {
  const n = Number(x ?? 0);
  return Number.isFinite(n) ? Math.max(1, Math.round(n)) : 1;
}

export default function WatchPage({ params }: { params: { channelId: string } }) {
  const supabase = useMemo(() => getSupabase(), []);
  const search = useSearchParams();

  const [channelId, setChannelId] = useState<number | null>(null);
  const [channel, setChannel] = useState<Channel | null>(null);
  const [videoSrc, setVideoSrc] = useState<string | null>(null);
  const [activeTitle, setActiveTitle] = useState<string | null>(null);
  const [nextTitle, setNextTitle] = useState<string | null>(null);
  const [nextStart, setNextStart] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const vidRef = useRef<HTMLVideoElement | null>(null);

  // numeric-only id
  useEffect(() => {
    const s = String(params.channelId || "").trim();
    if (!/^\d+$/.test(s)) {
      setErr(`Channel id must be numeric (got "${s}")`);
      setChannelId(null);
      return;
    }
    const n = Number(s.replace(/^0+/, "") || "0");
    setChannelId(Number.isFinite(n) ? n : null);
  }, [params.channelId]);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | null = null;

    async function headOK(url?: string | null) {
      if (!url) return false;
      try {
        const r = await fetch(url, { method: "HEAD" });
        return r.ok;
      } catch {
        return false;
      }
    }

    function pickCurrentAndNext(list: Program[], now: Date) {
      // Ensure ascending by start_time
      const sorted = [...list].sort((a, b) => {
        const ta = toUtcDate(a.start_time)?.getTime() ?? 0;
        const tb = toUtcDate(b.start_time)?.getTime() ?? 0;
        return ta - tb;
      });

      let current: Program | null = null;
      let next: Program | null = null;

      for (let i = 0; i < sorted.length; i++) {
        const p = sorted[i];
        const st = toUtcDate(p.start_time);
        if (!st) continue;
        const startTol = addSeconds(st, -DRIFT_TOLERANCE_S);
        const endTol = addSeconds(addSeconds(st, secs(p.duration)), DRIFT_TOLERANCE_S);
        if (now >= startTol && now < endTol) {
          current = p;
          next = sorted[i + 1] ?? null;
          break;
        }
        if (!current && st > now) {
          next = p;
          // don't break; we still want to see if any later one actually overlaps due to tolerance
          break;
        }
      }

      // Fallback: last before now (keeps us off standby if the show is still realistically on)
      if (!current && sorted.length > 0) {
        const before = sorted.filter((p) => {
          const d = toUtcDate(p.start_time);
          return d ? d <= now : false;
        });
        if (before.length) current = before[before.length - 1];
      }

      return { current, next };
    }

    async function pickAndPlay() {
      if (channelId == null) return;

      try {
        setErr(null);

        // 1) channel
        const ch = await fetchChannelById(supabase, channelId);
        if (!ch) throw new Error(`Channel not found (id=${channelId})`);
        if (cancelled) return;
        setChannel(ch);

        // 2) CH21 → YouTube iframe if youtube_channel_id present
        const ytId = (ch.youtube_channel_id || "").trim();
        if (channelId === CH21 && ytId) {
          const url = `https://www.youtube.com/embed/live_stream?channel=${encodeURIComponent(
            ytId
          )}&autoplay=0&mute=0&playsinline=1`;
          setVideoSrc(url);
          setActiveTitle("YouTube Live");
          setNextTitle(null);
          setNextStart(null);
          console.log("[WATCH] CH21 YouTube:", url);
          return;
        }

        // 3) programs (we fetch whole channel; JS does overlap)
        const list = await fetchProgramsForChannel(supabase, channelId);
        const now = new Date();
        const { current, next } = pickCurrentAndNext(list, now);

        setActiveTitle(current?.title ?? "Standby Programming");
        setNextTitle(next?.title ?? null);
        setNextStart(next?.start_time ?? null);

        // 4) build source: override → current → standby
        const override = search?.get("src") || null;
        const standby = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/channel${channelId}/standby_blacktruthtv.mp4?t=${Date.now()}`;
        const candidate = override || (current ? getVideoUrlForProgram(current) : null) || standby;

        // 5) verify & log
        const candidateOK = await headOK(candidate);
        const standbyOK = await headOK(standby);
        console.table({
          channelId,
          now: now.toISOString(),
          chosenTitle: current?.title ?? "(standby)",
          candidate,
          candidateOK,
          standby,
          standbyOK,
        });

        const finalSrc = candidateOK ? (candidate as string) : standbyOK ? standby : standby;
        if (!cancelled) setVideoSrc(finalSrc);
      } catch (e: any) {
        if (!cancelled) setErr(e?.message || "Failed to load channel.");
      }
    }

    pickAndPlay();
    timer = setInterval(pickAndPlay, REFRESH_MS);

    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
    };
  }, [supabase, channelId, search]);

  const isYouTube = channelId === CH21 && !!(channel?.youtube_channel_id || "").trim();

  // Unmute after play starts (helps with autoplay policies)
  useEffect(() => {
    if (!vidRef.current) return;
    const v = vidRef.current;
    function onPlaying() {
      try {
        if (v.muted) {
          v.muted = false;
          v.volume = 1.0;
        }
      } catch {}
    }
    v.addEventListener("playing", onPlaying);
    return () => v.removeEventListener("playing", onPlaying);
  }, [videoSrc]);

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
            key={videoSrc} // force reload on src change
            ref={vidRef}
            className="w-full h-full"
            src={videoSrc}
            crossOrigin="anonymous"
            // poster={channel?.logo_url || undefined}  // optional
            autoPlay
            muted={true}           // start muted to satisfy autoplay, unmute on "playing"
            playsInline
            controls
            preload="auto"
            loop={activeTitle === "Standby Programming"}
            onError={(e) => {
              console.warn("[WATCH] video error, falling back to standby", e);
              if (channelId != null) {
                const s = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/channel${channelId}/standby_blacktruthtv.mp4?t=${Date.now()}`;
                if (s !== videoSrc) setVideoSrc(s);
              }
            }}
          />
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
                  timeZoneName: "short",
                })}`
              : ""}
          </div>
        )}
      </div>
    </div>
  );
}
