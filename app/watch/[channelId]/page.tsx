// app/watch/[channelId]/page.tsx
"use client";

import { type ReactNode, useEffect, useState, useCallback, useRef } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import VideoPlayer from "@/components/video-player";
import {
  getVideoUrlForProgram,
  fetchChannelDetails,
  supabase,
  STANDBY_PLACEHOLDER_ID,
} from "@/lib/supabase";
import type { Program, Channel } from "@/types";
import { ChevronLeft, Loader2 } from "lucide-react";
import YouTubeEmbed from "@/components/youtube-embed";

const CH21_ID_NUMERIC = 21;
/** Your 24/7 YouTube Channel ID for Channel 21 */
const YT_CH21 = "UCMkW239dyAxDyOFDP0D6p2g";

/** Channels that are *always* live on YouTube (skip schedule fetch) */
const ALWAYS_LIVE_CHANNEL_IDS = new Set<number>([CH21_ID_NUMERIC]);

/** Normalize to ignore rotating query params */
function baseUrl(u?: string | null) {
  return (u ?? "").split("?")[0];
}

export default function WatchPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();

  const channelIdString = params.channelId as string;
  // Optional: enable schedule polling for non-live channels with ?poll=1
  const pollOn = (searchParams?.get("poll") ?? "0") === "1";

  const [validatedNumericChannelId, setValidatedNumericChannelId] = useState<number | null>(null);
  const [currentProgram, setCurrentProgram] = useState<Program | null>(null);
  const [upcomingPrograms, setUpcomingPrograms] = useState<Program[]>([]);
  const [channelDetails, setChannelDetails] = useState<Channel | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [videoPlayerKey, setVideoPlayerKey] = useState(Date.now());

  // Prevent overlapping fetches
  const isFetchingRef = useRef(false);

  // Freeze values passed to the HTML player
  const stableSrcRef = useRef<string | undefined>(undefined);
  const stablePosterRef = useRef<string | undefined>(undefined);
  const stableTitleRef = useRef<string | undefined>(undefined);

  // Host ref so we can find the underlying <video> element for resume logic
  const playerHostRef = useRef<HTMLDivElement | null>(null);

  // Accept numeric id OR slug like "freedom_school"
  useEffect(() => {
    let cancelled = false;

    async function init() {
      if (!channelIdString) {
        setError("Channel ID is missing in URL.");
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError(null);

      const details = await fetchChannelDetails(channelIdString);
      if (!details) {
        if (!cancelled) {
          setError("Could not load channel details.");
          setIsLoading(false);
        }
        return;
      }
      if (cancelled) return;

      setChannelDetails(details);

      const numericId = Number.parseInt(String((details as any).id), 10);
      if (Number.isNaN(numericId)) {
        setError("Channel misconfigured: missing numeric id.");
        setIsLoading(false);
        return;
      }
      setValidatedNumericChannelId(numericId);

      // ⟵ ALWAYS-LIVE SHORT-CIRCUIT for CH 21
      if (ALWAYS_LIVE_CHANNEL_IDS.has(numericId)) {
        const liveProgram: Program = {
          id: "live-ch21-youtube",
          title: "Live Broadcast (Channel 21)",
          description: "24/7 broadcasting via YouTube.",
          channel_id: CH21_ID_NUMERIC,
          mp4_url: `youtube_channel:${YT_CH21}`, // marker for render branch
          duration: 86400 * 365, // long fake duration
          start_time: new Date(Date.now() - 3600000).toISOString(),
          poster_url: null, // no DB dependency
        };
        setCurrentProgram(liveProgram);
        stableTitleRef.current = liveProgram.title;
        // No need to set src/poster for YouTube embed branch
        setIsLoading(false);
        return; // skip schedule fetch entirely
      }

      setIsLoading(false);
    }

    init();
    return () => { cancelled = true; };
  }, [channelIdString]);

  const getStandbyMp4Program = useCallback(
    (channelNum: number, now: Date): Program => ({
      id: STANDBY_PLACEHOLDER_ID,
      title: channelNum === CH21_ID_NUMERIC ? "Channel 21 - Standby" : "Standby Programming",
      description:
        channelNum === CH21_ID_NUMERIC
          ? "Live stream currently unavailable. Standby programming will play."
          : "Programming will resume shortly.",
      channel_id: channelNum,
      mp4_url: `channel${channelNum}/standby_blacktruthtv.mp4`,
      duration: 300,
      start_time: now.toISOString(),
      poster_url: null,
    }),
    []
  );

  // Regular schedule fetch for non-always-live channels
  const fetchCurrentProgram = useCallback(
    async (numericChannelId: number) => {
      if (ALWAYS_LIVE_CHANNEL_IDS.has(numericChannelId)) return; // never fetch schedule for 24/7 live
      if (isFetchingRef.current) return;
      isFetchingRef.current = true;

      const firstLoad = !currentProgram;
      if (firstLoad) setIsLoading(true);

      const now = new Date();
      try {
        const { data: programsData, error: dbError } = await supabase
          .from("programs")
          .select("*, duration")
          .eq("channel_id", numericChannelId)
          .order("start_time", { ascending: true });

        if (dbError) throw new Error(`Database error: ${dbError.message}`);

        const programs = programsData as Program[] | null;
        const activeProgram = programs?.find((p) => {
          if (!p.start_time || typeof p.duration !== "number" || p.duration <= 0) return false;
          const start = new Date(p.start_time);
          const end = new Date(start.getTime() + p.duration * 1000);
          return now >= start && now < end;
        });

        const nextProgram = activeProgram
          ? { ...activeProgram, channel_id: numericChannelId }
          : getStandbyMp4Program(numericChannelId, now);

        // Only change if program id OR base media URL actually changed
        setCurrentProgram((prev) => {
          if (prev) {
            const prevSrc = baseUrl(prev.mp4_url);
            const nextSrc = baseUrl(nextProgram.mp4_url);
            const same = prev.id === nextProgram.id && prevSrc === nextSrc;
            if (same) return prev;
            setVideoPlayerKey(Date.now());
          }
          return nextProgram;
        });

        // Freeze props so the player doesn’t reload on harmless updates
        const fullSrc = getVideoUrlForProgram(nextProgram);
        const nextSrcBase = baseUrl(fullSrc);
        const prevSrcBase = baseUrl(stableSrcRef.current);
        if (!stableSrcRef.current || prevSrcBase !== nextSrcBase) {
          stableSrcRef.current = fullSrc;
        }
        const nextPoster = nextProgram?.poster_url || undefined; // no image_url dependency
        if (stablePosterRef.current !== nextPoster) stablePosterRef.current = nextPoster;

        const nextTitle = nextProgram?.title;
        if (stableTitleRef.current !== nextTitle) stableTitleRef.current = nextTitle;
      } catch (e: any) {
        setError(e.message);
        const fallback = getStandbyMp4Program(numericChannelId, now);
        setCurrentProgram(fallback);
        stableSrcRef.current = getVideoUrlForProgram(fallback);
        stablePosterRef.current = fallback.poster_url || undefined;
        stableTitleRef.current = fallback.title;
      } finally {
        if (firstLoad) setIsLoading(false);
        isFetchingRef.current = false;
      }
    },
    [currentProgram, getStandbyMp4Program]
  );

  const fetchUpcomingPrograms = useCallback(async (numericChannelId: number) => {
    if (ALWAYS_LIVE_CHANNEL_IDS.has(numericChannelId)) return; // no upcoming list for 24/7 live
    try {
      const now = new Date().toISOString();
      const { data, error } = await supabase
        .from("programs")
        .select("*")
        .eq("channel_id", numericChannelId)
        .gt("start_time", now)
        .order("start_time", { ascending: true })
        .limit(6);

      if (!error && data) setUpcomingPrograms(data as Program[]);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (validatedNumericChannelId === null) return;

    // For always-live channels, nothing else to do.
    if (ALWAYS_LIVE_CHANNEL_IDS.has(validatedNumericChannelId)) return;

    // Initial fetch (non-live channels only)
    fetchCurrentProgram(validatedNumericChannelId);
    fetchUpcomingPrograms(validatedNumericChannelId);

    if (!pollOn) return; // optional polling for non-live channels
    const interval = setInterval(() => {
      if (document.visibilityState === "visible") {
        fetchCurrentProgram(validatedNumericChannelId);
        fetchUpcomingPrograms(validatedNumericChannelId);
      }
    }, 60000);
    return () => clearInterval(interval);
  }, [validatedNumericChannelId, fetchCurrentProgram, fetchUpcomingPrograms, pollOn]);

  const handleProgramEnded = useCallback(() => {
    if (validatedNumericChannelId !== null && !ALWAYS_LIVE_CHANNEL_IDS.has(validatedNumericChannelId)) {
      fetchCurrentProgram(validatedNumericChannelId);
    }
  }, [validatedNumericChannelId, fetchCurrentProgram]);

  const handlePrimaryLiveStreamError = useCallback(() => {}, []);

  // Use frozen values for the player
  const frozenSrc = stableSrcRef.current;
  const frozenPoster = stablePosterRef.current;
  const frozenTitle = stableTitleRef.current;

  const isYouTubeLive = currentProgram?.id === "live-ch21-youtube";
  const shouldLoopInPlayer = currentProgram?.id === STANDBY_PLACEHOLDER_ID;

  /**
   * === CONTINUE WATCHING (save & restore) ===
   * We don’t modify VideoPlayer. Instead, we find the underlying <video> element
   * inside our player host and attach listeners.
   */
  useEffect(() => {
    if (!frozenSrc || isYouTubeLive) return; // don’t save for YouTube live
    if (!playerHostRef.current) return;

    const host = playerHostRef.current;
    const video: HTMLVideoElement | null = host.querySelector("video");
    if (!video) return;

    const base = baseUrl(frozenSrc);
    const resumeKey = `btv:resume:${base}`;
    const metaKey = `btv:resume-meta:${base}`;
    let lastSaved = 0;

    const saveMeta = () => {
      try {
        localStorage.setItem(
          metaKey,
          JSON.stringify({
            title: frozenTitle ?? null,
            channel_id: validatedNumericChannelId ?? null,
          })
        );
      } catch {}
    };

    const onLoaded = () => {
      // Restore position once
      try {
        const raw = localStorage.getItem(resumeKey);
        const t = raw ? parseFloat(raw) : 0;
        if (!Number.isNaN(t) && t > 5 && video.duration && t < video.duration - 3) {
          video.currentTime = t;
        }
      } catch {}
      saveMeta();
    };

    const saveNow = () => {
      try {
        const t = Math.floor(video.currentTime || 0);
        localStorage.setItem(resumeKey, String(t));
      } catch {}
    };

    const onTime = () => {
      const t = Math.floor(video.currentTime || 0);
      if (t - lastSaved >= 10) {
        lastSaved = t;
        saveNow();
      }
    };

    const onPause = () => saveNow();

    const onEnded = () => {
      // Clear resume when finished
      try {
        localStorage.removeItem(resumeKey);
      } catch {}
    };

    video.addEventListener("loadedmetadata", onLoaded);
    video.addEventListener("timeupdate", onTime);
    video.addEventListener("pause", onPause);
    video.addEventListener("ended", onEnded);

    return () => {
      video.removeEventListener("loadedmetadata", onLoaded);
      video.removeEventListener("timeupdate", onTime);
      video.removeEventListener("pause", onPause);
      video.removeEventListener("ended", onEnded);
    };
  }, [frozenSrc, frozenTitle, validatedNumericChannelId, isYouTubeLive]);

  let content: ReactNode;
  if (error) {
    content = <p className="text-red-400 p-4 text-center">Error: {error}</p>;
  } else if (isLoading && !currentProgram) {
    content = (
      <div className="flex flex-col items-center justify-center h-full">
        <Loader2 className="h-10 w-10 animate-spin text-red-500 mb-2" />
        <p>Loading Channel...</p>
      </div>
    );
  } else if (isYouTubeLive) {
    content = (
      <YouTubeEmbed
        channelId={YT_CH21}
        title={frozenTitle || "Channel 21 Live"}
        muted={true}
      />
    );
  } else if (currentProgram && frozenSrc) {
    content = (
      <VideoPlayer
        key={videoPlayerKey}
        src={frozenSrc}
        poster={frozenPoster}
        isStandby={shouldLoopInPlayer}
        programTitle={frozenTitle}
        onVideoEnded={handleProgramEnded}
        isPrimaryLiveStream={false}
        onPrimaryLiveStreamError={handlePrimaryLiveStreamError}
        showNoLiveNotice={false}
      />
    );
  } else {
    content = <p className="text-gray-400 p-4 text-center">Initializing channel...</p>;
  }

  return (
    <div className="bg-black min-h-screen flex flex-col text-white">
      <div className="p-4 flex items-center justify-between bg-gray-900/50 sticky top-0 z-10">
        <button onClick={() => router.back()} className="p-2 rounded-full hover:bg-gray-700" aria-label="Go back">
          <ChevronLeft className="h-6 w-6" />
        </button>
        <h1 className="text-xl font-semibold truncate px-2">
          {(channelDetails as any)?.name || `Channel ${channelIdString}`}
        </h1>
        <div className="w-10 h-10" />
      </div>

      {/* Host ref lets us grab the underlying <video> for resume logic */}
      <div ref={playerHostRef} className="w-full aspect-video bg-black flex items-center justify-center">
        {content}
      </div>

      <div className="p-4 flex-grow">
        {currentProgram && currentProgram.id !== "live-ch21-youtube" && (
          <>
            <h2 className="text-2xl font-bold">{frozenTitle}</h2>
            <p className="text-sm text-gray-400">Channel: {(channelDetails as any)?.name || `Channel ${channelIdString}`}</p>
            {currentProgram.id !== STANDBY_PLACEHOLDER_ID && currentProgram.start_time && (
              <p className="text-sm text-gray-400">
                Scheduled Start: {new Date(currentProgram.start_time).toLocaleString()}
              </p>
            )}
            <p className="text-xs text-gray-300 mt-1">{currentProgram.description}</p>

            {upcomingPrograms.length > 0 && (
              <div className="mt-6">
                <h3 className="text-lg font-semibold text-white mb-2">Upcoming Programs</h3>
                <ul className="text-sm text-gray-300 space-y-1">
                  {upcomingPrograms.map((program) => (
                    <li key={program.id}>
                      <span className="font-medium">{program.title}</span>{" "}
                      <span className="text-gray-400">
                        —{" "}
                        {new Date(program.start_time).toLocaleTimeString("en-US", {
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
          </>
        )}
      </div>
    </div>
  );
}
