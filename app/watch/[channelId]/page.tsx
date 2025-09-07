// app/watch/[channelId]/page.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  getSupabase,
  getVideoUrlForProgram,
  fetchChannelById,
  fetchProgramsForChannel,
  type Program,
  type Channel,
} from "@/lib/supabase";

/* ---------- strict UTC helpers ---------- */
const addSeconds = (d: Date, secs: number) => new Date(d.getTime() + secs * 1000);

function toUtcDate(val?: string | Date | null): Date | null {
  if (!val) return null;
  if (val instanceof Date) return Number.isNaN(val.getTime()) ? null : val;
  const s = String(val).trim();
  if (/[zZ]$/.test(s) || /[+\-]\d{2}:?\d{2}$/.test(s)) {
    const norm = s.replace(" ", "T").replace(/([+\-]\d{2})(\d{2})$/, "$1:$2").replace(/[zZ]$/, "Z");
    const d = new Date(norm);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/.exec(s);
  if (m) {
    const [, yy, MM, dd, hh, mm, ss] = m;
    const d = new Date(Date.UTC(+yy, +MM - 1, +dd, +hh, +mm, +ss));
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}

function parseDurationSec(v: number | string | null | undefined): number {
  if (typeof v === "number") return Number.isFinite(v) && v > 0 ? v : 0;
  if (v == null) return 0;
  const m = String(v).match(/^\s*(\d+)/);
  if (!m) return 0;
  const n = Number(m[1]);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/* ---------- standby URL (per-channel) ---------- */
function standbyUrl(channelId: number) {
  const root = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/+$/, "");
  return `${root}/storage/v1/object/public/channel${channelId}/standby_blacktruthtv.mp4`;
}

/* ---------- constants ---------- */
const CH21 = 21;

export default function WatchPage({ params }: { params: { channelId: string } }) {
  const supabase = useMemo(() => getSupabase(), []);
  const search = useSearchParams();

  const rawParam = String(params.channelId || "");
  const srcOverride = search?.get("src") || null;
  const debugQuery = search?.get("debug") === "1";

  const [channelId, setChannelId] = useState<number | null>(null);
  const [channel, setChannel] = useState<Channel | null>(null);
  const [videoSrc, setVideoSrc] = useState<string | null>(null);
  const [isStandby, setIsStandby] = useState<boolean>(false);
  const [activeTitle, setActiveTitle] = useState<string | null>(null);
  const [nextList, setNextList] = useState<Program[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [lastFail, setLastFail] = useState<string | null>(null); // store failing URL for debug

  const pollRef = useRef<NodeJS.Timeout | null>(null);

  // Normalize param → numeric id
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

  // Clear poll on unmount
  useEffect(() => {
    return () => {
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    };
  }, []);

  async function headOk(url: string): Promise<boolean> {
    try {
      const u = new URL(url, typeof window !== "undefined" ? window.location.href : undefined);
      u.searchParams.set("_", String(Date.now())); // bust caches
      const res = await fetch(u.toString(), { method: "HEAD", cache: "no-store" });
      return res.ok;
    } catch {
      return false;
    }
  }

  async function resolvePlayableSrc(chId: number, current: Program | null): Promise<{src: string, standby: boolean}> {
    // 1) explicit override
    if (srcOverride) return { src: srcOverride, standby: false };

    // 2) current program
    if (current) {
      const candidate = getVideoUrlForProgram(current);
      if (candidate) {
        const ok = await headOk(candidate);
        if (ok) return { src: candidate, standby: false };
        setLastFail(candidate);
      }
    }

    // 3) per-channel standby
    const sb = standbyUrl(chId);
    return { src: sb, standby: true };
  }

  async function loadAndDecide(chId: number) {
    setErr(null);
    setVideoSrc(null);
    setIsStandby(false);
    setActiveTitle(null);
    setNextList([]);
    setLastFail(null);

    // channel row
    const ch = await fetchChannelById(supabase, chId);
    if (!ch) throw new Error(`Channel not found (id=${chId})`);
    setChannel(ch);

    // CH21 YouTube embed
    const ytId = (ch.youtube_channel_id || "").trim();
    if (chId === CH21 && ytId && !srcOverride) {
      const url = `https://www.youtube.com/embed/live_stream?channel=${encodeURIComponent(
        ytId
      )}&autoplay=1&mute=1`;
      setVideoSrc(url);
      setActiveTitle("YouTube Live");
      setIsStandby(false);
      return;
    }

    // Pull programs
    const list = await fetchProgramsForChannel(supabase, chId);
    const now = new Date();

    // current & upcoming (strict UTC)
    let current: Program | null = null;
    const upcoming: Program[] = [];
    for (const p of list) {
      const st = toUtcDate(p.start_time);
      if (!st) continue;
      const dur = Math.max(60, parseDurationSec(p.duration)); // guard minimum
      const en = addSeconds(st, dur);
      if (!current && now >= st && now < en) current = p;
      if (st > now) upcoming.push(p);
    }

    setNextList(upcoming.slice(0, 6));

    // Decide src with HEAD preflight
    const chosen = await resolvePlayableSrc(chId, current);
    setVideoSrc(chosen.src);
    setIsStandby(chosen.standby && !srcOverride);
    setActiveTitle(current?.title ?? "Standby Programming");

    // If no current, poll for the next start and auto-switch from standby
    if (!current) {
      if (pollRef.current) clearInterval(pollRef.current);
      pollRef.current = setInterval(async () => {
        try {
          const fresh = await fetchProgramsForChannel(supabase, chId);
          const n = new Date();
          const nextNow = fresh.find((p) => {
            const st = toUtcDate(p.start_time);
            return st && st <= n;
          });
          if (nextNow) {
            if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
            await loadAndDecide(chId);
          }
        } catch { /* ignore */ }
      }, 30000);
    }
  }

  // Initial load / when id changes
  useEffect(() => {
    if (channelId == null) return;
    loadAndDecide(channelId).catch((e: any) => setErr(e?.message || "Failed to load channel."));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channelId, srcOverride]);

  const isYouTube = channelId === CH21 && !!(channel?.youtube_channel_id || "").trim();

  // When a program ends: try to step to the next, else standby (and poll)
  async function handleEnded() {
    if (channelId == null) return;
    try {
      const list = await fetchProgramsForChannel(supabase, channelId);
      const now = new Date();
      const upcoming = list
        .map((p) => ({ p, st: toUtcDate(p.start_time) }))
        .filter((x) => x.st && x.st > now)
        .sort((a, b) => (a.st!.getTime() - b.st!.getTime()));
      if (upcoming[0] && upcoming[0].st!.getTime() <= now.getTime() + 5000) {
        await loadAndDecide(channelId);
      } else {
        const sb = standbyUrl(channelId);
        setVideoSrc(sb);
        setIsStandby(true);
        setActiveTitle("Standby Programming");
        if (pollRef.current) clearInterval(pollRef.current);
        pollRef.current = setInterval(async () => {
          const fresh = await fetchProgramsForChannel(supabase, channelId);
          const n = new Date();
          const nextNow = fresh.find((p) => {
            const st = toUtcDate(p.start_time);
            return st && st <= n;
          });
          if (nextNow) {
            if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
            await loadAndDecide(channelId);
          }
        }, 30000);
      }
    } catch {
      const sb = standbyUrl(channelId!);
      setVideoSrc(sb);
      setIsStandby(true);
      setActiveTitle("Standby Programming");
    }
  }

  return (
    <div className="bg-black min-h-screen text-white">
      {/* Debug banner if program URL failed preflight */}
      {(debugQuery || lastFail) && (
        <div className="text-xs bg-red-900/40 text-red-200 px-3 py-2">
          {lastFail
            ? <>Program URL failed to load: <span className="underline break-all">{lastFail}</span>. Fell back to Standby.</>
            : <>Debug mode on.</>
          }
        </div>
      )}

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
            muted={false}          // user can unmute if browser blocks
            playsInline
            controls
            crossOrigin="anonymous"
            loop={isStandby}       // standby loops
            onEnded={handleEnded}  // auto-advance after short shows
            onError={() => {
              if (channelId != null) {
                const s = standbyUrl(channelId);
                if (s !== videoSrc) {
                  setVideoSrc(s);
                  setIsStandby(true);
                  setActiveTitle("Standby Programming");
                }
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
        {nextList.length > 0 && (
          <div className="text-white/60">
            Next: {nextList[0].title || "Upcoming"} —{" "}
            {toUtcDate(nextList[0].start_time)?.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </div>
        )}
      </div>
    </div>
  );
}
