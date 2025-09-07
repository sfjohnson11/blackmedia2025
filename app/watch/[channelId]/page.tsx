// app/watch/[channelId]/page.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import VideoPlayer from "@/components/video-player";
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
const POLL_MS = 60_000;        // slower poll to avoid thrash
const DRIFT_S = 3;             // small tolerance only at start
const MIN_ADV_MS = 800;        // min timer gap for auto-advance

function secs(v: unknown) {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? Math.max(1, Math.round(n)) : 1;
}
function programKey(p?: Program | null) {
  if (!p) return "";
  return `${p.channel_id}|${p.start_time}|${secs(p.duration)}|${p.mp4_url ?? ""}`;
}
function withBuster(url: string) {
  const sep = url.includes("?") ? "&" : "?";
  return `${url}${sep}t=${Date.now()}`;
}
function uniqueQueue(items: Program[], take = 4) {
  const seen = new Set<string>();
  const out: Program[] = [];
  for (const p of items) {
    const k = `${p.channel_id}|${p.start_time}|${p.title ?? ""}`;
    if (!seen.has(k)) {
      seen.add(k);
      out.push(p);
      if (out.length >= take) break;
    }
  }
  return out;
}

export default function WatchPage({ params }: { params: { channelId: string } }) {
  const supabase = useMemo(() => getSupabase(), []);
  const search = useSearchParams();

  const [channelId, setChannelId] = useState<number | null>(null);
  const [channel, setChannel] = useState<Channel | null>(null);
  const [videoSrc, setVideoSrc] = useState<string | null>(null);
  const [activeTitle, setActiveTitle] = useState<string | null>(null);
  const [queue, setQueue] = useState<Program[]>([]);
  const [err, setErr] = useState<string | null>(null);

  const currentKeyRef = useRef<string>("");   // last program we loaded
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  // numeric channel id only
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

  // clear timers
  useEffect(() => {
    return () => {
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
      if (pollTimer.current) clearInterval(pollTimer.current);
    };
  }, []);

  function pickNowAndUpcoming(all: Program[], now: Date) {
    const list = [...all].sort((a, b) => {
      const ta = toUtcDate(a.start_time)?.getTime() ?? 0;
      const tb = toUtcDate(b.start_time)?.getTime() ?? 0;
      return ta - tb;
    });

    let current: Program | null = null;
    let idxCurrent = -1;

    for (let i = 0; i < list.length; i++) {
      const p = list[i];
      const st = toUtcDate(p.start_time);
      if (!st) continue;
      const startTol = addSeconds(st, -DRIFT_S);
      const end = addSeconds(st, secs(p.duration));
      // Tight end: once now >= end, it's over
      if (now >= startTol && now < end) {
        current = p;
        idxCurrent = i;
        break;
      }
      if (!current && st > now) {
        // between shows: treat previous as current (if any), so we always show something
        idxCurrent = Math.max(0, i - 1);
        current = list[idxCurrent] ?? null;
        break;
      }
    }
    if (!current && list.length) {
      // last before now
      const before = list.filter((p) => {
        const d = toUtcDate(p.start_time);
        return d ? d <= now : false;
      });
      if (before.length) {
        current = before[before.length - 1];
        idxCurrent = list.indexOf(current);
      }
    }

    // queue = current + next few (deduped)
    const q: Program[] = [];
    if (current) q.push(current);
    for (let i = Math.max(0, idxCurrent) + 1; i < list.length; i++) q.push(list[i]);
    return uniqueQueue(q, 4);
  }

  async function headOK(url?: string | null) {
    if (!url) return false;
    try {
      const r = await fetch(url, { method: "HEAD" });
      return r.ok;
    } catch {
      return false;
    }
  }

  function scheduleAutoAdvance(cur?: Program | null) {
    if (refreshTimer.current) clearTimeout(refreshTimer.current);
    if (!cur) return;
    const st = toUtcDate(cur.start_time);
    if (!st) return;
    const end = addSeconds(st, secs(cur.duration));
    const ms = Math.max(MIN_ADV_MS, end.getTime() - Date.now() + 300); // small cushion
    refreshTimer.current = setTimeout(() => {
      pickAndPlay(); // re-evaluate right after expected end
    }, ms);
  }

  async function pickAndPlay() {
    if (channelId == null) return;
    try {
      setErr(null);

      // 1) Channel
      const ch = await fetchChannelById(supabase, channelId);
      if (!ch) throw new Error(`Channel not found (id=${channelId})`);
      setChannel(ch);

      // 2) CH21 YouTube (no flicker)
      const ytId = (ch.youtube_channel_id || "").trim();
      if (channelId === CH21 && ytId) {
        const url = `https://www.youtube.com/embed/live_stream?channel=${encodeURIComponent(
          ytId
        )}&autoplay=0&mute=0&playsinline=1`;
        setActiveTitle("YouTube Live");
        setQueue([]);
        if (videoSrc !== url) setVideoSrc(url); // only update if changed
        currentKeyRef.current = "yt-live";
        if (refreshTimer.current) clearTimeout(refreshTimer.current);
        return;
      }

      // 3) Programs
      const list = await fetchProgramsForChannel(supabase, channelId);
      const now = new Date();
      const q = pickNowAndUpcoming(list, now);
      setQueue(q);

      const current = q[0] || null;
      setActiveTitle(current?.title ?? "Standby Programming");

      // 4) Build src — only bust cache when we switch program
      const override = search?.get("src") || null;
      const standbyBase = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/channel${channelId}/standby_blacktruthtv.mp4`;

      const chosen = override || (current ? getVideoUrlForProgram(current) : null) || standbyBase;
      const nextKey = programKey(current) || `standby|${channelId}`;

      // Only update the video element if the program actually changed
      if (currentKeyRef.current !== nextKey) {
        const candidate = chosen === standbyBase ? withBuster(chosen) : withBuster(chosen);
        const ok = await headOK(candidate);
        const fallback = withBuster(standbyBase);
        const okStandby = await headOK(fallback);
        setVideoSrc(ok ? candidate : okStandby ? fallback : fallback);
        currentKeyRef.current = nextKey;
      }

      // 5) Auto-advance exactly at end (handles 2-min shows)
      scheduleAutoAdvance(current);
    } catch (e: any) {
      setErr(e?.message || "Failed to load channel.");
    }
  }

  // initial + slow polling (visible tab only)
  useEffect(() => {
    if (channelId == null) return;
    pickAndPlay();
    if (pollTimer.current) clearInterval(pollTimer.current);
    pollTimer.current = setInterval(() => {
      if (document.visibilityState === "visible") pickAndPlay();
    }, POLL_MS);
  }, [channelId]); // eslint-disable-line react-hooks/exhaustive-deps

  const isYouTube = channelId === CH21 && !!(channel?.youtube_channel_id || "").trim();
  const fmt = (s?: string | null) => {
    const d = s ? toUtcDate(s) : null;
    return d
      ? d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", timeZoneName: "short" })
      : "";
  };

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
          <VideoPlayer
            key={videoSrc}                   // reloads only when src truly changes
            src={videoSrc}
            poster={channel?.logo_url || undefined}
            logoUrl={channel?.logo_url || undefined}
            isStandby={activeTitle === "Standby Programming"}
            programTitle={activeTitle || undefined}
            onError={() => {
              // fallback once per failure, with buster
              if (channelId != null) {
                const s = withBuster(
                  `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/channel${channelId}/standby_blacktruthtv.mp4`
                );
                if (s !== videoSrc) setVideoSrc(s);
                currentKeyRef.current = `standby|${channelId}`;
              }
            }}
            onVideoEnded={() => {
              // advance immediately when a file ends
              pickAndPlay();
            }}
          />
        ) : (
          <div className="text-white/70 text-sm">Loading…</div>
        )}
      </div>

      {/* Local time + Now/Next list */}
      <div className="p-4 text-sm">
        <div className="text-white/50 mb-1">
          Local time: {new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", timeZoneName: "short" })}
        </div>
        <div className="font-semibold mb-2">{activeTitle || "Standby Programming"}</div>

        {queue.length > 0 && (
          <div className="mt-2 rounded-lg border border-slate-800 bg-slate-900/60">
            <div className="px-3 py-2 border-b border-slate-800 text-white/70 uppercase text-[11px] tracking-wide">
              Now & Next
            </div>
            <ul className="divide-y divide-slate-800">
              {queue.map((p, i) => {
                const st = toUtcDate(p.start_time);
                const en = st ? addSeconds(st, secs(p.duration)) : null;
                const badge = i === 0 ? "NOW" : "NEXT";
                return (
                  <li key={`${p.channel_id}-${p.start_time}-${i}`} className="px-3 py-2 flex items-center justify-between">
                    <div className="truncate">
                      <span
                        className={`mr-2 inline-block rounded px-1.5 py-0.5 text-[10px] font-bold ${
                          i === 0 ? "bg-emerald-500 text-black" : "bg-slate-700 text-white/90"
                        }`}
                      >
                        {badge}
                      </span>
                      <span className="font-medium text-white truncate">{p.title || "Untitled"}</span>
                    </div>
                    <div className="ml-3 shrink-0 text-white/60">
                      {st ? `${fmt(p.start_time)} – ${en?.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", timeZoneName: "short" })}` : ""}
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
