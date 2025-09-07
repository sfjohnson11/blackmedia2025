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
const POLL_MS = 30_000;
const DRIFT_S = 5;

function secs(v: unknown) {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? Math.max(1, Math.round(n)) : 1;
}

function withBuster(url?: string | null) {
  if (!url) return url ?? null;
  try {
    const u = new URL(url, typeof window !== "undefined" ? window.location.origin : "https://x");
    u.searchParams.set("t", String(Date.now()));
    return u.toString();
  } catch {
    // relative path
    const sep = url.includes("?") ? "&" : "?";
    return `${url}${sep}t=${Date.now()}`;
  }
}

export default function WatchPage({ params }: { params: { channelId: string } }) {
  const supabase = useMemo(() => getSupabase(), []);
  const search = useSearchParams();

  const [channelId, setChannelId] = useState<number | null>(null);
  const [channel, setChannel] = useState<Channel | null>(null);
  const [videoSrc, setVideoSrc] = useState<string | null>(null);

  const [activeTitle, setActiveTitle] = useState<string | null>(null);
  const [queue, setQueue] = useState<Program[]>([]); // current + next few
  const [err, setErr] = useState<string | null>(null);

  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null);

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

  // clear timers on unmount
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
    let startIdx = -1;

    for (let i = 0; i < list.length; i++) {
      const p = list[i];
      const st = toUtcDate(p.start_time);
      if (!st) continue;
      const startTol = addSeconds(st, -DRIFT_S);
      const endTol = addSeconds(addSeconds(st, secs(p.duration)), DRIFT_S);
      if (now >= startTol && now < endTol) {
        current = p;
        startIdx = i;
        break;
      }
      if (st > now && startIdx === -1) {
        // between shows; previous becomes "current" for continuity
        startIdx = Math.max(0, i - 1);
        current = list[startIdx] ?? null;
        break;
      }
    }

    if (!current && list.length) {
      // if still nothing, use last before now so we never look “empty”
      const before = list.filter((p) => {
        const d = toUtcDate(p.start_time);
        return d ? d <= now : false;
      });
      if (before.length) {
        current = before[before.length - 1];
        startIdx = list.indexOf(current);
      }
    }

    // Build queue: current + next 3
    const q: Program[] = [];
    if (current) q.push(current);
    const start = startIdx >= 0 ? startIdx + 1 : 0;
    for (let i = start; i < list.length && q.length < 4; i++) {
      q.push(list[i]);
    }
    return q;
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

  function scheduleAutoAdvance(q: Program[]) {
    if (refreshTimer.current) clearTimeout(refreshTimer.current);
    if (!q.length) return;
    const now = new Date();
    const cur = q[0];
    const st = toUtcDate(cur.start_time);
    if (!st) return;
    const end = addSeconds(st, secs(cur.duration));
    const ms = Math.max(500, end.getTime() - now.getTime() + DRIFT_S * 1000);
    refreshTimer.current = setTimeout(() => {
      // re-evaluate right at (or just after) expected end
      pickAndPlay();
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

      // 2) CH21 YouTube
      const ytId = (ch.youtube_channel_id || "").trim();
      if (channelId === CH21 && ytId) {
        const url = `https://www.youtube.com/embed/live_stream?channel=${encodeURIComponent(
          ytId
        )}&autoplay=0&mute=0&playsinline=1`;
        setVideoSrc(url);
        setActiveTitle("YouTube Live");
        setQueue([]);
        return;
      }

      // 3) Programs
      const list = await fetchProgramsForChannel(supabase, channelId);
      const now = new Date();
      const q = pickNowAndUpcoming(list, now);
      setQueue(q);

      const current = q[0] || null;
      setActiveTitle(current?.title ?? "Standby Programming");

      // 4) Decide source
      const override = search?.get("src") || null;
      const standby = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/channel${channelId}/standby_blacktruthtv.mp4`;
      const candidate = override || (current ? getVideoUrlForProgram(current) : null) || standby;

      const busted = withBuster(candidate);
      const bustedStandby = withBuster(standby);

      const ok = await headOK(busted);
      const okStandby = await headOK(bustedStandby);
      setVideoSrc(ok ? busted! : okStandby ? bustedStandby! : bustedStandby!);

      // 5) Auto-advance timer (handles 2-min clips)
      scheduleAutoAdvance(q);
    } catch (e: any) {
      setErr(e?.message || "Failed to load channel.");
    }
  }

  // initial + polling
  useEffect(() => {
    if (channelId == null) return;
    pickAndPlay();
    if (pollTimer.current) clearInterval(pollTimer.current);
    pollTimer.current = setInterval(() => {
      if (document.visibilityState === "visible") pickAndPlay();
    }, POLL_MS);
  }, [channelId]); // eslint-disable-line react-hooks/exhaustive-deps

  const isYouTube = channelId === CH21 && !!(channel?.youtube_channel_id || "").trim();

  // format helper
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
            key={videoSrc}
            src={videoSrc}
            poster={channel?.logo_url || undefined}
            logoUrl={channel?.logo_url || undefined}
            isStandby={activeTitle === "Standby Programming"}
            programTitle={activeTitle || undefined}
            onError={() => {
              // hard fallback to standby + burst cache
              if (channelId != null) {
                const s = withBuster(
                  `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/channel${channelId}/standby_blacktruthtv.mp4`
                );
                if (s && s !== videoSrc) setVideoSrc(s);
              }
            }}
            onVideoEnded={() => {
              // immediate advance when file ends
              pickAndPlay();
            }}
          />
        ) : (
          <div className="text-white/70 text-sm">Loading…</div>
        )}
      </div>

      {/* Now/Next list under player — shows up to 4 items */}
      <div className="p-4 text-sm">
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
                return (
                  <li key={`${p.channel_id}-${p.start_time}-${i}`} className="px-3 py-2 flex items-center justify-between">
                    <div className="truncate">
                      <span className={`mr-2 inline-block rounded px-1.5 py-0.5 text-[10px] font-bold ${
                        i === 0 ? "bg-emerald-500 text-black" : "bg-slate-700 text-white/90"
                      }`}>
                        {i === 0 ? "NOW" : "NEXT"}
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
