// app/watch/[channelId]/page.tsx
"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import YouTubeEmbed from "@/components/youtube-embed";

/* ---------- schema (your columns) ---------- */
type Channel = {
  id: number;
  name: string | null;
  slug?: string | null;
  description?: string | null;
  logo_url: string | null;            // poster only
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
  duration: number | string;          // seconds (number or "7620" / "7620s")
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

/* ---------- duration parsing ---------- */
function parseDurationSec(v: number | string | null | undefined): number {
  if (typeof v === "number") return Number.isFinite(v) && v > 0 ? v : 0;
  if (v == null) return 0;
  const m = String(v).match(/^\s*(\d+)/);
  if (!m) return 0;
  const n = Number(m[1]);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/* ---------- storage (public buckets) ---------- */
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
  const search = useSearchParams();
  const debug  = (search?.get("debug") ?? "0") === "1";

  const idNum = useMemo(() => Number(channelId), [channelId]);
  const supabase = useMemo(() => createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  ), []);

  const [channel, setChannel] = useState<Channel | null>(null);
  const [active, setActive]   = useState<Program | null>(null);
  const [nextUp, setNextUp]   = useState<Program | null>(null);

  // HARD separation: video vs poster
  const [videoSrc, setVideoSrc] = useState<string | undefined>(undefined); // ONLY program.mp4_url
  const posterSrc = channel?.logo_url || undefined;                        // ONLY channel.logo_url

  const [usingStandby, setUsingStandby] = useState(false);
  const [loading, setLoading]           = useState(true);
  const [err, setErr]                   = useState<string | null>(null);

  // play-state + ref
  const [vidState, setVidState] = useState<"idle"|"loading"|"ready"|"playing"|"error">("idle");
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const playerKey   = useRef(0);
  const refreshTref = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pubRootRef  = useRef<string>("");

  // NEW: remember last src so we only reload when it actually changes
  const lastSrcRef  = useRef<string | undefined>(undefined);

  useEffect(() => () => { if (refreshTref.current) clearTimeout(refreshTref.current); }, []);
  const scheduleRefreshAt = useCallback((when: Date | null) => {
    if (refreshTref.current) clearTimeout(refreshTref.current);
    if (!when) return;
    const delay = Math.max(0, when.getTime() - Date.now() + 1000);
    refreshTref.current = setTimeout(() => { void pickAndPlay(); }, delay);
  }, []);

  function pickActive(list: Program[], now: Date): Program | null {
    // list is ASC; walk and keep the latest that started <= now and hasn’t ended
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
      // NOTE: do NOT force vidState("idle") here; it causes overlay flicker & “reload” feel

      // CHANNEL
      const { data: ch, error: chErr } = await supabase
        .from("channels")
        .select("id, name, slug, description, logo_url, youtube_channel_id, youtube_is_live, is_active")
        .eq("id", idNum)
        .single();
      if (chErr) throw new Error(chErr.message);
      setChannel(ch as Channel);

      pubRootRef.current = computePubRoot(ch as Channel, []);

      // CH21 → YouTube if configured
      if (idNum === CH21 && (ch?.youtube_channel_id || "").trim()) {
        setActive(null);
        setVideoSrc(undefined);
        setUsingStandby(false);
        setNextUp(null);
        lastSrcRef.current = undefined;
        scheduleRefreshAt(null);
        setLoading(false);
        return;
      }

      // PROGRAMS — NO TIME FILTERS (avoid DB time/text mismatch)
      const { data: list, error: pErr } = await supabase
        .from("programs")
        .select("id, channel_id, title, mp4_url, start_time, duration")
        .eq("channel_id", idNum)
        .order("start_time", { ascending: true });
      if (pErr) throw new Error(pErr.message);

      const programs = (list || []) as Program[];
      const now = nowUtc();

      // ACTIVE (client-only, strict UTC)
      const current = pickActive(programs, now);

      // NEXT (first with start > now)
      const nxt = programs.find(p => {
        const st = toUtcDate(p.start_time);
        return !!st && st > now;
      }) || null;
      setNextUp(nxt);

      if (current) {
        const resolved = resolveSrc(current, idNum, pubRootRef.current);
        setActive(current);
        setUsingStandby(false);

        // ONLY reload the element if the src actually changed
        if (resolved && resolved !== lastSrcRef.current) {
          setVideoSrc(resolved);
          lastSrcRef.current = resolved;
          setVidState("loading");
          playerKey.current += 1;
          setTimeout(() => videoRef.current?.load(), 0);
        }

        const st = toUtcDate(current.start_time)!;
        const en = addSeconds(st, parseDurationSec(current.duration) || 1800);
        const boundary = nxt && (toUtcDate(nxt.start_time) as Date) < en
          ? (toUtcDate(nxt.start_time) as Date)
          : en;
        scheduleRefreshAt(boundary);
      } else {
        // STANDBY
        const sb: Program = {
          id: "standby",
          channel_id: idNum,
          title: "Standby Programming",
          mp4_url: `channel${idNum}/${STANDBY_FILE}`,
          start_time: now.toISOString(),
          duration: 300,
        };
        const resolved = resolveSrc(sb, idNum, pubRootRef.current);
        setActive(sb);
        setUsingStandby(true);

        if (resolved && resolved !== lastSrcRef.current) {
          setVideoSrc(resolved);
          lastSrcRef.current = resolved;
          setVidState("loading");
          playerKey.current += 1;
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

  // INITIAL ONLY (removed minute polling that was causing resets)
  useEffect(() => {
    if (!Number.isFinite(idNum)) return;
    void pickAndPlay();
  }, [idNum, pickAndPlay]);

  /* ---------- play helpers ---------- */
  async function ensurePlay() {
    const v = videoRef.current;
    if (!v) return;
    try {
      await v.play(); // normal (with sound) if allowed
      return;
    } catch {
      try {
        v.muted = true;
        await v.play(); // autoplay policy workaround
        setTimeout(() => { if (videoRef.current) videoRef.current.muted = false; }, 300);
        return;
      } catch {
        // user must press native play
      }
    }
  }

  /* ---------- render ---------- */
  const isYouTube = idNum === CH21 && (channel?.youtube_channel_id || "").trim().length > 0;

  const overlay: ReactNode = (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
      {vidState === "loading" && (
        <div className="rounded bg-black/70 px-3 py-2 text-sm">Loading video…</div>
      )}
      {vidState === "ready" && (
        <button
          type="button"
          className="pointer-events-auto rounded bg-amber-300 text-black font-semibold px-4 py-2 shadow"
          onClick={async () => {
            setVidState("loading");
            await ensurePlay();
          }}
        >
          ▶️ Press Play to start
        </button>
      )}
      {vidState === "error" && (
        <div className="rounded bg-black/70 px-3 py-2 text-sm text-red-300">
          Video failed to load.
        </div>
      )}
    </div>
  );

  // small helper to expose video states in debug
  const rs = videoRef.current?.readyState ?? 0;   // 0..4
  const ns = videoRef.current?.networkState ?? 0; // 0..3
  const errMsg = (videoRef.current as any)?.error?.message || (videoRef.current as any)?.error?.code || "";

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
      <div className="relative w-full h-full">
        <video
          key={playerKey.current}
          ref={videoRef}
          crossOrigin="anonymous"
          controls
          autoPlay={false}
          muted={false}
          playsInline
          preload="metadata"
          className="w-full h-full object-contain bg-black"
          poster={posterSrc || undefined}
          onLoadedData={() => setVidState("ready")}
          onLoadedMetadata={() => setVidState("ready")}
          onCanPlay={() => setVidState("ready")}
          onPlay={() => setVidState("playing")}
          onPlaying={() => setVidState("playing")}
          onPause={() => setVidState("ready")}
          onWaiting={() => setVidState("loading")}
          onStalled={() => setVidState("loading")}
          onEnded={() => void pickAndPlay()}
          onError={() => setVidState("error")}
        >
          <source src={videoSrc} type="video/mp4" />
        </video>
        {overlay}
      </div>
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
    content = (
      <div className="relative w-full h-full">
        <div className="w-full h-full flex items-center justify-center text-gray-400">
          Standby… waiting for next program.
        </div>
        {overlay}
      </div>
    );
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
          <div className="mt-3 text-[11px] bg-gray-900/70 border border-gray-700 rounded p-2 space-y-1">
            <div><b>Now (UTC):</b> {nowUtc().toISOString()}</div>
            {active ? (
              <>
                <div><b>Active:</b> {active.title || "(untitled)"} ({String(active.id)})</div>
                <div><b>Start (UTC):</b> {toUtcDate(active.start_time)?.toISOString() || "—"}</div>
                <div>
                  <b>End (UTC):</b>{" "}
                  {(() => {
                    const st = toUtcDate(active.start_time);
                    const dur = parseDurationSec(active.duration) || 1800;
                    return st ? addSeconds(st, dur).toISOString() : "—";
                  })()}
                </div>
              </>
            ) : <div><b>Active:</b> —</div>}
            <div className="truncate"><b>Poster (logo_url):</b> {posterSrc || "—"}</div>
            <div className="truncate">
              <b>Video Src:</b>{" "}
              {videoSrc ? <a className="underline text-sky-300" href={videoSrc} target="_blank" rel="noreferrer">{videoSrc}</a> : "—"}
            </div>
            <div><b>readyState:</b> {rs} <b>networkState:</b> {ns} {errMsg ? <span><b>err:</b> {String(errMsg)}</span> : null}</div>
          </div>
        )}
      </div>
    </div>
  );
}
