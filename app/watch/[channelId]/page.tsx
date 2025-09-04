// app/watch/[channelId]/page.tsx — server-time synced, UTC-safe, stable overlay player
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

// —————————————————— CONSTANTS
const CH21_ID_NUMERIC = 21;
const YT_CH21 = "UCMkW239dyAxDyOFDP0D6p2g";
const ALWAYS_LIVE_CHANNEL_IDS = new Set<number>([CH21_ID_NUMERIC]);

// SmartVideo timing
const STABLE_PLAY_MS = 1000;
const CANPLAY_TIMEOUT_MS = 7000;
const STALL_RECOVERY_MS = 3000;
const MAX_ATTEMPTS_PER_SRC = 2;

// —————————————————— HELPERS
/** Parse DB date/time as UTC (supports tz/ISO and "YYYY-MM-DD HH:mm:ss"). */
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

/** string | Promise<string> | undefined */
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

// —————————————————— SMART VIDEO (overlay + stability + recovery)
function SmartVideo({
  src,
  logo,
  onReady,
  onEnded,
  onHardFail,
}: {
  src: string;
  logo?: string;
  onReady: () => void;
  onEnded: () => void;
  onHardFail: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const [showOverlay, setShowOverlay] = useState(true);
  const [overlayText, setOverlayText] = useState("Starting stream…");
  const [dbg, setDbg] = useState<{ rs: number; ns: number; err?: number | null }>({
    rs: 0,
    ns: 0,
    err: null,
  });

  const attemptsRef = useRef(0);
  const canplayTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stablePlayTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stallTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    attemptsRef.current = 0;
    setShowOverlay(true);
    setOverlayText("Starting stream…");
    setDbg({ rs: 0, ns: 0, err: null });

    if (canplayTimer.current) clearTimeout(canplayTimer.current);
    if (stablePlayTimer.current) clearTimeout(stablePlayTimer.current);
    if (stallTimer.current) clearTimeout(stallTimer.current);

    const v = videoRef.current;
    if (v) {
      try {
        v.pause();
        v.removeAttribute("src");
        while (v.firstChild) v.removeChild(v.firstChild);
      } catch {}
      const source = document.createElement("source");
      source.src = src;
      source.type = "video/mp4"; // If HLS, swap to hls.js instead of native
      v.appendChild(source);

      v.crossOrigin = "anonymous";
      v.preload = "auto";
      v.muted = true;
      v.playsInline = true;

      setTimeout(() => {
        v.load();
        v.play().catch(() => {});
      }, 0);
    }

    canplayTimer.current = setTimeout(() => {
      tryRecoverOrFail("No canplay within timeout");
    }, CANPLAY_TIMEOUT_MS);

    return () => {
      if (canplayTimer.current) clearTimeout(canplayTimer.current);
      if (stablePlayTimer.current) clearTimeout(stablePlayTimer.current);
      if (stallTimer.current) clearTimeout(stallTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src]);

  const updateDbg = () => {
    const v = videoRef.current;
    if (!v) return;
    const err = (v.error && (v.error as any).code) || null;
    setDbg({ rs: v.readyState, ns: v.networkState, err });
  };

  const tryRecoverOrFail = (_why: string) => {
    const v = videoRef.current;
    if (!v) return;

    updateDbg();

    const mediaErr = v.error?.code ?? null; // 3: decode, 4: not supported
    if (mediaErr === 3 || mediaErr === 4) {
      setOverlayText("Switching to standby…");
      onHardFail();
      return;
    }

    if (attemptsRef.current < MAX_ATTEMPTS_PER_SRC) {
      attemptsRef.current += 1;
      setOverlayText("Recovering stream…");

      if (canplayTimer.current) clearTimeout(canplayTimer.current);
      if (stablePlayTimer.current) clearTimeout(stablePlayTimer.current);
      if (stallTimer.current) clearTimeout(stallTimer.current);

      try {
        v.pause();
        v.load();
      } catch {}
      v.play().catch(() => {});

      canplayTimer.current = setTimeout(() => {
        tryRecoverOrFail("Still no canplay after recovery");
      }, CANPLAY_TIMEOUT_MS);
    } else {
      setOverlayText("Switching to standby…");
      onHardFail();
    }
  };

  const handleCanPlay = () => {
    if (canplayTimer.current) clearTimeout(canplayTimer.current);
    updateDbg();
  };

  const handlePlaying = () => {
    updateDbg();
    if (stablePlayTimer.current) clearTimeout(stablePlayTimer.current);
    stablePlayTimer.current = setTimeout(() => {
      setShowOverlay(false);
      setOverlayText("");
      onReady();
    }, STABLE_PLAY_MS);
  };

  const handleWaiting = () => {
    updateDbg();
    if (stallTimer.current) clearTimeout(stallTimer.current);
    stallTimer.current = setTimeout(() => {
      tryRecoverOrFail("Stalled (waiting) too long");
    }, STALL_RECOVERY_MS);
  };

  const handleError = () => {
    updateDbg();
    tryRecoverOrFail("Media error");
  };

  return (
    <div className="relative w-full h-full">
      {showOverlay && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black z-10">
          {logo ? (
            <img
              src={logo}
              alt="Channel Logo"
              className="max-h-[60%] max-w-[80%] object-contain opacity-90"
            />
          ) : null}
          <div className="flex items-center gap-2 mt-4 text-gray-300">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span>{overlayText}</span>
          </div>
          {process.env.NODE_ENV !== "production" && (
            <div className="mt-3 text-[11px] text-gray-400">
              rs:{dbg.rs} ns:{dbg.ns} err:{dbg.err ?? "–"}
            </div>
          )}
        </div>
      )}

      <video
        ref={videoRef}
        key={src}
        autoPlay
        muted
        playsInline
        preload="auto"
        controls={false}
        disablePictureInPicture
        crossOrigin="anonymous"
        className="w-full h-full"
        onCanPlay={handleCanPlay}
        onPlaying={handlePlaying}
        onLoadedData={updateDbg}
        onEnded={onEnded}
        onWaiting={handleWaiting}
        onError={handleError}
      />
    </div>
  );
}

// —————————————————— PAGE (server-time synced)
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

  const [resolvedSrc, setResolvedSrc] = useState<string | undefined>(undefined);
  const [videoPlayerKey, setVideoPlayerKey] = useState(Date.now());

  // time sync
  const skewMsRef = useRef<number>(0); // serverNow - clientNow

  // race control + title cache
  const isFetchingRef = useRef(false);
  const stableTitleRef = useRef<string | undefined>(undefined);

  // fetch server time once on mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const t0 = Date.now();
        const res = await fetch("/api/now", { cache: "no-store" });
        const json = await res.json();
        const t1 = Date.now();
        const rtt = (t1 - t0) / 2;
        // Approximate server "now" when response hit the client:
        const approxServerNowAtClient = json.epochMs + rtt;
        skewMsRef.current = approxServerNowAtClient - t1; // serverNow - clientNow
      } catch {
        skewMsRef.current = 0; // fail open
      }
    })();
  }, []);

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

  // Helper to get *server* now on client
  const nowMs = () => Date.now() + skewMsRef.current;
  const nowIso = () => new Date(nowMs()).toISOString();

  const fetchCurrentProgram = useCallback(
    async (numericChannelId: number) => {
      if (ALWAYS_LIVE_CHANNEL_IDS.has(numericChannelId)) return;
      if (isFetchingRef.current) return;
      isFetchingRef.current = true;

      const firstLoad = !currentProgram;
      if (firstLoad) setIsLoading(true);

      const serverNow = nowMs();
      try {
        const { data: programsData, error: dbError } = await supabase
          .from("programs")
          .select("id, channel_id, title, mp4_url, start_time, duration")
          .eq("channel_id", numericChannelId)
          .order("start_time", { ascending: true });

        if (dbError) throw new Error(`Database error: ${dbError.message}`);

        const programs = (programsData ?? []) as Program[];

        // Active window using *server time*
        const activeProgram = programs.find((p) => {
          if (!p.start_time || typeof p.duration !== "number" || p.duration <= 0) return false;
          const start = toUtcDate(p.start_time);
          if (!start) return false;
          const startMs = start.getTime();
          const endMs = startMs + p.duration * 1000;
          return serverNow >= startMs && serverNow < endMs;
        });

        const nextProgram = activeProgram
          ? { ...activeProgram, channel_id: numericChannelId }
          : getStandbyMp4Program(numericChannelId, new Date(serverNow));

        setCurrentProgram((prev) => {
          if (prev) {
            const prevSrc = baseUrl(prev.mp4_url);
            const nextSrc = baseUrl(nextProgram.mp4_url);
            const same = prev.id === nextProgram.id && prevSrc === nextSrc;
            if (same) return prev;
          }
          return nextProgram;
        });

        const fullSrc = await resolvePlayableUrl(nextProgram);
        const effectiveSrc = fullSrc ?? nextProgram.mp4_url;

        setResolvedSrc((prev) => {
          if (prev !== effectiveSrc) {
            setVideoPlayerKey(Date.now());
            return effectiveSrc;
          }
          return prev;
        });

        stableTitleRef.current = nextProgram?.title || undefined;
      } catch (e: any) {
        setError(e.message);

        const serverNowDate = new Date(nowMs());
        const fallback = getStandbyMp4Program(numericChannelId, serverNowDate);
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
      // Use *server* now in filter
      const { data, error } = await supabase
        .from("programs")
        .select("id, channel_id, title, mp4_url, start_time, duration")
        .eq("channel_id", numericChannelId)
        .gt("start_time", nowIso())
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
    }, 12000); // quick enough for minute granularity
    return () => clearInterval(interval);
  }, [validatedNumericChannelId, fetchCurrentProgram, fetchUpcomingPrograms, pollOn]);

  const handleProgramEnded = useCallback(() => {
    if (validatedNumericChannelId !== null && !ALWAYS_LIVE_CHANNEL_IDS.has(validatedNumericChannelId)) {
      fetchCurrentProgram(validatedNumericChannelId);
    }
  }, [validatedNumericChannelId, fetchCurrentProgram]);

  // render
  const frozenTitle = stableTitleRef.current;
  const isYouTubeLive = currentProgram?.id === "live-ch21-youtube";
  const channelLogo = (channelDetails as any)?.logo_url || undefined;

  const forceStandby = useCallback(async () => {
    if (validatedNumericChannelId == null) return;
    const standby = getStandbyMp4Program(validatedNumericChannelId, new Date(nowMs()));
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
        title={frozenTitle || "Channel 21 Live"}
        muted={true}
      />
    );
  } else if (currentProgram && resolvedSrc) {
    content = (
      <SmartVideo
        key={videoPlayerKey}
        src={resolvedSrc}
        logo={channelLogo}
        onReady={() => {}}
        onEnded={handleProgramEnded}
        onHardFail={forceStandby}
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
            <h2 className="text-2xl font-bold">{frozenTitle}</h2>
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

            {/* Dev-only: show clock sync */}
            {process.env.NODE_ENV !== "production" && (
              <pre className="text-xs text-gray-500 mt-4 whitespace-pre-wrap">
                {JSON.stringify(
                  {
                    serverSkewMs: skewMsRef.current,
                    serverNowISO: nowIso(),
                    currentProgram: {
                      id: currentProgram?.id,
                      start: currentProgram?.start_time,
                      duration: currentProgram?.duration,
                    },
                  },
                  null,
                  2
                )}
              </pre>
            )}
          </>
        )}
      </div>
    </div>
  );
}
