// app/watch/[channelId]/page.tsx
"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import YouTubeEmbed from "@/components/youtube-embed";
import { toUtcDate, addSeconds } from "@/lib/supabase";

/* ---------- schema ---------- */
type Channel = {
  id: number;
  name: string | null;
  slug?: string | null;
  description?: string | null;
  logo_url: string | null;
  youtube_channel_id: string | null;
  youtube_is_live?: boolean | null;
  is_active?: boolean | null;
};

type Program = {
  id: string | number;
  channel_id: number;
  title: string | null;
  mp4_url: string | null;
  start_time: string;
  duration: number | string;
};

const CH21 = 21;
const STANDBY_FILE = "standby_blacktruthtv.mp4";

/* ---------- time helpers ---------- */
const nowUtc = () => new Date(); // Date compares by absolute ms

function parseDurationSec(v: number | string | null | undefined): number {
  if (typeof v === "number") return Number.isFinite(v) && v > 0 ? v : 0;
  if (v == null) return 0;
  const m = String(v).match(/^\s*(\d+)/);
  if (!m) return 0;
  const n = Number(m[1]);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/* ---------- storage URL (public buckets) ---------- */
const SUPA_URL = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/+$/, "");
const PUB_ROOT = `${SUPA_URL}/storage/v1/object/public`;
const bucketFor = (id: number) => `channel${id}`;
const cleanKey  = (k: string) => k.trim().replace(/^\.?\//, "").replace(/\\/g, "/").replace(/\/{2,}/g, "/");
const encPath   = (p: string) => p.split("/").map(encodeURIComponent).join("/");

function fromBucket(bucket: string, key: string) {
  return `${PUB_ROOT}/${bucket}/${encPath(cleanKey(key))}`;
}

function resolveSrc(p: Program, channelId: number): string | undefined {
  let raw = (p?.mp4_url || "").trim();
  if (!raw) return undefined;

  if (/^https?:\/\//i.test(raw) || raw.startsWith("/")) return raw;

  raw = cleanKey(raw);

  // "bucket:key"
  let m = /^([a-z0-9_\-]+):(.+)$/i.exec(raw);
  if (m) return fromBucket(m[1], m[2]);

  // "storage://bucket/path"
  m = /^storage:\/\/([^/]+)\/(.+)$/.exec(raw);
  if (m) return fromBucket(m[1], m[2]);

  // "bucket/path/file"
  const first = raw.split("/")[0];
  if (/^[a-z0-9_\-]+$/i.test(first)) {
    const rest = raw.slice(first.length + 1);
    if (rest) return fromBucket(first, rest);
  }

  // relative → channel{ID}/key (strip accidental duplicate prefix)
  raw = raw.replace(new RegExp(`^channel${channelId}/`, "i"), "");
  return fromBucket(bucketFor(channelId), raw);
}

function standbyProgram(channelId: number): Program {
  return {
    id: "standby",
    channel_id: channelId,
    title: "Standby Programming",
    mp4_url: `channel${channelId}/${STANDBY_FILE}`,
    start_time: nowUtc().toISOString(),
    duration: 300,
  };
}

/* ---------- page ---------- */
export default function WatchPage() {
  const { channelId } = useParams<{ channelId: string }>();
  const search = useSearchParams();
  const debug  = (search?.get("debug") ?? "0") === "1";

  const idNum = useMemo(() => Number(channelId), [channelId]);

  const supabase = useMemo(
    () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!),
    []
  );

  const [channel, setChannel]           = useState<Channel | null>(null);
  const [active, setActive]             = useState<Program | null>(null);
  const [nextUp, setNextUp]             = useState<Program | null>(null);
  const [videoSrc, setVideoSrc]         = useState<string | undefined>(undefined);
  const [usingStandby, setUsingStandby] = useState(false);
  const [loading, setLoading]           = useState(true);
  const [err, setErr]                   = useState<string | null>(null);

  const posterSrc = channel?.logo_url || undefined;
  const videoRef  = useRef<HTMLVideoElement | null>(null);
  const lastSrcRef = useRef<string | undefined>(undefined);
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [dbgRows, setDbgRows] = useState<
    { id: string | number; title: string | null; raw: string; startIso?: string; endIso?: string; duration: number; isNow: boolean; resolved?: string }[]
  >([]);

  useEffect(() => () => { if (refreshTimer.current) clearTimeout(refreshTimer.current); }, []);
  const scheduleRefreshAt = useCallback((when: Date | null) => {
    if (refreshTimer.current) clearTimeout(refreshTimer.current);
    if (!when) return;
    const delay = Math.max(0, when.getTime() - Date.now() + 1000);
    refreshTimer.current = setTimeout(() => { void pickAndPlay(); }, delay);
  }, []);

  // choose the last program with start <= now < end
  function pickActive(list: Program[], now: Date): Program | null {
    let candidate: Program | null = null;
    for (const p of list) {
      const st = toUtcDate(p.start_time); if (!st) continue;
      const en = addSeconds(st, parseDurationSec(p.duration) || 1800);
      if (now >= st && now < en) candidate = p;
    }
    return candidate;
  }

  const pickAndPlay = useCallback(async () => {
    if (!Number.isFinite(idNum)) return;

    try {
      setLoading(true); setErr(null);

      // CHANNEL
      const { data: ch, error: chErr } = await supabase
        .from("channels")
        .select("id, name, slug, description, logo_url, youtube_channel_id, youtube_is_live, is_active")
        .eq("id", idNum)
        .single();
      if (chErr) throw new Error(chErr.message);
      setChannel(ch as Channel);

      // CH21 → YouTube embed if configured
      if (idNum === CH21 && (ch?.youtube_channel_id || "").trim()) {
        setActive(null); setNextUp(null); setVideoSrc(undefined); setUsingStandby(false);
        lastSrcRef.current = undefined;
        scheduleRefreshAt(null);
        setDbgRows([]);
        setLoading(false);
        return;
      }

      // PROGRAMS
      const { data: list, error: pErr } = await supabase
        .from("programs")
        .select("id, channel_id, title, mp4_url, start_time, duration")
        .eq("channel_id", idNum)
        .order("start_time", { ascending: true });
      if (pErr) throw new Error(pErr.message);

      const programs = (list || []) as Program[];
      const now = nowUtc();

      // Debug rows
      const rows = programs.map(pr => {
        const st = toUtcDate(pr.start_time);
        const dur = parseDurationSec(pr.duration) || 1800;
        const en = st ? addSeconds(st, dur) : null;
        return {
          id: pr.id,
          title: pr.title ?? null,
          raw: pr.start_time,
          startIso: st ? st.toISOString() : undefined,
          endIso: en ? en.toISOString() : undefined,
          duration: dur,
          isNow: !!(st && en && now >= st && now < en),
          resolved: resolveSrc(pr, idNum),
        };
      });
      setDbgRows(rows);

      // ACTIVE & NEXT
      const current = pickActive(programs, now);
      const nxt = programs.find(p => {
        const st = toUtcDate(p.start_time);
        return !!st && st > now;
      }) || null;
      setNextUp(nxt);

      if (current) {
        const nextSrc = resolveSrc(current, idNum);
        setActive(current);
        setUsingStandby(false);

        if (nextSrc && nextSrc !== lastSrcRef.current) {
          setVideoSrc(nextSrc);
          lastSrcRef.current = nextSrc;
          setTimeout(() => videoRef.current?.load(), 0);
        }

        const st = toUtcDate(current.start_time)!;
        const en = addSeconds(st, parseDurationSec(current.duration) || 1800);
        const boundary = nxt && (toUtcDate(nxt.start_time) as Date) < en
          ? (toUtcDate(nxt.start_time) as Date)
          : en;
        scheduleRefreshAt(boundary);
      } else {
        // STANDBY until next
        const sb = standbyProgram(idNum);
        const sbSrc = resolveSrc(sb, idNum);
        setActive(sb);
        setUsingStandby(true);

        if (sbSrc && sbSrc !== lastSrcRef.current) {
          setVideoSrc(sbSrc);
          lastSrcRef.current = sbSrc;
          setTimeout(() => videoRef.current?.load(), 0);
        }

        scheduleRefreshAt(nxt ? (toUtcDate(nxt.start_time) as Date) : null);
      }
    } catch (e: any) {
      setErr(e?.message || "Failed to load channel/programs.");
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idNum, supabase]);

  // INITIAL ONLY
  useEffect(() => {
    if (!Number.isFinite(idNum)) return;
    void pickAndPlay();
  }, [idNum, pickAndPlay]);

  /* ---------- render ---------- */
  const isYouTube = idNum === CH21 && (channel?.youtube_channel_id || "").trim().length > 0;

  let content: ReactNode;
  if (err) {
    content = <p className="text-red-400 p-4 text-center">Error: {err}</p>;
  } else if (isYouTube) {
    content = (
      <YouTubeEmbed
        channelId={channel!.youtube_channel_id as string}
        title={channel?.name ? `${channel.name} Live` : "Live"}
      />
    );
  } else if (active && videoSrc) {
    content = (
      <video
        ref={videoRef}
        controls
        autoPlay={true}          // ← autoplay back on
        muted={true}             // ← required for autoplay policies
        playsInline
        preload="auto"           // ← start fetching immediately
        className="w-full h-full object-contain bg-black"
        poster={usingStandby ? (channel?.logo_url || undefined) : undefined} // poster ONLY on standby
        loop={usingStandby}      // standby loops
        onLoadedMetadata={(e) => {
          // if you later add "continue watching", seek here then play:
          try { (e.currentTarget as HTMLVideoElement).play().catch(() => {}); } catch {}
        }}
        onEnded={() => void pickAndPlay()}
        onError={() => {
          if (!usingStandby) {
            const sb = standbyProgram(idNum);
            const sbSrc = resolveSrc(sb, idNum);
            setActive(sb);
            setUsingStandby(true);
            if (sbSrc) {
              setVideoSrc(sbSrc);
              lastSrcRef.current = sbSrc;
              setTimeout(() => videoRef.current?.load(), 0);
            }
          }
        }}
      >
        <source src={videoSrc} type="video/mp4" />
      </video>
    );
  } else if (loading) {
    content = (
      <div className="flex flex-col items-center justify-center h-full">
        <svg className="animate-spin h-10 w-10 text-red-500 mb-2" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
        </svg>
        <p>Loading…</p>
      </div>
    );
  } else {
    content = <p className="text-gray-400 p-4 text-center">Standby… waiting for next program.</p>;
  }

  return (
    <div className="bg-black min-h-screen text-white">
      <div className="w-full aspect-video bg-black flex items-center justify-center">
        {content}
      </div>

      <div className="p-4 space-y-3">
        {active && !isYouTube && (
          <>
            <h2 className="text-xl font-bold">{active.title || "Now Playing"}</h2>
            {active.id !== "standby" && active.start_time && (
              <p className="text-sm text-gray-400">
                Start (local): {toUtcDate(active.start_time)?.toLocaleString()}
              </p>
            )}
            {usingStandby && <p className="text-amber-300 text-sm">Fallback: Standby asset</p>}
          </>
        )}

        {nextUp && (
          <div className="text-sm text-gray-300">
            <span className="font-medium">Next:</span>{" "}
            {nextUp.title || "Upcoming program"}{" "}
            <span className="text-gray-400">
              — {toUtcDate(nextUp.start_time)?.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", timeZoneName: "short" })}
            </span>
          </div>
        )}

        {debug && (
          <div className="mt-3 text-[11px] bg-gray-900/70 border border-gray-700 rounded p-2 space-y-2">
            <div><b>Now (UTC):</b> {nowUtc().toISOString()}</div>
            {active ? (
              <>
                <div><b>Active:</b> {active.title || "(untitled)"} ({String(active.id)})</div>
                <div><b>Active start (UTC):</b> {toUtcDate(active.start_time)?.toISOString() || "—"}</div>
                <div>
                  <b>Active end (UTC):</b>{" "}
                  {(() => {
                    const st = toUtcDate(active.start_time);
                    const dur = parseDurationSec(active.duration) || 1800;
                    return st ? addSeconds(st, dur).toISOString() : "—";
                  })()}
                </div>
                <div className="truncate"><b>Video Src:</b> {videoSrc || "—"}</div>
                <div><b>Using Standby:</b> {usingStandby ? "yes" : "no"}</div>
              </>
            ) : <div><b>Active:</b> —</div>}

            <div className="pt-2 border-t border-gray-800">
              <div className="font-semibold mb-1">Programs (parsed):</div>
              {dbgRows.slice(0, 12).map(r => (
                <div key={String(r.id)} className="grid grid-cols-1 md:grid-cols-2 gap-1 mb-2">
                  <div><b>ID:</b> {String(r.id)} • <b>Title:</b> {r.title || "—"}</div>
                  <div className="truncate"><b>Src:</b> {r.resolved || "—"}</div>
                  <div><b>Raw:</b> {r.raw}</div>
                  <div><b>Start:</b> {r.startIso || "—"} • <b>End:</b> {r.endIso || "—"}</div>
                  <div><b>Dur(s):</b> {r.duration} • <b>Active now?</b> {r.isNow ? "YES" : "no"}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
