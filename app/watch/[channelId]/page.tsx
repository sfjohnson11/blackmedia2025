// app/watch/[channelId]/page.tsx
"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import YouTubeEmbed from "@/components/youtube-embed";

/* ---------- tables (your exact cols) ---------- */
type Channel = {
  id: number;
  name: string | null;
  logo_url: string | null;            // poster ONLY
  youtube_channel_id: string | null;  // CH21 live
  slug?: string | null;
  description?: string | null;
  youtube_is_live?: boolean | null;
  is_active?: boolean | null;
};

type Program = {
  id: string | number;
  channel_id: number;
  title: string | null;
  mp4_url: string | null;             // VIDEO ONLY (absolute or storage key)
  start_time: string;                 // UTC string: "...Z" or "YYYY-MM-DD HH:mm:ss"
  duration: number | string;          // seconds (e.g. 7620 or "7620s")
};

/* ---------- constants ---------- */
const CH21 = 21;
const STANDBY_FILE = "standby_blacktruthtv.mp4";
const MIN_FALLBACK_DURATION = 1800; // 30m fallback when duration is missing

// Public storage root
const SUPA_URL = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/+$/, "");
const PUB_ROOT = `${SUPA_URL}/storage/v1/object/public`;

/* ---------- time (STRICT UTC) ---------- */
const nowUtc = () => new Date(new Date().toISOString());

function toUtcDate(val?: string | Date | null): Date | null {
  if (!val) return null;
  if (val instanceof Date) return Number.isNaN(val.getTime()) ? null : val;

  let s = String(val).trim();
  // naive DB: "YYYY-MM-DD HH:mm:ss(.sss)" → treat as UTC
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(\.\d+)?$/.test(s)) s = s.replace(" ", "T") + "Z";
  // ISO without tz → force Z (UTC)
  else if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?$/.test(s)) s = s + "Z";

  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}
const addSeconds = (d: Date, secs: number) => new Date(d.getTime() + secs * 1000);

/* ---------- duration parsing (handles "7620s" or 7620) ---------- */
function parseDurationSec(v: number | string | null | undefined): number {
  if (typeof v === "number") return Number.isFinite(v) && v > 0 ? v : 0;
  if (v == null) return 0;
  const m = String(v).match(/^\s*(\d+)/);
  if (!m) return 0;
  const n = Number(m[1]);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/* ---------- storage helpers ---------- */
const bucketFor = (id: number) => `channel${id}`;
const cleanKey = (k: string) =>
  k.trim().replace(/^\.?\//, "").replace(/\\/g, "/").replace(/\/{2,}/g, "/");
const encPath = (p: string) => p.split("/").map(encodeURIComponent).join("/");

function fromBucket(bucket: string, key: string) {
  return `${PUB_ROOT}/${bucket}/${encPath(cleanKey(key))}`;
}

function standbyUrl(channelId: number) {
  return fromBucket(bucketFor(channelId), STANDBY_FILE);
}

/** Resolve MP4 source exactly (public buckets only, no SDK probing) */
function resolveSrc(program: Program, channelId: number): string | undefined {
  let raw = (program?.mp4_url || "").trim();
  if (!raw) return undefined;

  // absolute URL or absolute path
  if (/^https?:\/\//i.test(raw) || raw.startsWith("/")) return raw;

  raw = cleanKey(raw);

  // "bucket:key"
  const m1 = /^([a-z0-9_\-]+):(.+)$/i.exec(raw);
  if (m1) return fromBucket(m1[1], m1[2]);

  // "storage://bucket/path"
  const m2 = /^storage:\/\/([^/]+)\/(.+)$/.exec(raw);
  if (m2) return fromBucket(m2[1], m2[2]);

  // "bucket/path/to/file.mp4"
  const first = raw.split("/")[0];
  if (/^[a-z0-9_\-]+$/i.test(first)) {
    const rest = raw.slice(first.length + 1);
    if (rest) return fromBucket(first, rest);
  }

  // relative → channel{ID}/key (strip accidental "channel{ID}/")
  raw = raw.replace(new RegExp(`^channel${channelId}/`, "i"), "");
  return fromBucket(bucketFor(channelId), raw);
}

/* ---------- component ---------- */
export default function WatchPage() {
  const { channelId } = useParams<{ channelId: string }>();
  const search = useSearchParams();
  const debug = (search?.get("debug") ?? "0") === "1";
  const tz = (search?.get("tz") ?? "local") as "local" | "utc"; // display only

  const idNum = useMemo(() => Number(channelId), [channelId]);
  const supabase = useMemo(
    () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!),
    []
  );

  const [channel, setChannel] = useState<Channel | null>(null);
  const [active, setActive] = useState<Program | null>(null);
  const [nextUp, setNextUp] = useState<Program | null>(null);

  // strict separation: poster vs video
  const poster = channel?.logo_url || undefined;      // poster ONLY
  const [videoSrc, setVideoSrc] = useState<string>(); // VIDEO ONLY
  const lastSrcRef = useRef<string | undefined>(undefined); // prevent unnecessary reloads

  const [usingStandby, setUsingStandby] = useState(false);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const playerKey = useRef(0);
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => () => { if (refreshTimer.current) clearTimeout(refreshTimer.current); }, []);
  const scheduleRefreshAt = useCallback((when: Date | null) => {
    if (refreshTimer.current) clearTimeout(refreshTimer.current);
    if (!when) return;
    const delay = Math.max(0, when.getTime() - Date.now() + 1000);
    refreshTimer.current = setTimeout(() => { void pickAndPlay(); }, delay);
  }, []);

  function pickActive(list: Program[], now: Date): Program | null {
    let candidate: Program | null = null;
    for (const p of list) {
      const st = toUtcDate(p.start_time); if (!st) continue;
      const en = addSeconds(st, parseDurationSec(p.duration) || MIN_FALLBACK_DURATION);
      if (now >= st && now < en) candidate = p;
      if (st > now) break;
    }
    return candidate;
  }

  const pickAndPlay = useCallback(async () => {
    if (!Number.isFinite(idNum)) return;

    try {
      setLoading(true); setErr(null);

      // 1) Channel
      const { data: ch, error: chErr } = await supabase
        .from("channels")
        .select("id, name, logo_url, youtube_channel_id")
        .eq("id", idNum)
        .single();
      if (chErr) throw new Error(chErr.message);
      setChannel(ch as Channel);

      // CH21 → YouTube if configured
      if (idNum === CH21 && (ch?.youtube_channel_id || "").trim()) {
        setActive(null);
        setNextUp(null);
        if (refreshTimer.current) clearTimeout(refreshTimer.current);
        setLoading(false);
        return;
      }

      // 2) Programs
      const { data: list, error: pErr } = await supabase
        .from("programs")
        .select("id, channel_id, title, mp4_url, start_time, duration")
        .eq("channel_id", idNum)
        .order("start_time", { ascending: true });
      if (pErr) throw new Error(pErr.message);

      const programs = (list || []) as Program[];
      const now = nowUtc();

      // ACTIVE (strict UTC)
      const current = pickActive(programs, now);

      // NEXT
      const nxt = programs.find(p => {
        const st = toUtcDate(p.start_time);
        return !!st && st > now;
      }) || null;
      setNextUp(nxt);

      if (current) {
        const resolved = resolveSrc(current, idNum);
        setActive(current);
        setUsingStandby(false);

        // Only swap <video> when src actually changes
        if (resolved !== lastSrcRef.current) {
          setVideoSrc(resolved);
          playerKey.current += 1;
          lastSrcRef.current = resolved;
          // force browser to fetch new source without remount loops
          setTimeout(() => videoRef.current?.load(), 0);
        }

        const st = toUtcDate(current.start_time)!;
        const en = addSeconds(st, parseDurationSec(current.duration) || MIN_FALLBACK_DURATION);
        const boundary = nxt && (toUtcDate(nxt.start_time) as Date) < en
          ? (toUtcDate(nxt.start_time) as Date)
          : en;
        scheduleRefreshAt(boundary);
      } else {
        // STANDBY until next
        const sb: Program = {
          id: "standby",
          channel_id: idNum,
          title: "Standby Programming",
          mp4_url: `channel${idNum}/${STANDBY_FILE}`,
          start_time: now.toISOString(),
          duration: 300,
        };
        const resolved = resolveSrc(sb, idNum);
        setActive(sb);
        setUsingStandby(true);

        if (resolved !== lastSrcRef.current) {
          setVideoSrc(resolved);
          playerKey.current += 1;
          lastSrcRef.current = resolved;
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

  // INITIAL LOAD ONLY — no interval polling (prevents periodic resets)
  useEffect(() => {
    if (!Number.isFinite(idNum)) return;
    void pickAndPlay();
  }, [idNum, pickAndPlay]);

  /* ---------- render ---------- */
  const isYouTube = idNum === CH21 && (channel?.youtube_channel_id || "").trim().length > 0;

  function fmt(isoish?: string) {
    const d = toUtcDate(isoish);
    if (!d) return "—";
    const opt: Intl.DateTimeFormatOptions = {
      hour12: true, hour: "2-digit", minute: "2-digit", second: "2-digit", timeZoneName: "short",
    };
    if (tz === "utc") (opt as any).timeZone = "UTC";
    return d.toLocaleString([], opt);
  }

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
        key={playerKey.current}
        ref={videoRef}
        src={videoSrc}                 // VIDEO ONLY
        poster={poster || undefined}   // LOGO ONLY
        controls
        autoPlay={false}               // user clicks Play → audio intact
        muted={false}
        playsInline
        preload="metadata"
        className="w-full h-full object-contain bg-black"
        onEnded={() => void pickAndPlay()}
        onError={() => {
          // swap to standby only if different
          const sb = standbyUrl(idNum);
          if (lastSrcRef.current !== sb) {
            setVideoSrc(sb);
            setUsingStandby(true);
            playerKey.current += 1;
            lastSrcRef.current = sb;
            setTimeout(() => videoRef.current?.load(), 0);
          }
        }}
      />
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

      {/* Info */}
      <div className="p-4 space-y-3">
        {active && !isYouTube && (
          <>
            <h2 className="text-xl font-bold">{active.title || "Now Playing"}</h2>
            {active.id !== "standby" && active.start_time && (
              <p className="text-sm text-gray-400">
                Start ({tz.toUpperCase()}): {fmt(active.start_time)}
              </p>
            )}
            {usingStandby && <p className="text-amber-300 text-sm">Fallback: Standby asset</p>}
          </>
        )}

        {nextUp && (
          <div className="text-sm text-gray-300">
            <span className="font-medium">Next:</span>{" "}
            {nextUp.title || "Upcoming program"}{" "}
            <span className="text-gray-400">— {fmt(nextUp.start_time)}</span>
          </div>
        )}

        {debug && (
          <div className="mt-3 text-[11px] bg-gray-900/70 border border-gray-700 rounded p-2 space-y-1">
            <div><b>PUB_ROOT:</b> {PUB_ROOT}</div>
            <div><b>Now (UTC):</b> {nowUtc().toISOString()}</div>
            {active ? (
              <>
                <div><b>Active:</b> {active.title || "(untitled)"} ({String(active.id)})</div>
                <div><b>Start (UTC raw):</b> {toUtcDate(active.start_time)?.toISOString() || "—"}</div>
                <div>
                  <b>End (UTC raw):</b>{" "}
                  {(() => {
                    const st = toUtcDate(active.start_time);
                    const dur = parseDurationSec(active.duration) || MIN_FALLBACK_DURATION;
                    return st ? addSeconds(st, dur).toISOString() : "—";
                  })()}
                </div>
                <div className="truncate"><b>Video Src:</b> {videoSrc || "—"}</div>
                <div><b>Using Standby:</b> {usingStandby ? "yes" : "no"}</div>
              </>
            ) : <div><b>Active:</b> —</div>}
          </div>
        )}
      </div>
    </div>
  );
}
