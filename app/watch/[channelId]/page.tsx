// app/watch/[channelId]/page.tsx
"use client";

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
} from "../../../lib/supabase";

// ---- time helpers (UTC-safe) ----
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

const SAFE_DEFAULT_SECS = 1800; // 30 min default if duration missing
function programIsNow(p: { start_time: string; duration: number | null | undefined }, now = new Date()) {
  const st = toUtcDate(p.start_time);
  const dur = Number.isFinite(Number(p.duration)) && Number(p.duration)! > 0
    ? Number(p.duration)!
    : SAFE_DEFAULT_SECS;
  if (!st) return false;
  const en = addSeconds(st, dur);
  return now.getTime() >= st.getTime() - 2000 && now.getTime() < en.getTime() + 2000;
}

// ---- constants & types ----
const CH21_ID = 21;
const STANDBY_FILE = "standby_blacktruthtv.mp4";

type Channel = {
  id: number | string;
  name?: string | null;
  logo_url?: string | null;
  youtube_channel_id?: string | null;
  [k: string]: any;
};
type Program = {
  id: string | number;
  channel_id: number | string;
  title: string | null;
  mp4_url: string | null;
  start_time: string;
  duration: number | null;
  [k: string]: any;
};

export default function WatchPage() {
  const { channelId } = useParams<{ channelId: string }>();
  const search = useSearchParams();
  const debugOn = (search?.get("debug") ?? "0") === "1";

  const channelIdNum = useMemo(() => Number(channelId), [channelId]);

  const [channel, setChannel] = useState<Channel | null>(null);
  const [currentProgram, setCurrentProgram] = useState<Program | null>(null);
  const [upcomingPrograms, setUpcomingPrograms] = useState<Program[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const playerKey = useRef(0);

  // Load channel details once
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setErr(null);
      const details = await fetchChannelDetails(channelId!);
      if (cancelled) return;
      setChannel(details as any);
      if (!details) setErr("Channel not found.");
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [channelId]);

  // Standby row
  const standbyFor = useCallback((chId: number): Program => {
    const now = new Date();
    return {
      id: STANDBY_PLACEHOLDER_ID,
      channel_id: chId,
      title: "Standby Programming",
      mp4_url: `channel${chId}/${STANDBY_FILE}`,
      duration: 300,
      start_time: now.toISOString(),
    } as Program;
  }, []);

  // Fetch current/next
  const fetchCurrentProgram = useCallback(async (chId: number) => {
    setLoading(true);
    setErr(null);
    try {
      const isYouTube = chId === CH21_ID;

      const { data, error } = await supabase
        .from("programs")
        .select("id, channel_id, title, mp4_url, start_time, duration")
        .eq("channel_id", chId)
        .order("start_time", { ascending: true });

      if (error) throw new Error(error.message);

      const list = (data || []) as Program[];

      let active: Program | null = null;
      for (const p of list) {
        if (p?.start_time && programIsNow(p, new Date())) {
          active = { ...p, channel_id: chId };
          break;
        }
      }

      if (isYouTube) {
        setCurrentProgram(null);
      } else {
        if (!active) active = standbyFor(chId);
        setCurrentProgram(prev => {
          if (
            prev?.id !== active!.id ||
            prev?.mp4_url !== active!.mp4_url ||
            prev?.start_time !== active!.start_time
          ) {
            playerKey.current += 1;
          }
          return active!;
        });
      }

      const nowIso = new Date().toISOString();
      const { data: up, error: upErr } = await supabase
        .from("programs")
        .select("id, channel_id, title, mp4_url, start_time, duration")
        .eq("channel_id", chId)
        .gt("start_time", nowIso)
        .order("start_time", { ascending: true })
        .limit(6);
      if (!upErr && up) setUpcomingPrograms(up as Program[]);
    } catch (e: any) {
      setErr(e.message || "Failed to load schedule.");
      if (chId !== CH21_ID) setCurrentProgram(standbyFor(chId));
    } finally {
      setLoading(false);
    }
  }, [standbyFor]);

  // Poll every minute while visible
  useEffect(() => {
    if (!channelIdNum) return;
    void fetchCurrentProgram(channelIdNum);
    const iv = setInterval(() => {
      if (document.visibilityState === "visible") {
        void fetchCurrentProgram(channelIdNum);
      }
    }, 60_000);
    return () => clearInterval(iv);
  }, [channelIdNum, fetchCurrentProgram]);

  // Render prep
  const isYouTubeChannel =
    channel?.id === CH21_ID && (channel.youtube_channel_id || "").trim().length > 0;

  const videoSrc =
    currentProgram && !isYouTubeChannel ? getVideoUrlForProgram(currentProgram as any) : undefined;

  const posterSrc = channel?.logo_url || undefined;
  const isStandby = currentProgram?.id === STANDBY_PLACEHOLDER_ID;

  // UI
  let content: ReactNode;
  if (err) {
    content = <p className="text-red-400 p-4 text-center">Error: {err}</p>;
  } else if (isYouTubeChannel) {
    content = (
      <YouTubeEmbed
        channelId={channel!.youtube_channel_id as string}
        title={channel?.name ? `${channel.name} Live` : "Live"}
      />
    );
  } else if (loading && !currentProgram) {
    content = (
      <div className="flex flex-col items-center justify-center h-full">
        <Loader2 className="h-10 w-10 animate-spin text-red-500 mb-2" />
        <p>Loading Channel...</p>
      </div>
    );
  } else if (currentProgram && videoSrc) {
    content = (
      <VideoPlayer
        key={playerKey.current}
        src={videoSrc}
        poster={posterSrc}
        programTitle={currentProgram?.title || undefined}
        isStandby={isStandby}
        onVideoEnded={() => void fetchCurrentProgram(channelIdNum)}
        autoPlay={true}
        muted={false}
        playsInline
        preload="auto"
      />
    );
  } else {
    content = (
      <p className="text-gray-400 p-4 text-center">
        Standby… waiting for next program.
      </p>
    );
  }

  return (
    <div className="bg-black min-h-screen flex flex-col text-white">
      {/* player area */}
      <div className="w-full aspect-video bg-black flex items-center justify-center">
        {content}
      </div>

      {/* details + upcoming */}
      <div className="p-4 space-y-4">
        {currentProgram && !isYouTubeChannel && (
          <>
            <h2 className="text-2xl font-bold">{currentProgram.title || "Now Playing"}</h2>
            {currentProgram.id !== STANDBY_PLACEHOLDER_ID && currentProgram.start_time && (
              <p className="text-sm text-gray-400">
                Scheduled Start: {new Date(currentProgram.start_time).toLocaleString()}
              </p>
            )}
          </>
        )}

        {upcomingPrograms.length > 0 && (
          <div className="mt-4">
            <h3 className="text-lg font-semibold text-white mb-2">Upcoming Programs</h3>
            <ul className="text-sm text-gray-300 space-y-1">
              {upcomingPrograms.map((program) => (
                <li key={program.id}>
                  <span className="font-medium">{program.title}</span>{" "}
                  <span className="text-gray-400">
                    — {new Date(program.start_time!).toLocaleTimeString("en-US", {
                      hour: "2-digit",
                      minute: "2-digit",
                      timeZoneName: "short",
                    })}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {debugOn && (
          <div className="mt-2 text-xs bg-gray-900/70 border border-gray-700 rounded p-3 space-y-1">
            <div><b>Channel ID:</b> {channelIdNum || "—"}</div>
            <div className="truncate"><b>Video Src:</b> {videoSrc || (isYouTubeChannel ? "YouTube Live" : "—")}</div>
            <div><b>Poster (logo_url):</b> {posterSrc || "—"}</div>
            <div><b>Program ID:</b> {currentProgram?.id || (isYouTubeChannel ? "youtube-live" : "—")}</div>
          </div>
        )}
      </div>
    </div>
  );
}
