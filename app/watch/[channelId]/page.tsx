// app/watch/[channelId]/page.tsx
"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

/* ---------- schema (your exact columns) ---------- */
type Channel = {
  id: number;
  name: string | null;
  slug?: string | null;
  description?: string | null;
  logo_url: string | null;            // poster ONLY
  youtube_channel_id: string | null;  // ch21 live
  youtube_is_live?: boolean | null;
  is_active?: boolean | null;
};
type Program = {
  id: string | number;
  channel_id: number;
  title: string | null;
  mp4_url: string | null;             // VIDEO ONLY
  start_time: string;                 // UTC "Z" or "YYYY-MM-DD HH:mm:ss" (UTC)
  duration: number | string;          // seconds, e.g. 7620 or "7620s"
};

const CH21 = 21;
const STANDBY_FILE = "standby_blacktruthtv.mp4";

/* ---------- time (STRICT UTC) ---------- */
const nowUtc = () => new Date(new Date().toISOString());
function toUtcDate(val?: string | Date | null): Date | null {
  if (!val) return null;
  if (val instanceof Date) return Number.isNaN(val.getTime()) ? null : val;
  let s = String(val).trim();
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(\.\d+)?$/.test(s)) s = s.replace(" ", "T") + "Z";
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

/* ---------- storage (public buckets, no SDK calls) ---------- */
const bucketFor = (id: number) => `channel${id}`;
const cleanKey  = (k: string) => k.trim().replace(/^\.?\//, "").replace(/\\/g, "/").replace(/\/{2,}/g, "/");
const encPath   = (p: string) => p.split("/").map(encodeURIComponent).join("/");

function computePubRoot(ch?: Channel, progs?: Program[]) {
  const envBase = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/+$/, "");
  if (envBase) return `${envBase}/storage/v1/object/public`;
  const scan = (u?: string | null) => {
    if (!u) return null;
    const s = String(u);
    const i = s.indexOf("/storage/v1/object/public/");
    if (s.startsWith("http") && i > 0) return s.slice(0, i + "/storage/v1/object/public".length);
    return null;
  };
  const a = scan(ch?.logo_url);
  if (a) return a;
  for (const p of progs || []) {
    const x = scan(p?.mp4_url || "");
    if (x) return x;
  }
  return "/storage/v1/object/public";
}
function fromBucket(pubRoot: string, bucket: string, key: string) {
  const root = pubRoot.replace(/\/+$/, "");
  return `${root}/${bucket}/${encPath(cleanKey(key))}`;
}
function resolveSrc(p: Program, channelId: number, pubRoot: string): string | undefined {
  let raw = (p?.mp4_url || "").trim();
  if (!raw) return undefined;
  if (/^https?:\/\//i.test(raw) || raw.startsWith("/")) return raw;
  raw = cleanKey(raw);

  const m1 = /^([a-z0-9_\-]+):(.+)$/i.exec(raw);
  if (m1) return fromBucket(pubRoot, m1[1], m1[2]);

  const m2 = /^storage:\/\/([^/]+)\/(.+)$/.exec(raw);
  if (m2) return fromBucket(pubRoot, m2[1], m2[2]);

  const first = raw.split("/")[0];
  if (/^[a-z0-9_\-]+$/i.test(first)) {
    const rest = raw.slice(first.length + 1);
    if (rest) return fromBucket(pubRoot, first, rest);
  }

  raw = raw.replace(new RegExp(`^channel${channelId}/`, "i"), "");
  return fromBucket(pubRoot, bucketFor(channelId), raw);
}

/* ---------- component ---------- */
export default function WatchPage() {
  const { channelId } = useParams<{ channelId: string }>();
  const idNum = useMemo(() => Number(channelId), [channelId]);

  const supabase = useMemo(
    () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!),
    []
  );

  const [channel, setChannel] = useState<Channel | null>(null);
  const [active,  setActive]  = useState<Program | null>(null);
  const [nextUp,  setNextUp]  = useState<Program | null>(null);

  // strict separation: video vs poster
  const [videoSrc, setVideoSrc] = useState<string | undefined>(undefined); // ONLY program.mp4_url
  const posterSrc = channel?.logo_url || undefined;                        // ONLY channel.logo_url

  const [usingStandby, setUsingStandby] = useState(false);
  const [loading, setLoading]           = useState(true);
  const [err, setErr]                   = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const playerKey = useRef(0);
  const refreshTref = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pubRootRef  = useRef<string>("");
  const lastSrcRef  = useRef<string | undefined>(undefined); // prevent unnecessary reloads

  // cleanup
  useEffect(() => () => { if (refreshTref.current) clearTimeout(refreshTref.current); }, []);
  const scheduleRefreshAt = useCallback((when: Date | null) => {
    if (refreshTref.current) clearTimeout(refreshTref.current);
    if (!when) return;
    const delay = Math.max(0, when.getTime() - Date.now() + 1000);
    refreshTref.current = setTimeout(() => { void pickAndPlay(); }, delay);
  }, []);

  function pickActive(list: Program[], now: Date): Program | null {
    let candidate: Program | null = null;
    for (const p of list) {
      const st = toUtcDate(p.start_time); if (!st) continue;
      const en = addSeconds(st, parseDurationSec(p.duration) || 1800);
      if (now >= st && now < en) candidate = p;
      if (st > now) break;
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

      pubRootRef.current = computePubRoot(ch as Channel, []);

      // CH21 → YouTube if configured (no MP4)
      if (idNum === CH21 && (ch?.youtube_channel_id || "").trim()) {
        setActive(null);
        setVideoSrc(undefined);
        setUsingStandby(false);
        setNextUp(null);
        scheduleRefreshAt(null);
        setLoading(false);
        return;
      }

      // PROGRAMS — load all once, decide in UTC on client
      const { data: list, error: pErr } = await supabase
        .from("programs")
        .select("id, channel_id, title, mp4_url, start_time, duration")
        .eq("channel_id", idNum)
        .order("start_time", { ascending: true });
      if (pErr) throw new Error(pErr.message);

      const programs = (list || []) as Program[];
      const now = nowUtc();

      const current = pickActive(programs, now);
      const nxt = programs.find(p => {
        const st = toUtcDate(p.start_time);
        return !!st && st > now;
      }) || null;
      setNextUp(nxt);

      if (current) {
        const resolved = resolveSrc(current, idNum, pubRootRef.current);
        // only update when src actually changes
        if (resolved !== lastSrcRef.current) {
          setActive(current);
          setVideoSrc(resolved);
          setUsingStandby(false);
          playerKey.current += 1;          // remount ONLY when src changed
          lastSrcRef.current = resolved;
          // force the browser to fetch new source
          setTimeout(() => videoRef.current?.load(), 0);
        } else {
          // keep playing; do not touch key or reload video
          setActive(current);
          setUsingStandby(false);
        }

        const st = toUtcDate(current.start_time)!;
        const en = addSeconds(st, parseDurationSec(current.duration) || 1800);
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
        const resolved = resolveSrc(sb, idNum, pubRootRef.current);

        if (resolved !== lastSrcRef.current) {
          setActive(sb);
          setVideoSrc(resolved);
          setUsingStandby(true);
          playerKey.current += 1;
          lastSrcRef.current = resolved;
          setTimeout(() => videoRef.current?.load(), 0);
        } else {
          setActive(sb);
          setUsingStandby(true);
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

  // INITIAL LOAD ONLY — no minute polling (prevents periodic resets)
  useEffect(() => {
    if (!Number.isFinite(idNum)) return;
    void pickAndPlay();
  }, [idNum, pickAndPlay]);

  /* ---------- render ---------- */
  let content: ReactNode;
  if (err) {
    content = <p className="text-red-400 p-4 text-center">Error: {err}</p>;
  } else if (channel && channel.id === CH21 && (channel.youtube_channel_id || "").trim()) {
    // simple iframe embed (you already have a YouTubeEmbed—you can swap it back in)
    content = (
      <iframe
        className="w-full h-full"
        src={`https://www.youtube.com/embed/live_stream?channel=${encodeURIComponent(channel.youtube_channel_id!)}`}
        title={channel.name ?? "Live"}
        allow="autoplay; encrypted-media; picture-in-picture"
        allowFullScreen
      />
    );
  } else if (active && videoSrc) {
    content = (
      <video
        key={playerKey.current}
        ref={videoRef}
        src={videoSrc}                 // VIDEO ONLY
        poster={posterSrc || undefined} // LOGO ONLY
        controls
        autoPlay={false}               // user hits Play → audio intact
        muted={false}
        playsInline
        preload="metadata"
        className="w-full h-full object-contain bg-black"
        onEnded={() => void pickAndPlay()}
        onError={() => {
          // don’t thrash; only swap to standby if different src
          const sb = fromBucket(
            pubRootRef.current || (process.env.NEXT_PUBLIC_SUPABASE_URL!.replace(/\/+$/, "") + "/storage/v1/object/public"),
            bucketFor(idNum),
            STANDBY_FILE
          );
          if (lastSrcRef.current !== sb) {
            setActive({
              id: "standby",
              channel_id: idNum,
              title: "Standby Programming",
              mp4_url: `channel${idNum}/${STANDBY_FILE}`,
              start_time: nowUtc().toISOString(),
              duration: 300,
            });
            setVideoSrc(sb);
            lastSrcRef.current = sb;
            setUsingStandby(true);
            playerKey.current += 1;
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

      <div className="p-4 space-y-3">
        {active && channel?.id !== CH21 && (
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
      </div>
    </div>
  );
}
