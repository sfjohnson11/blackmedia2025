// app/watch/[channelId]/page.tsx
"use client";

import type { ReactNode } from "react";
import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, Loader2 } from "lucide-react";

import VideoPlayer from "../../../components/video-player";
import { supabase, fetchChannelDetails, getVideoUrlForProgram, STANDBY_PLACEHOLDER_ID, toUtcDate, addSeconds, type Program, type Channel } from "../../../lib/supabase";

// === constants ===
const CH21_ID = 21;
// if HLS is down we fallback to channel21 standby mp4
const HLS_LIVE_STREAM_URL_CH21 = "https://cdn.livepush.io/hls/fe96095a2d2b4314aa1789fb309e48f8/index.m3u8";

// === page ===
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
  const [hlsFailed, setHlsFailed] = useState(false);

  const playerKey = useRef(0);

  // load channel details
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true); setErr(null);
      const details = await fetchChannelDetails(channelId!);
      if (cancelled) return;
      setChannel(details);
      if (!details) setErr("Channel not found.");
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [channelId]);

  const standbyFor = useCallback((chId: number): Program => {
    const now = new Date();
    return {
      id: STANDBY_PLACEHOLDER_ID,
      channel_id: chId,
      title: chId === CH21_ID ? "Channel 21 - Standby" : "Standby Programming",
      mp4_url: `channel${chId}/standby_blacktruthtv.mp4`,
      duration: 300,
      start_time: now.toISOString(),
      poster_url: null,
      description: chId === CH21_ID ? "Live stream unavailable. Standby programming will play." : "Programming will resume shortly."
    };
  }, []);

  const fetchCurrentProgram = useCallback(async (chId: number) => {
    setLoading(true);
    const now = new Date();
    try {
      const { data, error } = await supabase
        .from("programs")
        .select("id, channel_id, title, mp4_url, start_time, duration, description")
        .eq("channel_id", chId)
        .order("start_time", { ascending: true });

      if (error) throw new Error(error.message);
      const list = (data || []) as Program[];

      // find active
      let active: Program | null = null;
      for (const p of list) {
        const d = Number(p.duration);
        if (!p.start_time || !Number.isFinite(d) || d <= 0) continue;
        const st = toUtcDate(p.start_time); if (!st) continue;
        const en = addSeconds(st, d);
        if (now >= st && now < en) { active = { ...p, channel_id: chId }; break; }
      }

      // channel 21 special: if no active, try HLS first unless we've marked it failed
      if (!active && chId === CH21_ID) {
        if (!hlsFailed) {
          active = {
            id: "live-ch21-hls",
            title: "Live Broadcast (Channel 21)",
            description: "Currently broadcasting live.",
            channel_id: CH21_ID,
            mp4_url: `/api/cors-proxy?url=${encodeURIComponent(HLS_LIVE_STREAM_URL_CH21)}`,
            duration: 24 * 3600,
            start_time: new Date(Date.now() - 3600000).toISOString(),
            poster_url: channel?.logo_url || null,
          };
        } else {
          active = standbyFor(CH21_ID);
        }
      }

      // else: if no active and not CH21 → standby
      if (!active) active = standbyFor(chId);

      setCurrentProgram(prev => {
        if (prev?.id !== active!.id || prev?.mp4_url !== active!.mp4_url || prev?.start_time !== active!.start_time) {
          playerKey.current += 1;
        }
        return active!;
      });

      // upcoming (next 6)
      const { data: up, error: upErr } = await supabase
        .from("programs")
        .select("id, channel_id, title, mp4_url, start_time, duration")
        .eq("channel_id", chId)
        .gt("start_time", now.toISOString())
        .order("start_time", { ascending: true })
        .limit(6);
      if (!upErr && up) setUpcomingPrograms(up as Program[]);
    } catch (e: any) {
      setErr(e.message || "Failed to load schedule.");
      setCurrentProgram(standbyFor(chId));
    } finally {
      setLoading(false);
    }
  }, [channel, hlsFailed, standbyFor]);

  // polling / refresh
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

  const onPrimaryLiveStreamError = useCallback(() => {
    if (channelIdNum === CH21_ID && !hlsFailed) {
      setHlsFailed(true);
      setCurrentProgram(standbyFor(CH21_ID));
      playerKey.current += 1;
    }
  }, [channelIdNum, hlsFailed, standbyFor]);

  const videoSrc = currentProgram ? getVideoUrlForProgram(currentProgram) : undefined;
  const posterSrc = currentProgram?.poster_url || channel?.logo_url || undefined;
  const isStandby = currentProgram?.id === STANDBY_PLACEHOLDER_ID;
  const isCh21Hls = currentProgram?.id === "live-ch21-hls";

  // === render ===
  let content: ReactNode;
  if (err) {
    content = <p className="text-red-400 p-4 text-center">Error: {err}</p>;
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
        onError={isCh21Hls ? onPrimaryLiveStreamError : undefined}
        autoPlay={true}     // tries sound-first; falls back to muted w/ button
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
        {currentProgram && (
          <>
            <h2 className="text-2xl font-bold">{currentProgram.title || "Now Playing"}</h2>
            {currentProgram.id !== STANDBY_PLACEHOLDER_ID &&
              currentProgram.id !== "live-ch21-hls" &&
              currentProgram.start_time && (
                <p className="text-sm text-gray-400">
                  Scheduled Start: {new Date(currentProgram.start_time).toLocaleString()}
                </p>
              )}
            {currentProgram.description && (
              <p className="text-xs text-gray-300 mt-1">{currentProgram.description}</p>
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
            <div className="truncate"><b>Video Src:</b> {videoSrc || "—"}</div>
            <div><b>Poster (logo_url):</b> {posterSrc || "—"}</div>
            <div><b>Program ID:</b> {currentProgram?.id || "—"}</div>
            <div><b>HLS failed:</b> {hlsFailed ? "yes" : "no"}</div>
          </div>
        )}
      </div>
    </div>
  );
}
