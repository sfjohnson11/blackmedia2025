// app/watch/[channelId]/page.tsx
"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import YouTubeEmbed from "@/components/youtube-embed";

/* ---------- YOUR schema exactly ---------- */
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
  start_time: string;              // timestamptz or "YYYY-MM-DD HH:mm:ss" UTC (with Z in your data)
  duration: number | string;       // seconds (may be text like "7620" or "7620s")
};

const CH21 = 21;
const STANDBY_FILE = "standby_blacktruthtv.mp4";

/* ---------- time: strict UTC ---------- */
const nowUtc = () => new Date(new Date().toISOString()); // pins to UTC by round-trip
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

/* ---------- robust duration parsing ---------- */
function parseDurationSec(v: number | string | null | undefined): number {
  if (typeof v === "number") return Number.isFinite(v) && v > 0 ? v : 0;
  if (v == null) return 0;
  // extract leading integer from strings like "7620", "7620s", " 7620 "
  const m = String(v).match(/^\s*(\d+)/);
  if (!m) return 0;
  const n = Number(m[1]);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/* ---------- storage helpers (robust PUB_ROOT) ---------- */
const bucketFor = (id: number) => `channel${id}`;
const cleanKey = (k: string) => k.trim().replace(/^\.?\//, "").replace(/\\/g, "/").replace(/\/{2,}/g, "/");
const encPath  = (p: string) => p.split("/").map(encodeURIComponent).join("/");

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
  const fromLogo = scan(ch?.logo_url);
  if (fromLogo) return fromLogo;
  for (const p of progs || []) {
    const x = scan(p?.mp4_url || "");
    if (x) return x;
  }
  return "/storage/v1/object/public"; // last resort (debug will show)
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

  // "bucket:key"
  const m1 = /^([a-z0-9_\-]+):(.+)$/i.exec(raw);
  if (m1) return fromBucket(pubRoot, m1[1], m1[2]);

  // "storage://bucket/path"
  const m2 = /^storage:\/\/([^/]+)\/(.+)$/.exec(raw);
  if (m2) return fromBucket(pubRoot, m2[1], m2[2]);

  // "bucket/path/file"
  const first = raw.split("/")[0];
  if (/^[a-z0-9_\-]+$/i.test(first)) {
    const rest = raw.slice(first.length + 1);
    if (rest) return fromBucket(pubRoot, first, rest);
  }

  // relative → channel{ID}/key (strip accidental prefix)
  raw = raw.replace(new RegExp(`^channel${channelId}/`, "i"), "");
  return fromBucket(pubRoot, bucketFor(channelId), raw);
}

/* ---------- component ---------- */
export default function WatchPage() {
  const { channelId } = useParams<{ channelId: string }>();
  const search = useSearchParams();
  const tzMode: "local" | "utc" = (search?.get("tz") === "utc" ? "utc" : "local");
  const debug  = (search?.get("debug") ?? "0") === "1";

  const idNum = useMemo(() => Number(channelId), [channelId]);
  const supabase = useMemo(() => createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  ), []);

  const [channel, setChannel] = useState<Channel | null>(null);
  const [startedRows, setStartedRows] = useState<Program[]>([]);
  const [nextRow, setNextRow] = useState<Program | null>(null);

  const [active, setActive] = useState<Program | null>(null);
  const [videoSrc, setVideoSrc] = useState<string | undefined>(undefined);
  const [usingStandby, setUsingStandby] = useState(false);

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const poster = channel?.logo_url || undefined;
  const playerKey = useRef(0);
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pubRootRef = useRef<string>("");

  useEffect(() => () => { if (refreshTimer.current) clearTimeout(refreshTimer.current); }, []);
  const scheduleRefreshAt = useCallback((when: Date | null) => {
    if (refreshTimer.current) clearTimeout(refreshTimer.current);
    if (!when) return;
    const delay = Math.max(0, when.getTime() - Date.now() + 1000);
    refreshTimer.current = setTimeout(() => { void pickAndPlay(); }, delay);
  }, []);

  function chooseActive(rows: Program[], now: Date): Program | null {
    // rows are "started <= now" ordered DESC; pick first that still contains now
    for (const p of rows) {
      const st = toUtcDate(p.start_time);
      const dur = parseDurationSec(p.duration);
      if (!st || dur <= 0) continue;
      const en = addSeconds(st, dur);
      if (now >= st && now < en) return p;
    }
    return null;
  }

  const pickAndPlay = useCallback(async () => {
    if (!Number.isFinite(idNum)) return;

    try {
      setLoading(true); setErr(null);
      const nowISO = nowUtc().toISOString();

      // CHANNEL — exact columns
      const { data: ch, error: chErr } = await supabase
        .from("channels")
        .select("id, name, slug, description, logo_url, youtube_channel_id, youtube_is_live, is_active")
        .eq("id", idNum)
        .single();
      if (chErr) throw new Error(chErr.message);
      setChannel(ch as Channel);

      // PUB_ROOT (env or derived)
      pubRootRef.current = computePubRoot(ch as Channel, []);

      // CH21 → YouTube (if configured)
      if (idNum === CH21 && (ch?.youtube_channel_id || "").trim()) {
        setActive(null); setVideoSrc(undefined); setUsingStandby(false);
        setStartedRows([]); setNextRow(null);
        scheduleRefreshAt(null);
        setLoading(false);
        return;
      }

      // A) last 24h started (<= now) newest first, small page
      const { data: started, error: errA } = await supabase
        .from("programs")
        .select("id, channel_id, title, mp4_url, start_time, duration")
        .eq("channel_id", idNum)
        .lte("start_time", nowISO)
        .order("start_time", { ascending: false })
        .limit(60);
      if (errA) throw new Error(errA.message);
      const startedList = (started || []) as Program[];
      setStartedRows(startedList);

      // B) next strictly after now
      const { data: next, error: errB } = await supabase
        .from("programs")
        .select("id, channel_id, title, mp4_url, start_time, duration")
        .eq("channel_id", idNum)
        .gt("start_time", nowISO)
        .order("start_time", { ascending: true })
        .limit(1);
      if (errB) throw new Error(errB.message);
      const nextOne = (next && next[0]) as Program | undefined;
      setNextRow(nextOne || null);

      const now = nowUtc();
      const current = chooseActive(startedList, now);

      if (current) {
        const src = resolveSrc(current, idNum, pubRootRef.current);
        setActive(current);
        setVideoSrc(src);
        setUsingStandby(false);
        playerKey.current += 1;

        const st = toUtcDate(current.start_time)!;
        const dur = parseDurationSec(current.duration) || 1800;
        const en = addSeconds(st, dur);
        const boundary = nextOne && toUtcDate(nextOne.start_time)! < en ? toUtcDate(nextOne.start_time)! : en;
        scheduleRefreshAt(boundary);
      } else {
        // none active → standby until next
        const sb: Program = {
          id: "standby",
          channel_id: idNum,
          title: "Standby Programming",
          mp4_url: `channel${idNum}/${STANDBY_FILE}`,
          start_time: nowISO,
          duration: 300,
        };
        setActive(sb);
        setVideoSrc(resolveSrc(sb, idNum, pubRootRef.current));
        setUsingStandby(true);
        playerKey.current += 1;
        scheduleRefreshAt(nextOne ? toUtcDate(nextOne.start_time)! : null);
      }
    } catch (e: any) {
      setErr(e?.message || "Failed to load channel/programs.");
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idNum, supabase]);

  useEffect(() => {
    if (!Number.isFinite(idNum)) return;
    void pickAndPlay();
    const iv = setInterval(() => {
      if (document.visibilityState === "visible") void pickAndPlay();
    }, 60_000);
    return () => clearInterval(iv);
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
        key={playerKey.current}
        src={videoSrc}
        poster={poster || undefined}
        controls
        autoPlay={false}   // user clicks Play → audio intact
        muted={false}
        playsInline
        preload="metadata"
        className="w-full h-full object-contain bg-black"
        onEnded={() => void pickAndPlay()}
        onError={() => {
          const sb: Program = {
            id: "standby",
            channel_id: idNum,
            title: "Standby Programming",
            mp4_url: `channel${idNum}/${STANDBY_FILE}`,
            start_time: nowUtc().toISOString(),
            duration: 300,
          };
          setActive(sb);
          setVideoSrc(resolveSrc(sb, idNum, pubRootRef.current));
          setUsingStandby(true);
          playerKey.current += 1;
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

  // tiny helpers for debug table
  const dbgRows = startedRows.slice(0, 6).map((p) => {
    const st = toUtcDate(p.start_time);
    const dur = parseDurationSec(p.duration) || 0;
    const en = st ? addSeconds(st, dur) : null;
    const now = nowUtc();
    const active = st && en ? (now >= st && now < en) : false;
    return { p, st, en, active, dur };
  });

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

        {nextRow && (
          <div className="text-sm text-gray-300">
            <span className="font-medium">Next:</span>{" "}
            {nextRow.title || "Upcoming program"}{" "}
            <span className="text-gray-400">— {toUtcDate(nextRow.start_time)?.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", timeZoneName: "short" })}</span>
          </div>
        )}

        {debug && (
          <div className="mt-3 text-[11px] bg-gray-900/70 border border-gray-700 rounded p-2 overflow-x-auto">
            <div><b>PUB_ROOT:</b> {pubRootRef.current || "(empty)"}</div>
            <div className="mt-1"><b>Started (top 6):</b></div>
            <table className="w-full text-left mt-1 border-collapse">
              <thead>
                <tr className="text-gray-400">
                  <th className="pr-3 py-1">ID</th>
                  <th className="pr-3 py-1">Title</th>
                  <th className="pr-3 py-1">Start UTC</th>
                  <th className="pr-3 py-1">End UTC</th>
                  <th className="pr-3 py-1">Dur</th>
                  <th className="pr-3 py-1">Active?</th>
                </tr>
              </thead>
              <tbody>
                {dbgRows.map(({ p, st, en, active, dur }) => (
                  <tr key={String(p.id)} className={active ? "text-emerald-300" : ""}>
                    <td className="pr-3 py-1">{String(p.id)}</td>
                    <td className="pr-3 py-1 truncate max-w-[200px]">{p.title || "(untitled)"}</td>
                    <td className="pr-3 py-1">{st ? st.toISOString() : "—"}</td>
                    <td className="pr-3 py-1">{en ? en.toISOString() : "—"}</td>
                    <td className="pr-3 py-1">{dur || "—"}</td>
                    <td className="pr-3 py-1">{active ? "YES" : "no"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="mt-1 truncate">
              <b>Video Src:</b>{" "}
              {videoSrc ? <a className="underline text-sky-300" href={videoSrc} target="_blank" rel="noreferrer">{videoSrc}</a> : "—"}
            </div>
            <div><b>Using Standby:</b> {usingStandby ? "yes" : "no"}</div>
          </div>
        )}
      </div>
    </div>
  );
}
