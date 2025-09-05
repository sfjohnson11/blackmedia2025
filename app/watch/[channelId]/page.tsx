// app/watch/[channelId]/page.tsx
"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import YouTubeEmbed from "@/components/youtube-embed";

/* ---------- schema (YOUR columns) ---------- */
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
  start_time: string;   // UTC string from DB ("YYYY-MM-DD HH:mm:ss") or ISO
  duration: number;     // seconds
};

/* ---------- constants ---------- */
const CH21 = 21;
const STANDBY_FILE = "standby_blacktruthtv.mp4";

/* ---------- time: STRICT UTC for selection ---------- */
function toUtcDate(val?: string | Date | null): Date | null {
  if (!val) return null;
  if (val instanceof Date) return Number.isNaN(val.getTime()) ? null : val;
  let s = String(val).trim();
  // naive DB string → interpret as UTC
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(\.\d+)?$/.test(s)) s = s.replace(" ", "T") + "Z";
  // ISO without tz → force UTC
  else if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?$/.test(s)) s = s + "Z";
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}
const addSeconds = (d: Date, secs: number) => new Date(d.getTime() + secs * 1000);

/* ---------- display: LOCAL by default, UTC if ?tz=utc ---------- */
type TzMode = "local" | "utc";
function fmtTime(isoish?: string, mode: TzMode = "local") {
  const d = toUtcDate(isoish);
  if (!d) return "—";
  if (mode === "utc") {
    return d.toLocaleString("en-US", {
      timeZone: "UTC",
      hour12: true, hour: "2-digit", minute: "2-digit", second: "2-digit", timeZoneName: "short",
    });
  }
  return d.toLocaleString([], {
    hour12: true, hour: "2-digit", minute: "2-digit", second: "2-digit", timeZoneName: "short",
  });
}

/* ---------- storage helpers (robust PUB_ROOT) ---------- */
const bucketFor = (id: number) => `channel${id}`;
const cleanKey = (k: string) => k.trim().replace(/^\.?\//, "").replace(/\\/g, "/").replace(/\/{2,}/g, "/");
const encPath  = (p: string) => p.split("/").map(encodeURIComponent).join("/");

/** derive https://xxx.supabase.co/storage/v1/object/public */
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
  return "/storage/v1/object/public"; // last resort (will 404 if wrong; shown in debug)
}

function fromBucket(pubRoot: string, bucket: string, key: string) {
  const root = pubRoot.replace(/\/+$/, "");
  return `${root}/${bucket}/${encPath(cleanKey(key))}`;
}

function resolveSrc(program: Program, channelId: number, pubRoot: string): string | undefined {
  let raw = (program?.mp4_url || "").trim();
  if (!raw) return undefined;
  if (/^https?:\/\//i.test(raw) || raw.startsWith("/")) return raw; // absolute
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
  const tzMode: TzMode = (search?.get("tz") === "utc" ? "utc" : "local");
  const debug  = (search?.get("debug") ?? "0") === "1";

  const idNum = useMemo(() => Number(channelId), [channelId]);

  // client Supabase
  const supabase = useMemo(() => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    return createClient(url, anon);
  }, []);

  const [channel, setChannel] = useState<Channel | null>(null);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [active, setActive] = useState<Program | null>(null);
  const [nextUp, setNextUp] = useState<Program | null>(null);
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

  const pickAndPlay = useCallback(async () => {
    if (!Number.isFinite(idNum)) return;

    try {
      setLoading(true); setErr(null);

      // CHANNEL (exact columns)
      const { data: ch, error: chErr } = await supabase
        .from("channels")
        .select("id, name, slug, description, logo_url, youtube_channel_id, youtube_is_live, is_active")
        .eq("id", idNum)
        .single();
      if (chErr) throw new Error(chErr.message);
      setChannel(ch as Channel);

      // PROGRAMS (exact columns)
      const { data: list, error: prErr } = await supabase
        .from("programs")
        .select("id, channel_id, title, mp4_url, start_time, duration")
        .eq("channel_id", idNum)
        .order("start_time", { ascending: true });
      if (prErr) throw new Error(prErr.message);
      const progs = (list || []) as Program[];
      setPrograms(progs);

      // PUB_ROOT — from env or derived safely from your own URLs
      pubRootRef.current = computePubRoot(ch as Channel, progs);

      // CH21 → YouTube embed if channel has a YouTube channel id
      if (idNum === CH21 && (ch?.youtube_channel_id || "").trim()) {
        setActive(null); setNextUp(null); setVideoSrc(undefined); setUsingStandby(false);
        scheduleRefreshAt(null);
        setLoading(false);
        return;
      }

      // STRICT-UTC selection
      const now = new Date();
      let current: Program | null = null;
      for (const p of progs) {
        const st = toUtcDate(p.start_time);
        const dur = Number.isFinite(Number(p.duration)) && Number(p.duration)! > 0 ? Number(p.duration)! : 1800;
        if (!st) continue;
        const en = addSeconds(st, dur);
        if (now >= st && now < en) { current = p; break; }
      }

      let next: Program | null = null;
      for (const p of progs) {
        const st = toUtcDate(p.start_time);
        if (st && st > now) { next = p; break; }
      }
      setNextUp(next);

      if (current) {
        const src = resolveSrc(current, idNum, pubRootRef.current);
        setActive(current);
        setVideoSrc(src);
        setUsingStandby(false);
        playerKey.current += 1;

        const st = toUtcDate(current.start_time)!;
        const en = addSeconds(st, Number(current.duration) || 1800);
        const boundary = next && (toUtcDate(next.start_time) as Date) < en
          ? (toUtcDate(next.start_time) as Date)
          : en;
        scheduleRefreshAt(boundary);
      } else {
        // No active → standby until next
        const sb: Program = {
          id: "standby",
          channel_id: idNum,
          title: "Standby Programming",
          mp4_url: `channel${idNum}/${STANDBY_FILE}`,
          start_time: new Date().toISOString(),
          duration: 300,
        };
        setActive(sb);
        setVideoSrc(resolveSrc(sb, idNum, pubRootRef.current));
        setUsingStandby(true);
        playerKey.current += 1;
        scheduleRefreshAt(next ? (toUtcDate(next.start_time) as Date) : null);
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
          const sb: Program = {
            id: "standby",
            channel_id: idNum,
            title: "Standby Programming",
            mp4_url: `channel${idNum}/${STANDBY_FILE}`,
            start_time: new Date().toISOString(),
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

  return (
    <div className="bg-black min-h-screen text-white">
      <div className="w-full aspect-video bg-black flex items-center justify-center">
        {content}
      </div>

      {/* Info — LOCAL by default, add ?tz=utc to show UTC */}
      <div className="p-4 space-y-3">
        {active && !isYouTube && (
          <>
            <h2 className="text-xl font-bold">{active.title || "Now Playing"}</h2>
            {active.id !== "standby" && active.start_time && (
              <>
                <p className="text-sm text-gray-400">
                  Scheduled Start ({tzMode.toUpperCase()}): {fmtTime(active.start_time, tzMode)}
                </p>
                <p className="text-xs text-gray-500">
                  {(() => {
                    const st = toUtcDate(active.start_time);
                    const dur = Number.isFinite(Number(active.duration)) && Number(active.duration)! > 0 ? Number(active.duration)! : 1800;
                    if (!st) return null;
                    const en = addSeconds(st, dur);
                    const opts: Intl.DateTimeFormatOptions = { hour12: true, hour: "2-digit", minute: "2-digit", timeZoneName: "short" };
                    if (tzMode === "utc") opts.timeZone = "UTC";
                    return <>Window ({tzMode.toUpperCase()}): {st.toLocaleTimeString([], opts)} – {en.toLocaleTimeString([], opts)}</>;
                  })()}
                </p>
              </>
            )}
            {usingStandby && <p className="text-amber-300 text-sm">Fallback: Standby asset</p>}
          </>
        )}

        {nextUp && (
          <div className="text-sm text-gray-300">
            <span className="font-medium">Next:</span>{" "}
            {nextUp.title || "Upcoming program"}{" "}
            <span className="text-gray-400">— {fmtTime(nextUp.start_time, tzMode)}</span>
          </div>
        )}

        {/* Debug always on so you can click the exact MP4 URL */}
        <div className="mt-2 text-[11px] bg-gray-900/70 border border-gray-700 rounded p-2 space-y-1">
          <div><b>PUB_ROOT:</b> {pubRootRef.current || "(empty)"}</div>
          <div><b>Programs loaded:</b> {programs.length}</div>
          {active ? (
            <>
              <div><b>Active:</b> {active.title || "(untitled)"} ({String(active.id)})</div>
              <div><b>Start (UTC raw):</b> {toUtcDate(active.start_time)?.toISOString() || "—"}</div>
              <div className="truncate">
                <b>Video Src:</b>{" "}
                {videoSrc ? <a className="underline text-sky-300" href={videoSrc} target="_blank" rel="noreferrer">{videoSrc}</a> : "—"}
              </div>
              <div><b>Using Standby:</b> {usingStandby ? "yes" : "no"}</div>
            </>
          ) : (
            <div><b>Active:</b> —</div>
          )}
        </div>
      </div>
    </div>
  );
}
