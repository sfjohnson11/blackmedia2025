// app/watch/[channelId]/page.tsx — Channel 21 is ALWAYS YouTube Live (24/7) + stable player
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

  // --- resume from ?t= (seconds) + user id for progress
  const resumeSeconds = useMemo(() => {
    const t = searchParams?.get("t");
    const n = t ? parseInt(t, 10) : 0;
    return Number.isFinite(n) && n > 0 ? n : 0;
  }, [searchParams]);
  const [userId, setUserId] = useState<string | null>(null);

  // tiny helper to grab the actual <video> element rendered by VideoPlayer
  const getVideoEl = useCallback((): HTMLVideoElement | null => {
    return typeof document !== "undefined"
      ? (document.querySelector("video") as HTMLVideoElement | null)
      : null;
  }, []);

  // ---------- INIT (with robust fallback) ----------
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

      let details: Channel | null = null;
      try {
        details = await fetchChannelDetails(channelIdString);
      } catch (e) {
        // soft log; don’t break the page
        console.warn("fetchChannelDetails failed:", e);
      }
      if (cancelled) return;

      if (details) {
        setChannelDetails(details);
        const numericId = Number.parseInt(String((details as any).id), 10);
        if (Number.isNaN(numericId)) {
          setError("Channel misconfigured: missing numeric id.");
          setIsLoading(false);
          return;
        }
        setValidatedNumericChannelId(numericId);

        // Always-live short-circuit
        if (ALWAYS_LIVE_CHANNEL_IDS.has(numericId)) {
          const liveProgram: Program = {
            id: "live-ch21-youtube",
            title: "Live Broadcast (Channel 21)",
            description: "24/7 broadcasting via YouTube.",
            channel_id: CH21_ID_NUMERIC,
            mp4_url: `youtube_channel:${YT_CH21}`,
            duration: 86400 * 365,
            start_time: new Date(Date.now() - 3600000).toISOString(),
            poster_url: details?.image_url || null,
          };
          setCurrentProgram(liveProgram);
          stableTitleRef.current = liveProgram.title;
          setIsLoading(false);
          return;
        }

        setIsLoading(false);
        return;
      }

      // ---- Fallback if details couldn’t load (keeps the page working)
      const numericIdFallback = Number.parseInt(channelIdString, 10);
      if (!Number.isNaN(numericIdFallback)) {
        setValidatedNumericChannelId(numericIdFallback);
        // Minimal Channel placeholder to avoid UI nulls
        setChannelDetails({
          // @ts-expect-error: allow minimal shape to satisfy UI
          id: numericIdFallback,
          name: `Channel ${numericIdFallback}`,
          image_url: null,
          description: null,
          created_at: null,
          updated_at: null,
          slug: null,
        } as any);

        if (ALWAYS_LIVE_CHANNEL_IDS.has(numericIdFallback)) {
          const liveProgram: Program = {
            id: "live-ch21-youtube",
            title: "Live Broadcast (Channel 21)",
            description: "24/7 broadcasting via YouTube.",
            channel_id: CH21_ID_NUMERIC,
            mp4_url: `youtube_channel:${YT_CH21}`,
            duration: 86400 * 365,
            start_time: new Date(Date.now() - 3600000).toISOString(),
            poster_url: null,
          };
          setCurrentProgram(liveProgram);
          stableTitleRef.current = liveProgram.title;
          setIsLoading(false);
          return;
        }

        setIsLoading(false);
        return;
      }

      // If we get here, neither details nor numeric fallback worked
      setError("Could not load channel details.");
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
    [channelDetails, currentProgram, getStandbyMp4Program]
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

  // get the current user once (for progress attribution)
  useEffect(() => {
    let canceled = false;
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (!canceled) setUserId(data.user?.id ?? null);
    })();
    return () => { canceled = true; };
  }, []);

  // seek to ?t= when the video is ready
  useEffect(() => {
    if (!resumeSeconds) return;

    let tries = 0;
    const maxTries = 40; // ~4s
    const attempt = () => {
      const v = getVideoEl();
      if (v && !Number.isNaN(v.duration)) {
        const seekTo = Math.min(resumeSeconds, Math.floor(v.duration || resumeSeconds));
        const seek = () => { try { v.currentTime = seekTo; } catch {} };
        if (v.readyState >= 1) seek(); else v.addEventListener("loadedmetadata", seek, { once: true });
        return; // done
      }
      if (tries++ < maxTries) setTimeout(attempt, 100);
    };
    attempt();
  }, [resumeSeconds, getVideoEl, frozenSrc]);

  // save progress every ~10s and on ended
  useEffect(() => {
    if (!userId || !currentProgram) return;

    const assetId = currentProgram.id; // or baseUrl(frozenSrc)
    const assetTitle = currentProgram.title ?? null;
    const channelId = currentProgram.channel_id ?? validatedNumericChannelId ?? null;

    const v = getVideoEl();
    if (!v) return;

    let lastWrite = 0;
    const upsert = async (completed: boolean) => {
      const pos = Math.floor(v.currentTime || 0);
      const dur = Math.floor(v.duration || 0);
      try {
        await supabase.from("watch_progress").upsert({
          user_id: userId,
          asset_id: assetId,
          asset_title: assetTitle,
          channel_id: channelId,
          last_position_seconds: pos,
          duration_seconds: dur,
          completed,
          updated_at: new Date().toISOString(),
        });
      } catch {
        // fail soft
      }
    };

    const onTime = () => {
      const now = Date.now();
      if (now - lastWrite < 10_000) return; // debounce ~10s
      lastWrite = now;
      void upsert(false);
    };
    const onEnded = () => void upsert(true);

    v.addEventListener("timeupdate", onTime);
    v.addEventListener("ended", onEnded);

    // quickly create/refresh a record so /continue has metadata
    void upsert(false);

    return () => {
      v.removeEventListener("timeupdate", onTime);
      v.removeEventListener("ended", onEnded);
    };
  }, [
    userId,
    currentProgram?.id,
    currentProgram?.title,
    currentProgram?.channel_id,
    validatedNumericChannelId,
    getVideoEl,
  ]);

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
        <h1 className="text-xl font-semibold truncate px-2">{channelDetails?.name || `Channel ${channelIdString}`}</h1>
        <div className="w-10 h-10" />
      </div>
      <div className="w-full aspect-video bg-black flex items-center justify-center">{content}</div>
      <div className="p-4 flex-grow">
        {currentProgram && !isYouTubeLive && (
          <>
            <h2 className="text-2xl font-bold">{frozenTitle}</h2>
            <p className="text-sm text-gray-400">Channel: {channelDetails?.name || `Channel ${channelIdString}`}</p>
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
