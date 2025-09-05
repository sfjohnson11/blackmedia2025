// app/watch/[channelId]/page.tsx
"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import YouTubeEmbed from "@/components/youtube-embed";

/* ---------- schema (your exact columns) ---------- */
type Channel = {
  id: number;
  name: string | null;
  slug?: string | null;
  description?: string | null;
  logo_url: string | null;            // poster only
  youtube_channel_id: string | null;  // CH21 live
  youtube_is_live?: boolean | null;
  is_active?: boolean | null;
};

type Program = {
  id: string | number;
  channel_id: number;
  title: string | null;
  mp4_url: string | null;             // VIDEO ONLY (absolute or storage key)
  start_time: string;                 // UTC-like string (ISO Z, or "YYYY-MM-DD HH:mm:ss[Z|±HH:MM]")
  duration: number | string;          // seconds (e.g., 7620 or "7620s")
};

const CH21 = 21;
const STANDBY_FILE = "standby_blacktruthtv.mp4";

/* ---------- time (STRICT UTC for logic) ---------- */
const nowUtc = () => new Date(new Date().toISOString());

/** Parse many UTC-like forms, always as UTC. */
function toUtcDate(val?: string | Date | null): Date | null {
  if (!val) return null;
  if (val instanceof Date) return Number.isNaN(val.getTime()) ? null : val;

  let s = String(val).trim();

  // Normalize common variants → ISO UTC
  // 1) "YYYY-MM-DD HH:mm:ssZ" (space before Z/z) → "YYYY-MM-DDTHH:mm:ssZ"
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(?:\.\d+)?[zZ]$/.test(s)) {
    s = s.replace(" ", "T").replace(/[zZ]$/, "Z");
  }
  // 2) "YYYY-MM-DD HH:mm:ss±HH:MM" or "±HHMM" → add T, normalize colon
  else if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(?:\.\d+)?[+\-]\d{2}:?\d{2}$/.test(s)) {
    s = s.replace(" ", "T");
    // add colon if missing in offset
    s = s.replace(/([+\-]\d{2})(\d{2})$/, "$1:$2");
  }
  // 3) "YYYY-MM-DDTHH:mm:ss" (no tz) → force Z
  else if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?$/.test(s)) {
    s = s + "Z";
  }
  // 4) "YYYY-MM-DD HH:mm:ss" (no tz) → T + Z
  else if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(?:\.\d+)?$/.test(s)) {
    s = s.replace(" ", "T") + "Z";
  }
  // 5) Already ISO with tz ? OK.

  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

const addSeconds = (d: Date, secs: number) => new Date(d.getTime() + secs * 1000);

function parseDurationSec(v: number | string | null | undefined): number {
  if (typeof v === "number") return Number.isFinite(v) && v > 0 ? v : 0;
  if (v == null) return 0;
  const m = String(v).match(/^\s*(\d+)/); // takes "7620" from "7620s"
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

  // absolute URLs or root-relative
  if (/^https?:\/\//i.test(raw) || raw.startsWith("/")) return raw;

  raw = cleanKey(raw);

  // "bucket:key"
  const m1 = /^([a-z0-9_\-]+):(.+)$/i.exec(raw);
  if (m1) return fromBucket(m1[1], m1[2]);

  // "storage://bucket/path"
  const m2 = /^storage:\/\/([^/]+)\/(.+)$/.exec(raw);
  if (m2) return fromBucket(m2[1], m2[2]);

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

  // extra debug: show parsed windows so we can SEE why it's standby
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

      // CHANNEL (correct columns)
      const { data: ch, error: chErr } = await supabase
        .from("channels")
        .select("id, name, slug, description, logo_url, youtube_channel_id, youtube_is_live, is_active")
        .eq("id", idNum)
        .single();
      if (chErr) throw new Error(chErr.message);
      setChannel(ch as Channel);

      // CH21 → YouTube embed when channel has a YouTube id
      if (idNum === CH21 && (ch?.youtube_channel_id || "").trim()) {
        setActive(null); setNextUp(null); setVideoSrc(undefined); setUsingStandby(false);
        lastSrcRef.current = undefined;
        scheduleRefreshAt(null);
        setDbgRows([]);
        setLoading(false);
        return;
      }

      // All programs for channel (ordered)
      const { data: list, error: pErr } = await supabase
        .from("programs")
        .select("id, channel_id, title, mp4_url, start_time, duration")
        .eq("channel_id", idNum)
        .order("start_time", { ascending: true });
      if (pErr) throw new Error(pErr.message);

      const programs = (list || []) as Program[];
      const now = nowUtc();

      // Build debug rows
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
        // STANDBY loops until next
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

  // INITIAL ONLY (no minute polling that interrupts playback)
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
        autoPlay={false}          // user clicks Play (keeps audio)
        muted={false}
        playsInline
        preload="metadata"
        className="w-full h-full object-contain bg-black"
        poster={posterSrc || undefined}   // poster ONLY
        loop={usingStandby}               // standby loops until next
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
