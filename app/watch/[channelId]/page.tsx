// app/watch/[channelId]/page.tsx
"use client";

import { type ReactNode, useEffect, useState, useCallback, useRef, useMemo } from "react";
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

// === constants / config ===
const CH21_ID_NUMERIC = 21;                             // always-live channel (YouTube)
const YT_CH21 = "UCMkW239dyAxDyOFDP0D6p2g";
const ALWAYS_LIVE_CHANNEL_IDS = new Set<number>([CH21_ID_NUMERIC]);

const DEFAULT_SECONDS = 1800;   // default 30m if duration missing/invalid
const DRIFT_SECS = 60;          // small drift tolerance

// === helpers ===
function baseUrl(u?: string | null) {
  return (u ?? "").split("?")[0];
}
function safeDurSeconds(v: unknown) {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_SECONDS;
  // guard against minutes accidentally stored as huge seconds
  return n > 24 * 3600 ? DEFAULT_SECONDS : n;
}
function isLiveSecondsUTC(p: { start_time: string; duration: number }, nowMs: number) {
  const start = new Date(p.start_time).getTime();
  const durMs = safeDurSeconds(p.duration) * 1000;
  const end = start + durMs;
  const drift = DRIFT_SECS * 1000;
  return nowMs + drift >= start && nowMs < end + drift;
}

export default function WatchPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();

  const channelIdString = params.channelId as string;
  const pollOn = (searchParams?.get("poll") ?? "0") === "1";

  const [validatedNumericChannelId, setValidatedNumericChannelId] = useState<number | null>(null);
  const [currentProgram, setCurrentProgram] = useState<Program | null>(null);
  const [upcomingPrograms, setUpcomingPrograms] = useState<Program[]>([]);
  const [channelDetails, setChannelDetails] = useState<Channel | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [videoPlayerKey, setVideoPlayerKey] = useState(Date.now());

  const isFetchingRef = useRef(false);
  const playerHostRef = useRef<HTMLDivElement | null>(null);

  const stableSrcRef = useRef<string | undefined>(undefined);
  const stablePosterRef = useRef<string | undefined>(undefined);
  const stableTitleRef = useRef<string | undefined>(undefined);

  // load channel details & validate numeric id
  useEffect(() => {
    let cancelled = false;
    (async () => {
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

      // Channel 21: hard live on YouTube, skip schedule
      if (ALWAYS_LIVE_CHANNEL_IDS.has(numericId)) {
        const liveProgram: Program = {
          id: "live-ch21-youtube",
          title: "Live Broadcast (Channel 21)",
          description: "24/7 broadcasting via YouTube.",
          channel_id: CH21_ID_NUMERIC as unknown as any,
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
    })();
    return () => {
      cancelled = true;
    };
  }, [channelIdString]);

  // standby program
  const getStandbyMp4Program = useCallback(
    (channelNum: number, now: Date): Program => ({
      id: STANDBY_PLACEHOLDER_ID,
      title: channelNum === CH21_ID_NUMERIC ? "Channel 21 - Standby" : "Standby Programming",
      description:
        channelNum === CH21_ID_NUMERIC
          ? "Live stream currently unavailable. Standby programming will play."
          : "Programming will resume shortly.",
      channel_id: channelNum as unknown as any,
      mp4_url: `channel${channelNum}/standby_blacktruthtv.mp4`,
      duration: 300,
      start_time: now.toISOString(),
      poster_url: null,
    }),
    []
  );

  // pick current program: live > next upcoming > most recent past; prefer items that have mp4_url
  const fetchCurrentProgram = useCallback(
    async (numericChannelId: number) => {
      if (ALWAYS_LIVE_CHANNEL_IDS.has(numericChannelId)) return;
      if (isFetchingRef.current) return;
      isFetchingRef.current = true;

      const firstLoad = !currentProgram;
      if (firstLoad) setIsLoading(true);

      try {
        const nowIso = new Date().toISOString();
        const nowMs = Date.now();

        // last few started
        const { data: startedRows, error: e1 } = await supabase
          .from("programs")
          .select("id, title, description, mp4_url, start_time, duration")
          .eq("channel_id", numericChannelId)
          .lte("start_time", nowIso)
          .order("start_time", { ascending: false })
          .limit(12);
        if (e1) throw new Error(e1.message);

        // first upcoming
        const { data: upcomingRows, error: e2 } = await supabase
          .from("programs")
          .select("id, title, description, mp4_url, start_time, duration")
          .eq("channel_id", numericChannelId)
          .gt("start_time", nowIso)
          .order("start_time", { ascending: true })
          .limit(6);
        if (e2) throw new Error(e2.message);

        const started = (startedRows ?? []).map(p => ({ ...p, duration: safeDurSeconds(p.duration) }));
        const upcoming = (upcomingRows ?? []).map(p => ({ ...p, duration: safeDurSeconds(p.duration) }));
        setUpcomingPrograms(upcoming as Program[]);

        // 1) If something is live, play it
        let candidate = started.find(p => isLiveSecondsUTC(p as any, nowMs)) as Program | undefined;

        // 2) Otherwise play the next upcoming immediately
        if (!candidate && upcoming.length) candidate = upcoming[0] as Program;

        // 3) Otherwise play the most recent past item
        if (!candidate && started.length) candidate = started[0] as Program;

        // 4) If chosen has empty mp4_url, try nearest item that has one
        if (candidate && (!candidate.mp4_url || candidate.mp4_url.trim() === "")) {
          const withMp4 =
            started.find(p => p.mp4_url && p.mp4_url.trim() !== "") ||
            upcoming.find(p => p.mp4_url && p.mp4_url.trim() !== "");
          candidate = (withMp4 as any) || candidate;
        }

        const chosen = candidate ?? getStandbyMp4Program(numericChannelId, new Date());

        setCurrentProgram(prev => {
          if (prev) {
            const prevSrc = baseUrl(prev.mp4_url);
            const nextSrc = baseUrl(chosen.mp4_url);
            const same = prev.id === chosen.id && prevSrc === nextSrc;
            if (same) return prev;
            setVideoPlayerKey(Date.now());
          }
          return chosen;
        });

        // freeze props for player
        const fullSrc = getVideoUrlForProgram(chosen);
        const nextSrcBase = baseUrl(fullSrc);
        const prevSrcBase = baseUrl(stableSrcRef.current);
        if (!stableSrcRef.current || prevSrcBase !== nextSrcBase) {
          stableSrcRef.current = fullSrc;
        }
        const nextPoster = (chosen as any)?.poster_url || undefined;
        if (stablePosterRef.current !== nextPoster) stablePosterRef.current = nextPoster;
        const nextTitle = (chosen as any)?.title;
        if (stableTitleRef.current !== nextTitle) stableTitleRef.current = nextTitle;
      } catch (e: any) {
        setError(`Failed to load program: ${e.message}`);
        const fallback = getStandbyMp4Program(numericChannelId, new Date());
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
    if (ALWAYS_LIVE_CHANNEL_IDS.has(numericChannelId)) return;
    try {
      const nowIso = new Date().toISOString();
      const { data, error } = await supabase
        .from("programs")
        .select("id, title, mp4_url, start_time, duration")
        .eq("channel_id", numericChannelId)
        .gt("start_time", nowIso)
        .order("start_time", { ascending: true })
        .limit(6);

      if (!error && data) setUpcomingPrograms(data as Program[]);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (validatedNumericChannelId === null) return;
    if (ALWAYS_LIVE_CHANNEL_IDS.has(validatedNumericChannelId)) return;

    fetchCurrentProgram(validatedNumericChannelId);
    fetchUpcomingPrograms(validatedNumericChannelId);

    if (!pollOn) return;
    const interval = setInterval(() => {
      if (document.visibilityState === "visible") {
        fetchCurrentProgram(validatedNumericChannelId);
        fetchUpcomingPrograms(validatedNumericChannelId);
      }
    }, 60_000);
    return () => clearInterval(interval);
  }, [validatedNumericChannelId, fetchCurrentProgram, fetchUpcomingPrograms, pollOn]);

  const handleProgramEnded = useCallback(() => {
    if (validatedNumericChannelId !== null && !ALWAYS_LIVE_CHANNEL_IDS.has(validatedNumericChannelId)) {
      fetchCurrentProgram(validatedNumericChannelId);
    }
  }, [validatedNumericChannelId, fetchCurrentProgram]);

  const handlePrimaryLiveStreamError = useCallback(() => {}, []);

  const frozenSrc = stableSrcRef.current;
  const frozenPoster = stablePosterRef.current;
  const frozenTitle = stableTitleRef.current;

  const isYouTubeLive = currentProgram?.id === "live-ch21-youtube";
  const shouldLoopInPlayer = currentProgram?.id === STANDBY_PLACEHOLDER_ID;

  // Save/restore progress for MP4 (not for YouTube live)
  useEffect(() => {
    if (!frozenSrc || isYouTubeLive) return;
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
    content = <YouTubeEmbed channelId={YT_CH21} title={frozenTitle || "Channel 21 Live"} muted={true} />;
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

      <div ref={playerHostRef} className="w-full aspect-video bg-black flex items-center justify-center">
        {content}
      </div>

      <div className="p-4 flex-grow">
        {currentProgram && currentProgram.id !== "live-ch21-youtube" && (
          <>
            <h2 className="text-2xl font-bold">{stableTitleRef.current}</h2>
            <p className="text-sm text-gray-400">Channel: {(channelDetails as any)?.name || `Channel ${channelIdString}`}</p>
            {currentProgram.id !== STANDBY_PLACEHOLDER_ID && currentProgram.start_time && (
              <p className="text-sm text-gray-400">
                Scheduled Start: {new Date(currentProgram.start_time).toLocaleString()}
              </p>
            )}
            <p className="text-xs text-gray-300 mt-1">{(currentProgram as any).description}</p>

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
