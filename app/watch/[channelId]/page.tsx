// app/watch/[channelId]/page.tsx
"use client";

import type { ReactNode } from "react";
import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, Loader2 } from "lucide-react";

import VideoPlayer from "../../../components/video-player";
import YouTubeEmbed from "../../../components/youtube-embed";
import {
  supabase,
  fetchChannelDetails,
  getVideoUrlForProgram,
  STANDBY_PLACEHOLDER_ID,
  toUtcDate,
  addSeconds,
  type Program,
  type Channel,
} from "../../../lib/supabase";

const CH21_ID = 21;
const STANDBY_FILE = "standby_blacktruthtv.mp4";

export default function WatchPage() {
  const { channelId } = useParams<{ channelId: string }>();
  const router = useRouter();
  const search = useSearchParams();
  const debugOn = (search?.get("debug") ?? "0") === "1";

  const channelIdNum = useMemo(() => Number(channelId), [channelId]);

  const [channel, setChannel] = useState<Channel | null>(null);
  const [currentProgram, setCurrentProgram] = useState<Program | null>(null);
  const [upcomingPrograms, setUpcomingPrograms] = useState<Program[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const playerKey = useRef(0);

  // Load channel details
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setErr(null);
      const details = await fetchChannelDetails(channelId!);
      if (cancelled) return;
      setChannel(details);
      if (!details) setErr("Channel not found.");
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [channelId]);

  /** Build a minimal standby Program that resolves via getVideoUrlForProgram */
  const standbyFor = useCallback((chId: number): Program => {
    const now = new Date();
    return {
      id: STANDBY_PLACEHOLDER_ID,
      channel_id: chId,
      title: "Standby Programming",
      mp4_url: `channel${chId}/${STANDBY_FILE}`,
      duration: 300,
      start_time: now.toISOString(),
      poster_url: null,
    };
  }, []);

  /** Pick the active program (strict window); else fallback to standby. */
  const fetchCurrentProgram = useCallback(async (chId: number) => {
    setLoading(true);
    const now = new Date();
    try {
      const { data, error } = await supabase
        .from("programs")
        .select("id, channel_id, title, mp4_url, start_time, duration") // ← no description
        .eq("channel_id", chId)
        .order("start_time", { ascending: true });

      if (error) throw new Error(error.message);

      const list = (data || []) as Program[];

      // Find active program
      let active: Program | null = null;
      for (const p of list) {
        const d = Number(p.duration);
        if (!p.start_time || !Number.isFinite(d) || d <= 0) continue;
        const st = toUtcDate(p.start_time);
        if (!st) continue;
        const en = addSeconds(st, d);
        if (now >= st && now < en) {
          active = { ...p, channel_id: chId };
          break;
        }
      }

      // Channel 21 → YouTube only (don’t pass MP4 to player)
      if (chId === CH21_ID) {
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

      // Upcoming (next 6)
      const { data: up, error: upErr } = await supabase
        .from("programs")
        .select("id, channel_id, title, mp4_url, start_time, duration") // ← no description
        .eq("channel_id", chId)
        .gt("start_time", now.toISOString())
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

  const isYouTubeChannel =
    channel?.id === CH21_ID && (channel.youtube_channel_id || "").trim().length > 0;

  const videoSrc =
    currentProgram && !isYouTubeChannel ? getVideoUrlForProgram(currentProgram) : undefined;

  const posterSrc = currentProgram?.poster_url || channel?.logo_url || undefined;
  const isStandby = currentProgram?.id === STANDBY_PLACEHOLDER_ID;

  // UI
  let content: ReactNode;
  if (err) {
    content = <p className="text-red-400 p-4 text-center">Error: {err}</p>;
  } else if (loading && !currentProgram && !isYouTubeChannel) {
    content = (
      <div className="flex flex-col items-center justify-center h-full">
        <Loader2 className="h-10 w-10 animate-spin text-red-500 mb-2" />
        <p>Loading Channel...</p>
      </div>
    );
  } else if (isYouTubeChannel) {
    content = (
      <YouTubeEmbed
        channelId={channel!.youtube_channel_id as string}
        title={channel?.name ? `${channel.name} Live` : "Live"}
      />
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
        autoPlay={true}   // tries sound-first; falls back to muted if blocked
        muted={false}
        playsInline
        preload="auto"
      />
    );
  } else {
    content = <p className="text-gray-400 p-4 text-center">Initializing channel...</p>;
  }

  return (
    <div className="bg-black min-h-screen flex flex-col text-white">
      {/* header */}
      <div className="p-4 flex items-center justify-between bg-gray-900/50 sticky top-0 z-10">
        <button onClick={() => router.back()} className="p-2 rounded-full hover:bg-gray-700" aria-label="Go back">
          <ChevronLeft className="h-6 w-6" />
        </button>
        <h1 className="text-xl font-semibold truncate px-2">
          {channel?.name || `Channel ${channelId}`}
        </h1>
        <div className="w-10 h-10" />
      </div>

      {/* player */}
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
