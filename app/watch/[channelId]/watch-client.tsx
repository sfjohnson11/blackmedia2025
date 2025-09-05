// app/watch/[channelId]/watch-client.tsx
"use client";

import type { ReactNode } from "react";
import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { useSearchParams } from "next/navigation";
import YouTubeEmbed from "../../../components/youtube-embed";
import { supabase, fetchChannelDetails, STANDBY_PLACEHOLDER_ID } from "../../../lib/supabase";

/* ---------- types (your schema) ---------- */
type Channel = {
  id: number;
  name?: string | null;
  logo_url?: string | null;
  youtube_channel_id?: string | null;
  [k: string]: any;
};

type Program = {
  id: string | number;
  channel_id: number;
  title: string | null;
  mp4_url: string | null;   // absolute or storage key
  start_time: string;       // UTC (accepts "YYYY-MM-DD HH:mm:ss")
  duration: number;         // seconds
};

/* ---------- constants ---------- */
const CH21 = 21;
const STANDBY_FILE = "standby_blacktruthtv.mp4";
const SAFE_DEFAULT_SECS = 1800;
const SUPA_URL = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/+$/, "");
const PUB_ROOT = `${SUPA_URL}/storage/v1/object/public`;

/* ---------- UTC helpers ---------- */
function toUtcDate(val?: string | Date | null): Date | null {
  if (!val) return null;
  if (val instanceof Date) return Number.isNaN(val.getTime()) ? null : val;
  let s = String(val).trim();
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(\.\d+)?$/.test(s)) s = s.replace(" ", "T") + "Z";
  else if (!/[zZ]|[+\-]\d{2}:\d{2}$/.test(s)) s = s + "Z";
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}
const addSeconds = (d: Date, s: number) => new Date(d.getTime() + s * 1000);
const nowUtc = () => new Date(new Date().toISOString());

function isNowUTC(p: Program, n = nowUtc()) {
  const st = toUtcDate(p.start_time);
  const dur = Number.isFinite(Number(p.duration)) && Number(p.duration)! > 0
    ? Number(p.duration)!
    : SAFE_DEFAULT_SECS;
  if (!st) return false;
  const en = addSeconds(st, dur);
  return n.getTime() >= st.getTime() && n.getTime() < en.getTime();
}

/* ---------- storage path helpers ---------- */
const cleanKey = (k: string) =>
  k.trim().replace(/^\.?\//, "").replace(/\\/g, "/").replace(/\/{2,}/g, "/");
const bucketFor = (id: number) => `channel${id}`;
const encPath = (p: string) => p.split("/").map(encodeURIComponent).join("/");

/** Build the exact public MP4 url without SDK calls. Handles:
 * - https:// absolute
 * - bucket:path/file.mp4
 * - storage://bucket/path/file.mp4
 * - bucket/path/file.mp4
 * - relative → channel{ID}/key
 */
function resolveSrc(p: Program, channelId: number): string | undefined {
  let raw = (p?.mp4_url || "").trim();
  if (!raw) return undefined;

  // Absolute URL
  if (/^https?:\/\//i.test(raw)) return raw;
  // Absolute path (from site root)
  if (raw.startsWith("/")) return raw;

  raw = cleanKey(raw);

  // 1) "bucket:path/to/file.mp4"
  const m1 = /^([a-z0-9_\-]+):(.+)$/i.exec(raw);
  if (m1) {
    const bucket = m1[1];
    const key = encPath(cleanKey(m1[2]));
    return `${PUB_ROOT}/${bucket}/${key}`;
  }

  // 2) "storage://bucket/path/to/file.mp4"
  const m2 = /^storage:\/\/([^/]+)\/(.+)$/.exec(raw);
  if (m2) {
    const bucket = m2[1];
    const key = encPath(cleanKey(m2[2]));
    return `${PUB_ROOT}/${bucket}/${key}`;
  }

  // 3) "bucket/path/to/file.mp4" → treat first segment as bucket
  const firstSeg = raw.split("/")[0];
  if (/^[a-z0-9_\-]+$/i.test(firstSeg)) {
    const bucket = firstSeg;
    const rest = encPath(cleanKey(raw.slice(firstSeg.length + 1)));
    if (rest) return `${PUB_ROOT}/${bucket}/${rest}`;
  }

  // 4) relative to this channel bucket
  raw = raw.replace(new RegExp(`^channel${channelId}/`, "i"), "");
  return `${PUB_ROOT}/${bucketFor(channelId)}/${encPath(raw)}`;
}

/* ---------- component ---------- */
export default function WatchClient({ channelId }: { channelId: string }) {
  const search = useSearchParams();
  const debug = (search?.get("debug") ?? "0") === "1";

  const idNum = useMemo(() => Number(channelId), [channelId]);

  const [channel, setChannel] = useState<Channel | null>(null);
  const [active, setActive] = useState<Program | null>(null);
  const [nextUp, setNextUp] = useState<Program | null>(null);

  const [videoSrc, setVideoSrc] = useState<string | undefined>(undefined);
  const [usingStandby, setUsingStandby] = useState(false);

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const playerKey = useRef(0);

  // Load channel (client-only)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true); setErr(null);
        const ch = await fetchChannelDetails(channelId);
        if (cancelled) return;
        if (!ch) { setErr("Channel not found."); setLoading(false); return; }
        setChannel({ id: Number((ch as any).id), ...ch });
      } catch (e: any) {
        if (!cancelled) setErr(e?.message ?? "Failed to load channel.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [channelId]);

  // Build a local standby program
  const standbyFor = useCallback((chId: number): Program => {
    const now = nowUtc();
    return {
      id: STANDBY_PLACEHOLDER_ID,
      channel_id: chId,
      title: "Standby Programming",
      mp4_url: `channel${chId}/${STANDBY_FILE}`,
      duration: 300,
      start_time: now.toISOString(),
    } as Program;
  }, []);

  const pickAndPlay = useCallback(async () => {
    if (!channel?.id) return;

    // Channel 21 → YouTube embed if configured
    if (Number(channel.id) === CH21 && (channel.youtube_channel_id || "").trim()) {
      setActive(null);
      setNextUp(null);
      setVideoSrc(undefined);
      setUsingStandby(false);
      setLoading(false);
      return;
    }

    try {
      setLoading(true); setErr(null);

      const { data, error } = await supabase
        .from("programs")
        .select("id, channel_id, title, mp4_url, start_time, duration")
        .eq("channel_id", channel.id)
        .order("start_time", { ascending: true });

      if (error) throw new Error(error.message);

      const list = (data || []) as Program[];
      const n = nowUtc();

      // Find current and next (UTC)
      let current: Program | null = null;
      for (const p of list) { if (isNowUTC(p, n)) { current = p; break; } }

      let next: Program | null = null;
      for (const p of list) {
        const st = toUtcDate(p.start_time);
        if (st && st.getTime() > n.getTime()) { next = p; break; }
      }
      setNextUp(next);

      // Choose what to play
      const chosen = current || standbyFor(Number(channel.id));
      setActive({ ...chosen, channel_id: Number(channel.id) } as Program);

      const src = resolveSrc(chosen, Number(channel.id));
      setVideoSrc(src);
      setUsingStandby(!current); // standby only if no current
      playerKey.current += 1;
    } catch (e: any) {
      setErr(e?.message ?? "Failed to load schedule.");
      const sb = standbyFor(Number(channel.id));
      setActive(sb);
      setVideoSrc(resolveSrc(sb, Number(channel.id)));
      setUsingStandby(true);
      playerKey.current += 1;
    } finally {
      setLoading(false);
    }
  }, [channel?.id, channel?.youtube_channel_id, standbyFor]);

  useEffect(() => { void pickAndPlay(); }, [pickAndPlay]);

  /* ---------- render ---------- */
  const isYouTube =
    Number(channel?.id) === CH21 && (channel?.youtube_channel_id || "").trim().length > 0;

  const poster = channel?.logo_url || undefined;

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
  } else if (loading && !active) {
    content = (
      <div className="flex flex-col items-center justify-center h-full">
        <svg className="animate-spin h-10 w-10 text-red-500 mb-2" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
        </svg>
        <p>Loading…</p>
      </div>
    );
  } else if (active && videoSrc) {
    content = (
      <div className="w-full h-full">
        <video
          key={playerKey.current}
          src={videoSrc}           // VIDEO ONLY
          poster={poster || undefined} // LOGO ONLY
          controls
          autoPlay={false}         // user clicks play → audio intact
          muted={false}
          playsInline
          preload="metadata"
          className="w-full h-full object-contain bg-black"
          onEnded={() => void pickAndPlay()}
          onError={() => {
            // if actual playback error, fall back to standby for this channel
            const sb = standbyFor(idNum);
            setActive(sb);
            setVideoSrc(resolveSrc(sb, idNum));
            setUsingStandby(true);
            playerKey.current += 1;
          }}
        />
        {debug && (
          <div className="p-2 text-xs bg-gray-900/80 border-t border-gray-800">
            <div><b>Now (UTC):</b> {nowUtc().toISOString()}</div>
            {active && (
              <>
                <div><b>Active:</b> {active.title || "(untitled)"}</div>
                <div><b>Start (UTC):</b> {toUtcDate(active.start_time)?.toISOString() || "—"}</div>
                <div>
                  <b>End (UTC):</b>{" "}
                  {(() => {
                    const st = toUtcDate(active.start_time);
                    const dur = Number.isFinite(Number(active.duration)) && Number(active.duration)! > 0
                      ? Number(active.duration)!
                      : SAFE_DEFAULT_SECS;
                    return st ? addSeconds(st, dur).toISOString() : "—";
                  })()}
                </div>
                <div className="truncate">
                  <b>Video Src:</b>{" "}
                  {videoSrc ? <a className="underline text-sky-300" href={videoSrc} target="_blank" rel="noreferrer">{videoSrc}</a> : "—"}
                </div>
                <div><b>Using Standby:</b> {usingStandby ? "yes" : "no"}</div>
              </>
            )}
          </div>
        )}
      </div>
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
            {active.id !== STANDBY_PLACEHOLDER_ID && active.start_time && (
              <p className="text-sm text-gray-400">
                Scheduled Start (local): {new Date(active.start_time).toLocaleString()}
              </p>
            )}
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
                  ? d.toLocaleTimeString("en-US", {
                      hour: "2-digit",
                      minute: "2-digit",
                      timeZoneName: "short",
                    })
                  : "—";
              })()}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
