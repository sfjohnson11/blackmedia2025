// app/watch/[channelId]/page.tsx — Channel 21 is ALWAYS YouTube Live (24/7) + stable player
"use client";

import { type ReactNode, useEffect, useState, useCallback, useRef } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import {
  getVideoUrlForProgram,
  fetchChannelDetails,
  supabase,
  STANDBY_PLACEHOLDER_ID,
} from "@/lib/supabase";
import type { Program, Channel } from "@/types";
import { ChevronLeft, Loader2 } from "lucide-react";
import YouTubeEmbed from "@/components/youtube-embed";

// ------------------ CONSTANTS ------------------
const CH21_ID_NUMERIC = 21;
const YT_CH21 = "UCMkW239dyAxDyOFDP0D6p2g";
const ALWAYS_LIVE_CHANNEL_IDS = new Set<number>([CH21_ID_NUMERIC]);

// how long to wait for canplay before retrying / falling back
const CANPLAY_TIMEOUT_MS = 8000; // tweak if you want
const STALL_RECOVERY_MS = 5000;  // when "waiting" fires and playback stalls

// ------------------ HELPERS ------------------
/** Parse DB date/time as UTC (works for tz/ISO and "YYYY-MM-DD HH:mm:ss"). */
function toUtcDate(val?: string | Date | null): Date | null {
  if (!val) return null;
  if (val instanceof Date) return Number.isNaN(val.getTime()) ? null : val;

  let s = String(val).trim();
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(\.\d+)?$/.test(s)) {
    s = s.replace(" ", "T") + "Z";
  } else if (!/[zZ]|[+\-]\d{2}:\d{2}$/.test(s)) {
    s = s + "Z";
  }
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

function baseUrl(u?: string | null) {
  return (u ?? "").split("?")[0];
}

/** Safely handle string or Promise-returning getVideoUrlForProgram */
async function resolvePlayableUrl(program: Program): Promise<string | undefined> {
  try {
    const maybe = getVideoUrlForProgram(program) as unknown;
    if (maybe && typeof (maybe as any).then === "function") {
      return await (maybe as Promise<string>);
    }
    return maybe as string | undefined;
  } catch {
    return undefined;
  }
}

// ------------------ SMART VIDEO (buffer watchdog + logo overlay) ------------------
function SmartVideo({
  src,
  poster,
  onReady,
  onEnded,
  onHardFail,
  autoPlay = true,
  muted = true,
  playsInline = true,
  preload = "auto",
}: {
  src: string;
  poster?: string;
  onReady: () => void;
  onEnded: () => void;
  onHardFail: () => void;
  autoPlay?: boolean;
  muted?: boolean;
  playsInline?: boolean;
  preload?: "auto" | "metadata" | "none";
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [showOverlay, setShowOverlay] = useState(true);
  const [triedOnce, setTriedOnce] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stallRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Start watchdog each time src changes
  useEffect(() => {
    setShowOverlay(true);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      if (!triedOnce) {
        // try once to reload the same src
        setTriedOnce(true);
        const v = videoRef.current;
        if (v) {
          v.load();
          v.play().catch(() => {});
        }
        // schedule a second guard: if still not ready, hard-fail to standby
        timeoutRef.current = setTimeout(() => {
          onHardFail();
        }, CANPLAY_TIMEOUT_MS);
      } else {
        // second time: give up → standby
        onHardFail();
      }
    }, CANPLAY_TIMEOUT_MS);

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (stallRef.current) clearTimeout(stallRef.current);
    };
  }, [src, triedOnce, onHardFail]);

  const handleCanPlay = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setShowOverlay(false);
    onReady();
  };

  const handleWaiting = () => {
    // playback stalled: start a short recovery timer
    if (stallRef.current) clearTimeout(stallRef.current);
    stallRef.current = setTimeout(() => {
      // if still stalled after STALL_RECOVERY_MS, reload once or fail
      const v = videoRef.current;
      if (v) {
        v.load();
        v.play().catch(() => {});
      }
    }, STALL_RECOVERY_MS);
  };

  const handleError = () => {
    onHardFail();
  };

  return (
    <div className="relative w-full h-full">
      {/* Poster/Logo overlay */}
      {showOverlay && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black z-10">
          {/* Logo */}
          {poster ? (
            <img
              src={poster}
              alt="Channel Logo"
              className="max-h-[60%] max-w-[80%] object-contain opacity-90"
            />
          ) : null}
          <div className="flex items-center gap-2 mt-4 text-gray-300">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span>Starting stream…</span>
          </div>
        </div>
      )}

      <video
        ref={videoRef}
        key={src}
        src={src}
        poster={poster}
        autoPlay={autoPlay}
        muted={muted}
        playsInline={playsInline}
        preload={preload}
        controls={false}
        className="w-full h-full"
        onCanPlay={handleCanPlay}
        onLoadedData={() => { /* extra signal if you want */ }}
        onPlay={() => { setShowOverlay(false); }}
        onEnded={onEnded}
        onWaiting={handleWaiting}
        onError={handleError}
      />
    </div>
  );
}

// ------------------ PAGE ------------------
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

  // Resolved playable URL for the current program
  const [resolvedSrc, setResolvedSrc] = useState<string | undefined>(undefined);
  const [videoPlayerKey, setVideoPlayerKey] = useState(Date.now());

  // Refs for race control + title cache
  const isFetchingRef = useRef(false);
  const stableTitleRef = useRef<string | undefined>(undefined);

  // Init: load channel details and handle always-live CH21
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

      // Always-live channel 21 shortcut
      if (ALWAYS_LIVE_CHANNEL_IDS.has(numericId)) {
        const liveProgram: Program = {
          id: "live-ch21-youtube",
          title: "Live Broadcast (Channel 21)",
          channel_id: CH21_ID_NUMERIC,
          mp4_url: `youtube_channel:${YT_CH21}`,
          duration: 86400 * 365,
          start_time: new Date(Date.now() - 3600000).toISOString(),
        } as any;
        setCurrentProgram(liveProgram);
        stableTitleRef.current = liveProgram.title || undefined;
        setResolvedSrc(undefined); // handled by YouTubeEmbed branch
        setIsLoading(false);
        return;
      }

      setIsLoading(false);
    }

    init();
    return () => {
      cancelled = true;
    };
  }, [channelIdString]);

  const getStandbyMp4Program = useCallback(
    (channelNum: number, now: Date): Program =>
      ({
        id: STANDBY_PLACEHOLDER_ID,
        title: channelNum === CH21_ID_NUMERIC ? "Channel 21 - Standby" : "Standby Programming",
        channel_id: channelNum,
        mp4_url: `channel${channelNum}/standby_blacktruthtv.mp4`,
        duration: 300,
        start_time: now.toISOString(),
      }) as any,
    []
  );

  const fetchCurrentProgram = useCallback(
    async (numericChannelId: number) => {
      if (ALWAYS_LIVE_CHANNEL_IDS.has(numericChannelId)) return;
      if (isFetchingRef.current) return;
      isFetchingRef.current = true;

      const firstLoad = !currentProgram;
      if (firstLoad) setIsLoading(true);

      const nowUtcMs = Date.now(); // epoch ms; timezone-agnostic
      try {
        const { data: programsData, error: dbError } = await supabase
          .from("programs")
          .select("id, channel_id, title, mp4_url, start_time, duration")
          .eq("channel_id", numericChannelId)
          .order("start_time", { ascending: true });

        if (dbError) throw new Error(`Database error: ${dbError.message}`);

        const programs = (programsData ?? []) as Program[];

        const activeProgram = programs.find((p) => {
          if (!p.start_time || typeof p.duration !== "number" || p.duration <= 0) return false;
          const start = toUtcDate(p.start_time);
          if (!start) return false;
          const endMs = start.getTime() + p.duration * 1000;
          return nowUtcMs >= start.getTime() && nowUtcMs < endMs;
        });

        const nextProgram = activeProgram
          ? { ...activeProgram, channel_id: numericChannelId }
          : getStandbyMp4Program(numericChannelId, new Date(nowUtcMs));

        // Update current program state (avoid useless re-renders)
        setCurrentProgram((prev) => {
          if (prev) {
            const prevSrc = baseUrl(prev.mp4_url);
            const nextSrc = baseUrl(nextProgram.mp4_url);
            const same = prev.id === nextProgram.id && prevSrc === nextSrc;
            if (same) return prev;
          }
          return nextProgram;
        });

        // Resolve playable URL — fall back to raw mp4_url if signer returns undefined
        const fullSrc = await resolvePlayableUrl(nextProgram);
        const effectiveSrc = fullSrc ?? nextProgram.mp4_url;

        setResolvedSrc((prev) => {
          if (prev !== effectiveSrc) {
            setVideoPlayerKey(Date.now());
            return effectiveSrc;
          }
          return prev;
        });

        // Title cache
        stableTitleRef.current = nextProgram?.title || undefined;
      } catch (e: any) {
        setError(e.message);
        const now = new Date();
        const fallback = getStandbyMp4Program(numericChannelId, now);
        setCurrentProgram(fallback);

        const signed = await resolvePlayableUrl(fallback);
        const effectiveFallback = signed ?? fallback.mp4_url;

        setResolvedSrc((prev) => {
          if (prev !== effectiveFallback) {
            setVideoPlayerKey(Date.now());
            return effectiveFallback;
          }
          return prev;
        });

        stableTitleRef.current = fallback.title || undefined;
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
      const nowUtcIso = new Date().toISOString();
      const { data, error } = await supabase
        .from("programs")
        .select("id, channel_id, title, mp4_url, start_time, duration")
        .eq("channel_id", numericChannelId)
        .gt("start_time", nowUtcIso)
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
    }, 15000); // quicker polling for minute-by-minute schedules
    return () => clearInterval(interval);
  }, [validatedNumericChannelId, fetchCurrentProgram, fetchUpcomingPrograms, pollOn]);

  const handleProgramEnded = useCallback(() => {
    if (validatedNumericChannelId !== null && !ALWAYS_LIVE_CHANNEL_IDS.has(validatedNumericChannelId)) {
      fetchCurrentProgram(validatedNumericChannelId);
    }
  }, [validatedNumericChannelId, fetchCurrentProgram]);

  // ------------- RENDER -------------
  const frozenTitle = useRef<string | undefined>(undefined);
  if (currentProgram?.title) frozenTitle.current = currentProgram.title;

  const isYouTubeLive = currentProgram?.id === "live-ch21-youtube";
  const isStandby = currentProgram?.id === STANDBY_PLACEHOLDER_ID;

  const posterForThisProgram =
    (channelDetails as any)?.logo_url || undefined;

  // onHardFail: fallback to standby if current src won’t start
  const forceStandby = useCallback(async () => {
    if (validatedNumericChannelId == null) return;
    const standby = getStandbyMp4Program(validatedNumericChannelId, new Date());
    setCurrentProgram(standby);
    const signed = await resolvePlayableUrl(standby);
    const effective = signed ?? standby.mp4_url;
    setResolvedSrc((prev) => {
      if (prev !== effective) {
        setVideoPlayerKey(Date.now());
        return effective;
      }
      return prev;
    });
  }, [validatedNumericChannelId, getStandbyMp4Program]);

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
        title={frozenTitle.current || "Channel 21 Live"}
        muted={true}
      />
    );
  } else if (currentProgram && resolvedSrc) {
    // Use SmartVideo to keep logo visible until playback actually starts
    content = (
      <SmartVideo
        key={videoPlayerKey}
        src={resolvedSrc}
        poster={posterForThisProgram}
        onReady={() => { /* started successfully */ }}
        onEnded={handleProgramEnded}
        onHardFail={forceStandby}
        autoPlay
        muted
        playsInline
        preload="auto"
      />
    );
  } else {
    content = (
      <div className="flex items-center justify-center h-full text-gray-400">
        Initializing channel…
      </div>
    );
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

      <div className="w-full aspect-video bg-black flex items-center justify-center">
        {content}
      </div>

      <div className="p-4 flex-grow">
        {currentProgram && !isYouTubeLive && (
          <>
            <h2 className="text-2xl font-bold">{frozenTitle.current}</h2>
            <p className="text-sm text-gray-400">
              Channel: {(channelDetails as any)?.name || `Channel ${channelIdString}`}
            </p>
            {currentProgram.id !== STANDBY_PLACEHOLDER_ID && currentProgram.start_time && (
              <p className="text-sm text-gray-400">
                Scheduled Start:{" "}
                {(() => {
                  const d = toUtcDate(currentProgram.start_time);
                  return d ? d.toLocaleString() : "—";
                })()}
              </p>
            )}
            {upcomingPrograms.length > 0 && (
              <div className="mt-6">
                <h3 className="text-lg font-semibold text-white mb-2">Upcoming Programs</h3>
                <ul className="text-sm text-gray-300 space-y-1">
                  {upcomingPrograms.map((program) => {
                    const d = toUtcDate(program.start_time);
                    return (
                      <li key={program.id}>
                        <span className="font-medium">{program.title}</span>{" "}
                        <span className="text-gray-400">
                          —{" "}
                          {d
                            ? d.toLocaleTimeString("en-US", {
                                hour: "2-digit",
                                minute: "2-digit",
                                timeZoneName: "short",
                              })
                            : "—"}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
