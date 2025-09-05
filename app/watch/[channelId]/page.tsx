// app/watch/[channelId]/page.tsx
"use client";

export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { ReactNode } from "react";
import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";

import VideoPlayer from "../../../components/video-player";
import YouTubeEmbed from "../../../components/youtube-embed";
import {
  supabase,
  fetchChannelDetails,
  getVideoUrlForProgram,
  STANDBY_PLACEHOLDER_ID,
  type Program,
  type Channel,
} from "../../../lib/supabase";

/* ---------- CONSTANTS ---------- */
const CH21_ID = 21;
const STANDBY_FILE = "standby_blacktruthtv.mp4";
const SAFE_DEFAULT_SECS = 1800; // default duration if missing

/* ---------- UTC HELPERS ---------- */
// Treats "YYYY-MM-DD HH:mm:ss[.sss]" as UTC.
// Treats ISO without tz as UTC by appending Z.
function toUtcDate(val?: string | Date | null): Date | null {
  if (!val) return null;
  if (val instanceof Date) return Number.isNaN(val.getTime()) ? null : val;
  let s = String(val).trim();
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(\.\d+)?$/.test(s)) s = s.replace(" ", "T") + "Z";
  else if (!/[zZ]|[+\-]\d{2}:\d{2}$/.test(s)) s = s + "Z";
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}
const addSeconds = (d: Date, secs: number) => new Date(d.getTime() + secs * 1000);
const nowUtc = () => new Date(new Date().toISOString()); // explicit UTC "now"

// Active window check (all UTC)
function isNowUTC(p: Program, n = nowUtc()) {
  const st = toUtcDate(p.start_time);
  const dur = Number.isFinite(Number(p.duration)) && Number(p.duration)! > 0
    ? Number(p.duration)!
    : SAFE_DEFAULT_SECS;
  if (!st) return false;
  const en = addSeconds(st, dur);
  return n.getTime() >= st.getTime() && n.getTime() < en.getTime();
}

/* Optional: tiny reachability probe to avoid “logo only” if the file is missing */
async function reachable(url?: string): Promise<boolean> {
  if (!url) return false;
  try {
    const res = await fetch(url, { method: "GET", headers: { Range: "bytes=0-0" } });
    return res.ok || res.status === 206;
  } catch {
    return false;
  }
}

export default function WatchPage() {
  const { channelId } = useParams<{ channelId: string }>();
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

  // debug
  const [reachOk, setReachOk] = useState<boolean | null>(null);
  const playerKey = useRef(0);

  /* load channel (once) */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true); setErr(null);
      const ch = await fetchChannelDetails(channelId!);
      if (cancelled) return;
      setChannel(ch);
      if (!ch) setErr("Channel not found.");
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [channelId]);

  /* standby factory (resolves to channel{ID}/standby_blacktruthtv.mp4 via getVideoUrlForProgram) */
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

  /* resolve & set video, verifying reachability; fallback to standby if missing */
  const setVideoForProgram = useCallback(async (p: Program, chId: number) => {
    const url = getVideoUrlForProgram({ ...p, channel_id: chId } as Program);
    if (await reachable(url)) {
      setVideoSrc(url);
      setUsingStandby(p.id === STANDBY_PLACEHOLDER_ID);
      setReachOk(true);
      playerKey.current += 1;
      return;
    }
    // fallback to standby if primary missing
    const sb = standbyFor(chId);
    const sbUrl = getVideoUrlForProgram(sb);
    const ok = await reachable(sbUrl);
    setVideoSrc(ok ? sbUrl : undefined);
    setUsingStandby(true);
    setReachOk(ok);
    playerKey.current += 1;
  }, [standbyFor]);

  /* pick active/next strictly in UTC (no SQL time filters) */
  const pickAndPlay = useCallback(async () => {
    if (!channel) return;

    // Channel 21 → YouTube Live only
    if (Number(channel.id) === CH21_ID) {
      setActive(null);
      setNextUp(null);
      setVideoSrc(undefined);
      setUsingStandby(false);
      setReachOk(null);
      setLoading(false);
      return;
    }

    setLoading(true); setErr(null);
    try {
      const { data, error } = await supabase
        .from("programs")
        .select("id, channel_id, title, mp4_url, start_time, duration")
        .eq("channel_id", channel.id)
        .order("start_time", { ascending: true }); // no .gt/.lt → we do UTC math in JS

      if (error) throw new Error(error.message);
      const list = (data || []) as Program[];

      const n = nowUtc();

      // ACTIVE (UTC)
      let current: Program | null = null;
      for (const p of list) { if (isNowUTC(p, n)) { current = p; break; } }

      // NEXT (UTC)
      let next: Program | null = null;
      for (const p of list) {
        const st = toUtcDate(p.start_time);
        if (st && st.getTime() > n.getTime()) { next = p; break; }
      }
      setNextUp(next);

      // If nothing active → standby (until next boundary)
      const chosen = current || standbyFor(Number(channel.id));
      setActive({ ...chosen, channel_id: Number(channel.id) } as Program);

      await setVideoForProgram(chosen, Number(channel.id));
    } catch (e: any) {
      setErr(e.message || "Failed to load schedule.");
      const sb = standbyFor(Number(channel.id));
      setActive(sb);
      await setVideoForProgram(sb, Number(channel.id));
    } finally {
      setLoading(false);
    }
  }, [channel, setVideoForProgram, standbyFor]);

  useEffect(() => { if (channel?.id) void pickAndPlay(); }, [channel?.id, pickAndPlay]);

  /* render prep */
  const isYouTube =
    Number(channel?.id) === CH21_ID && (channel?.youtube_channel_id || "").trim().length > 0;

  const poster = channel?.logo_url || undefined;

  /* ---------- RENDER ---------- */
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
        <Loader2 className="h-10 w-10 animate-spin text-red-500 mb-2" />
        <p>Loading…</p>
      </div>
    );
  } else if (active && videoSrc) {
    content = (
      <VideoPlayer
        key={playerKey.current}
        src={videoSrc}                 // VIDEO ONLY
        poster={poster}                // poster ONLY
        programTitle={active.title || undefined}
        isStandby={active.id === STANDBY_PLACEHOLDER_ID}
        onVideoEnded={() => void pickAndPlay()}
        onError={() => void pickAndPlay()}
        autoPlay={true}
        muted={false}
        playsInline
        preload="auto"
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
            {active.id !== STANDBY_PLACEHOLDER_ID && active.start_time && (
              <p className="text-sm text-gray-400">
                Scheduled Start (your local): {new Date(active.start_time).toLocaleString()}
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

        {debug && (
          <div className="mt-2 text-xs bg-gray-900/70 border border-gray-700 rounded p-3 space-y-1">
            <div><b>Now (UTC):</b> {nowUtc().toISOString()}</div>
            {active ? (
              <>
                <div><b>Active start (UTC):</b> {toUtcDate(active.start_time)?.toISOString() || "—"}</div>
                <div>
                  <b>Active end (UTC):</b>{" "}
                  {(() => {
                    const st = toUtcDate(active.start_time);
                    const dur = Number.isFinite(Number(active.duration)) && Number(active.duration)! > 0
                      ? Number(active.duration)!
                      : SAFE_DEFAULT_SECS;
                    return st ? addSeconds(st, dur).toISOString() : "—";
                  })()}
                </div>
              </>
            ) : (
              <div><b>Active:</b> —</div>
            )}
            <div className="truncate"><b>Video Src:</b> {videoSrc || (isYouTube ? "YouTube Live" : "—")}</div>
            <div><b>Using Standby:</b> {usingStandby ? "yes" : "no"}</div>
            <div><b>Reachable:</b> {reachOk === null ? "n/a" : reachOk ? "yes" : "NO"}</div>
          </div>
        )}
      </div>
    </div>
  );
}
