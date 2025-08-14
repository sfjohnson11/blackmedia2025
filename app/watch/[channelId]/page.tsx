// app/watch/[channelId]/page.tsx — Stable player (no restarts) + YouTube live override (Channel 21)
"use client";

import { type ReactNode, useEffect, useState, useCallback, useMemo, useRef } from "react";
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

/** Your YouTube Channel ID for Channel 21 (hard-wired) */
const YT_CH21 = "UCMkW239dyAxDyOFDP0D6p2g";

/** Normalize URLs to ignore rotating query params */
function baseUrl(u?: string | null) {
  return (u ?? "").split("?")[0];
}

export default function WatchPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();

  const channelIdString = params.channelId as string;

  // Controls
  const pollOn = (searchParams?.get("poll") ?? "0") === "1";   // polling OFF by default for stability
  const forceLive = (searchParams?.get("live") ?? "") === "1"; // force YouTube live for testing

  const [validatedNumericChannelId, setValidatedNumericChannelId] = useState<number | null>(null);
  const [currentProgram, setCurrentProgram] = useState<Program | null>(null);
  const [upcomingPrograms, setUpcomingPrograms] = useState<Program[]>([]);
  const [channelDetails, setChannelDetails] = useState<Channel | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [videoPlayerKey, setVideoPlayerKey] = useState(Date.now());

  // Prevent overlapping queries
  const isFetchingRef = useRef(false);

  // Freeze values passed to the VideoPlayer (avoid reload on prop churn)
  const stableSrcRef = useRef<string | undefined>(undefined);
  const stablePosterRef = useRef<string | undefined>(undefined);
  const stableTitleRef = useRef<string | undefined>(undefined);

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

  const fetchCurrentProgram = useCallback(
    async (numericChannelId: number) => {
      if (isFetchingRef.current) return; // stop overlaps
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

        // YouTube live override for Channel 21:
        // Use your hard-wired channel ID; show live when forced (?live=1) or when your DB flag is set.
        const ytId = YT_CH21;
        const youTubeLiveOn =
          Boolean(ytId) &&
          (forceLive || (numericChannelId === CH21_ID_NUMERIC && !!channelDetails?.youtube_is_live));

        let nextProgram: Program;
        if (youTubeLiveOn) {
          nextProgram = {
            id: "live-ch21-youtube",
            title: "Live Broadcast (Channel 21)",
            description: "Currently broadcasting live via YouTube.",
            channel_id: CH21_ID_NUMERIC,
            mp4_url: `youtube_channel:${ytId}`, // marker for YouTube embed
            duration: 86400 * 7,
            start_time: new Date(Date.now() - 3600000).toISOString(),
            poster_url: channelDetails?.image_url || null,
          };
        } else if (activeProgram) {
          nextProgram = { ...activeProgram, channel_id: numericChannelId };
        } else {
          nextProgram = getStandbyMp4Program(numericChannelId, now);
        }

        // Only change if the program id OR base media URL actually changed
        setCurrentProgram((prev) => {
          if (prev) {
            const prevSrc = baseUrl(prev.mp4_url);
            const nextSrc = baseUrl(nextProgram.mp4_url);
            const same = prev.id === nextProgram.id && prevSrc === nextSrc;
            if (same) return prev; // keep object ref → no rerender → no restart
            setVideoPlayerKey(Date.now()); // real change → remount once
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
        const nextPoster = nextProgram?.poster_url || channelDetails?.image_url || undefined;
        if (stablePosterRef.current !== nextPoster) stablePosterRef.current = nextPoster;

        const nextTitle = nextProgram?.title;
        if (stableTitleRef.current !== nextTitle) stableTitleRef.current = nextTitle;
      } catch (e: any) {
        setError(e.message);
        const fallback = getStandbyMp4Program(numericChannelId, now);
        setCurrentProgram(fallback);
        stableSrcRef.current = getVideoUrlForProgram(fallback);
        stablePosterRef.current = fallback.poster_url || channelDetails?.image_url || undefined;
        stableTitleRef.current = fallback.title;
      } finally {
        if (firstLoad) setIsLoading(false);
        isFetchingRef.current = false;
      }
    },
    [channelDetails, currentProgram, forceLive, getStandbyMp4Program]
  );

  const fetchUpcomingPrograms = useCallback(async (numericChannelId: number) => {
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

    // Initial fetch only (NO polling by default)
    fetchCurrentProgram(validatedNumericChannelId);
    fetchUpcomingPrograms(validatedNumericChannelId);

    if (!pollOn) return; // enable by visiting ?poll=1

    const interval = setInterval(() => {
      if (document.visibilityState === "visible") {
        fetchCurrentProgram(validatedNumericChannelId);
        fetchUpcomingPrograms(validatedNumericChannelId);
      }
    }, 60000);

    return () => clearInterval(interval);
  }, [validatedNumericChannelId, fetchCurrentProgram, fetchUpcomingPrograms, pollOn]);

  const handleProgramEnded = useCallback(() => {
    if (validatedNumericChannelId !== null) {
      fetchCurrentProgram(validatedNumericChannelId);
    }
  }, [validatedNumericChannelId, fetchCurrentProgram]);

  const handlePrimaryLiveStreamError = useCallback(() => {}, []);

  // Use frozen values in the player
  const frozenSrc = stableSrcRef.current;
  const frozenPoster = stablePosterRef.current;
  const frozenTitle = stableTitleRef.current;

  const shouldLoopInPlayer = currentProgram?.id === STANDBY_PLACEHOLDER_ID;
  const isYouTubeLive = currentProgram?.id === "live-ch21-youtube";

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
    content = YT_CH21 ? (
      <YouTubeEmbed channelId={YT_CH21} title={frozenTitle || "Live"} muted={true} />
    ) : (
      <p className="text-gray-400 p-4 text-center">Live stream not configured.</p>
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
        <h1 className="text-xl font-semibold truncate px-2">{channelDetails?.name || `Channel ${channelIdString}`}</h1>
        <div className="w-10 h-10" />
      </div>
      <div className="w-full aspect-video bg-black flex items-center justify-center">{content}</div>
      <div className="p-4 flex-grow">
        {currentProgram && !isLoading && (
          <>
            <h2 className="text-2xl font-bold">{frozenTitle}</h2>
            <p className="text-sm text-gray-400">Channel: {channelDetails?.name || `Channel ${channelIdString}`}</p>
            {currentProgram.id !== STANDBY_PLACEHOLDER_ID &&
              currentProgram.id !== "live-ch21-youtube" &&
              currentProgram.start_time && (
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
