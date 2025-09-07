// app/watch/[channelId]/page.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  getSupabase,
  toUtcDate,
  addSeconds,
  parseDurationSec,
  getCandidateUrlsForProgram,
  getVideoUrlForProgram,
  fetchChannelById,
  fetchProgramsForChannel,
  type Program,
  type Channel,
} from "@/lib/supabase";

const CH21 = 21;

function standbyUrlForChannel(channelId: number) {
  const root = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/+$/, "");
  return `${root}/storage/v1/object/public/channel${channelId}/standby_blacktruthtv.mp4`;
}

export default function WatchPage({ params }: { params: { channelId: string } }) {
  const supabase = useMemo(() => getSupabase(), []);
  const search = useSearchParams();

  const rawParam = String(params.channelId || "");
  const srcOverride = search?.get("src") || null;
  const debug = search?.get("debug") === "1";

  const [channelId, setChannelId] = useState<number | null>(null);
  const [channel, setChannel] = useState<Channel | null>(null);
  const [activeTitle, setActiveTitle] = useState<string | null>(null);
  const [nextTitle, setNextTitle] = useState<string | null>(null);
  const [nextStart, setNextStart] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [dbg, setDbg] = useState<any>(null);

  const [videoCandidates, setVideoCandidates] = useState<string[]>([]);
  const pollRef = useRef<NodeJS.Timeout | null>(null);

  // Normalize channel id to number
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

  useEffect(() => {
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  async function loadChannel(chId: number) {
    setErr(null);
    setActiveTitle(null);
    setNextTitle(null);
    setNextStart(null);
    setDbg(null);
    setVideoCandidates([]);

    // 1) Channel row
    const ch = await fetchChannelById(supabase, chId);
    if (!ch) throw new Error(`Channel not found (id=${chId})`);
    setChannel(ch);

    // 2) CH21 YouTube live (unless ?src override)
    const ytId = (ch.youtube_channel_id || "").trim();
    if (chId === CH21 && ytId && !srcOverride) {
      const url = `https://www.youtube.com/embed/live_stream?channel=${encodeURIComponent(
        ytId
      )}&autoplay=1&mute=1`;
      setActiveTitle("YouTube Live");
      setVideoCandidates([url]); // iframe path is handled in render
      setDbg({ mode: "youtube", url });
      return;
    }

    // 3) Pull schedule and find current+next by strict UTC
    const list = await fetchProgramsForChannel(supabase, chId);
    const now = new Date();

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

    // 4) Build candidates: override → program (multi) → standby
    const standby = standbyUrlForChannel(chId);
    let candidates: string[] = [];
    if (srcOverride) {
      candidates = [srcOverride];
    } else if (current) {
      const fromProgram = getCandidateUrlsForProgram(current);
      candidates = fromProgram.length ? fromProgram : [standby];
    } else {
      candidates = [standby];
    }

    setVideoCandidates(candidates);
    setDbg({
      now: now.toISOString(),
      mode: current ? "program" : "standby",
      current: current ? {
        title: current.title,
        start_time: current.start_time,
        parsed_start: toUtcDate(current.start_time)?.toISOString(),
        duration_raw: current.duration,
        duration_sec: parseDurationSec(current.duration),
        first_resolved_url: getVideoUrlForProgram(current),
        all_candidates: getCandidateUrlsForProgram(current),
      } : null,
      upcoming: upcoming ? {
        title: upcoming.title,
        start_time: upcoming.start_time,
      } : null,
      chosen_list: candidates,
      standby,
    });

    // 5) If on standby, poll every 30s for when a program window opens
    if (!current) {
      if (pollRef.current) clearInterval(pollRef.current);
      pollRef.current = setInterval(async () => {
        try {
          const fresh = await fetchProgramsForChannel(supabase, chId);
          const n = new Date();
          const nowProgram = fresh.find((p) => {
            const st = toUtcDate(p.start_time);
            if (!st) return false;
            const dur = Math.max(60, parseDurationSec(p.duration));
            const en = addSeconds(st, dur);
            return n >= st && n < en;
          });
          if (nowProgram) {
            if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
            await loadChannel(chId);
          }
        } catch { /* ignore */ }
      }, 30000);
    }
  }

  useEffect(() => {
    if (channelId == null) return;
    loadChannel(channelId).catch((e: any) => setErr(e?.message || "Failed to load channel."));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channelId, srcOverride]);

  const isYouTube = channelId === CH21 && !!(channel?.youtube_channel_id || "").trim();
  const firstSrc = videoCandidates[0] || null;

  return (
    <div className="bg-black min-h-screen text-white">
      {debug && dbg && (
        <pre className="text-[10px] leading-tight p-2 bg-black/60 text-green-300 overflow-x-auto">
{JSON.stringify(dbg, null, 2)}
        </pre>
      )}

      <div className="w-full aspect-video bg-black grid place-items-center">
        {err ? (
          <p className="text-red-400 text-sm px-4 text-center">Error: {err}</p>
        ) : isYouTube && firstSrc ? (
          <iframe
            title="YouTube Live"
            className="w-full h-full"
            allow="autoplay; encrypted-media; picture-in-picture"
            src={firstSrc}
          />
        ) : firstSrc ? (
          <video
            key={firstSrc} // reset when source list changes
            className="w-full h-full"
            poster={channel?.logo_url || undefined}
            autoPlay
            muted={true}       // ensures autoplay; user can unmute
            playsInline
            controls
            loop={/\/standby_/i.test(firstSrc) || /standby_blacktruthtv\.mp4$/i.test(firstSrc)}
            onError={() => {
              // If the first candidate failed, fall back to channel standby immediately
              if (channelId != null) {
                const s = standbyUrlForChannel(channelId);
                if (firstSrc !== s) {
                  setVideoCandidates([s]);
                }
              }
            }}
          >
            {/* Try every candidate; browser will pick the first that actually loads */}
            {videoCandidates.map((u) => (
              <source key={u} src={u} type="video/mp4" />
            ))}
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
