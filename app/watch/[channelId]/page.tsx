// app/watch/[channelId]/page.tsx
"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import YouTubeEmbed from "@/components/youtube-embed";

type Channel = {
  id: number;
  name?: string | null;
  logo_url?: string | null;            // poster only
  youtube_channel_id?: string | null;  // for ch21 live
  [k: string]: any;
};

type Program = {
  id: string | number;
  channel_id: number;
  title: string | null;
  mp4_url: string | null;
  start_time: string;   // UTC (accepts "YYYY-MM-DD HH:mm:ss")
  duration: number;     // seconds
};

const CH21 = 21;
const STANDBY_FILE = "standby_blacktruthtv.mp4";

// Build public root for buckets (no SDK calls)
const SUPA_URL = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/+$/, "");
const PUB_ROOT = `${SUPA_URL}/storage/v1/object/public`;

// ---------- time (treat naive as UTC) ----------
function toUtcDate(val?: string | Date | null): Date | null {
  if (!val) return null;
  if (val instanceof Date) return Number.isNaN(val.getTime()) ? null : val;
  let s = String(val).trim();
  // "YYYY-MM-DD HH:mm:ss(.sss)" → treat as UTC
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(\.\d+)?$/.test(s)) s = s.replace(" ", "T") + "Z";
  // If missing tz marker entirely, force Z
  else if (!/[zZ]|[+\-]\d{2}:\d{2}$/.test(s)) s = s + "Z";
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}
const addSeconds = (d: Date, secs: number) => new Date(d.getTime() + secs * 1000);

// ---------- storage helpers ----------
const cleanKey = (k: string) =>
  k.trim().replace(/^\.?\//, "").replace(/\\/g, "/").replace(/\/{2,}/g, "/");
const encPath = (p: string) => p.split("/").map(encodeURIComponent).join("/");
const bucketFor = (id: number) => `channel${id}`;

function standbyUrl(channelId: number) {
  return `${PUB_ROOT}/${bucketFor(channelId)}/${STANDBY_FILE}`;
}

/** Resolve MP4 source exactly (no SDK, no probing) */
function resolveSrc(program: Program, channelId: number): string | undefined {
  let raw = (program?.mp4_url || "").trim();
  if (!raw) return undefined;

  // Absolute URL / absolute path
  if (/^https?:\/\//i.test(raw) || raw.startsWith("/")) return raw;

  raw = cleanKey(raw);

  // "bucket:key" form
  const m1 = /^([a-z0-9_\-]+):(.+)$/i.exec(raw);
  if (m1) {
    const bucket = m1[1];
    const key = encPath(cleanKey(m1[2]));
    return `${PUB_ROOT}/${bucket}/${key}`;
  }

  // "storage://bucket/path"
  const m2 = /^storage:\/\/([^/]+)\/(.+)$/.exec(raw);
  if (m2) {
    const bucket = m2[1];
    const key = encPath(cleanKey(m2[2]));
    return `${PUB_ROOT}/${bucket}/${key}`;
  }

  // "bucket/path/to/file.mp4"
  const firstSeg = raw.split("/")[0];
  if (/^[a-z0-9_\-]+$/i.test(firstSeg)) {
    const bucket = firstSeg;
    const rest = encPath(cleanKey(raw.slice(firstSeg.length + 1)));
    if (rest) return `${PUB_ROOT}/${bucket}/${rest}`;
  }

  // Relative → channel{ID}/key (strip accidental "channel{ID}/")
  raw = raw.replace(new RegExp(`^channel${channelId}/`, "i"), "");
  return `${PUB_ROOT}/${bucketFor(channelId)}/${encPath(raw)}`;
}

export default function WatchPage() {
  const { channelId } = useParams<{ channelId: string }>();
  const search = useSearchParams();
  const debug = (search?.get("debug") ?? "0") === "1";

  const idNum = useMemo(() => Number(channelId), [channelId]);

  // self-contained Supabase client (client-only)
  const supabase = useMemo(() => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    return createClient(url, anon);
  }, []);

  const [channel, setChannel] = useState<Channel | null>(null);
  const [active, setActive] = useState<Program | null>(null);
  const [nextUp, setNextUp] = useState<Program | null>(null);
  const [videoSrc, setVideoSrc] = useState<string | undefined>(undefined);
  const [usingStandby, setUsingStandby] = useState(false);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const poster = channel?.logo_url || undefined;
  const playerKey = useRef(0);
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // clear any scheduled refresh on unmount
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
      setLoading(true);
      setErr(null);

      // 1) Channel details
      const { data: chRow, error: chErr } = await supabase
        .from("channels")
        .select("id, name, logo_url, youtube_channel_id")
        .eq("id", idNum)
        .single();
      if (chErr) throw new Error(chErr.message);
      setChannel(chRow as Channel);

      // CH21 → YouTube embed if configured
      if (idNum === CH21 && (chRow?.youtube_channel_id || "").trim()) {
        setActive(null);
        setNextUp(null);
        setVideoSrc(undefined);
        setUsingStandby(false);
        scheduleRefreshAt(null);
        setLoading(false);
        return;
      }

      // 2) All programs for this channel (ordered)
      const { data: list, error: prErr } = await supabase
        .from("programs")
        .select("id, channel_id, title, mp4_url, start_time, duration")
        .eq("channel_id", idNum)
        .order("start_time", { ascending: true });
      if (prErr) throw new Error(prErr.message);

      const programs = (list || []) as Program[];
      const now = new Date(); // local clock, but our parser treats naive times as UTC

      // Find ACTIVE
      let current: Program | null = null;
      for (const p of programs) {
        const st = toUtcDate(p.start_time);
        const dur = Number.isFinite(Number(p.duration)) && Number(p.duration)! > 0 ? Number(p.duration)! : 1800;
        if (!st) continue;
        const en = addSeconds(st, dur);
        if (now >= st && now < en) { current = p; break; }
      }

      // Find NEXT
      let next: Program | null = null;
      for (const p of programs) {
        const st = toUtcDate(p.start_time);
        if (st && st > now) { next = p; break; }
      }
      setNextUp(next);

      if (current) {
        const src = resolveSrc(current, idNum);
        setActive(current);
        setVideoSrc(src);
        setUsingStandby(false);
        playerKey.current += 1;

        const st = toUtcDate(current.start_time)!;
        const en = addSeconds(st, Number(current.duration) || 1800);
        const boundary = next && toUtcDate(next.start_time)! < en ? toUtcDate(next.start_time)! : en;
        scheduleRefreshAt(boundary);
      } else {
        // No active → standby until next
        setActive({
          id: "standby",
          channel_id: idNum,
          title: "Standby Programming",
          mp4_url: `channel${idNum}/${STANDBY_FILE}`,
          start_time: new Date().toISOString(),
          duration: 300,
        });
        setVideoSrc(standbyUrl(idNum));
        setUsingStandby(true);
        playerKey.current += 1;
        scheduleRefreshAt(next ? toUtcDate(next.start_time)! : null);
      }
    } catch (e: any) {
      setErr(e?.message || "Failed to load channel/programs.");
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idNum, supabase]);

  // initial + periodic refresh (minute) when visible
  useEffect(() => {
    if (!Number.isFinite(idNum)) return;
    void pickAndPlay();
    const iv = setInterval(() => {
      if (document.visibilityState === "visible") void pickAndPlay();
    }, 60_000);
    return () => clearInterval(iv);
  }, [idNum, pickAndPlay]);

  // ---------- render ----------
  const isYouTube = idNum === CH21 && (channel?.youtube_channel_id || "").trim().length > 0;

  let content: ReactNode;
  if (err) {
    content = <p className="text-red-400 p-4 text-center">Error: {err}</p>;
  } else if (loading && !active && !isYouTube) {
    content = (
      <div className="flex flex-col items-center justify-center h-full">
        <svg className="animate-spin h-10 w-10 text-red-500 mb-2" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
        </svg>
        <p>Loading…</p>
      </div>
    );
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
        autoPlay={false}               // click Play → audio intact
        muted={false}
        playsInline
        preload="metadata"
        className="w-full h-full object-contain bg-black"
        onEnded={() => void pickAndPlay()}
        onError={() => {
          // real playback error → swap to standby for this channel
          setVideoSrc(standbyUrl(idNum));
          setUsingStandby(true);
          playerKey.current += 1;
        }}
      />
    );
  } else {
    content = <p className="text-gray-400 p-4 text-center">Standby… waiting for next program.</p>;
  }

  return (
    <div className="bg-black min-h-screen flex flex-col text-white">
      <div className="w-full aspect-video bg-black flex items-center justify-center">
        {content}
      </div>

      <div className="p-4 space-y-4">
        {active && !isYouTube && (
          <>
            <h2 className="text-2xl font-bold">{active.title || "Now Playing"}</h2>
            {active.id !== "standby" && active.start_time && (
              <p className="text-sm text-gray-400">
                Scheduled Start (local): {new Date(active.start_time).toLocaleString()}
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
              — {(() => {
                const d = toUtcDate(nextUp.start_time);
                return d
                  ? d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", timeZoneName: "short" })
                  : "—";
              })()}
            </span>
          </div>
        )}

        {debug && (
          <div className="mt-2 text-xs bg-gray-900/70 border border-gray-700 rounded p-3 space-y-1">
            <div><b>Now (UTC):</b> {new Date(new Date().toISOString()).toISOString()}</div>
            {active ? (
              <>
                <div><b>Active:</b> {active.title || "(untitled)"} ({String(active.id)})</div>
                <div><b>Start (UTC):</b> {toUtcDate(active.start_time)?.toISOString() || "—"}</div>
                <div>
                  <b>End (UTC):</b>{" "}
                  {(() => {
                    const st = toUtcDate(active.start_time);
                    const dur = Number.isFinite(Number(active.duration)) && Number(active.duration)! > 0
                      ? Number(active.duration)!
                      : 1800;
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
