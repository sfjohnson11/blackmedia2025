// app/watch/[channelId]/page.tsx
// MP4-only + YouTube, UTC-safe, stable overlay, branded navbar, hydration-safe
"use client";

import { type ReactNode, useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
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

/* ------------------------------ BRAND / NAV ------------------------------ */

const BRAND_NAME = "Black Truth TV";
const DEFAULT_PUBLIC_LOGO = "/brand/blacktruth-logo.png"; // place your file at public/brand/blacktruth-logo.png
const DEFAULT_BUCKET = "brand"; // if you store logo in a Supabase public bucket

function TopNav({
  channelName,
  logoSrc,
  showBack = false,
}: {
  channelName?: string;
  logoSrc?: string;
  showBack?: boolean;
}) {
  return (
    <header className="sticky top-0 z-20 bg-gradient-to-b from-black/80 to-black/40 backdrop-blur supports-[backdrop-filter]:bg-black/60 border-b border-white/10">
      <div className="mx-auto max-w-7xl px-3 sm:px-4">
        <div className="h-14 sm:h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {showBack ? (
              <Link
                href="/"
                className="p-2 rounded-full hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-white/20"
                aria-label="Go home"
              >
                <ChevronLeft className="h-6 w-6" />
              </Link>
            ) : null}

            <Link href="/" className="flex items-center gap-2">
              <div className="h-9 w-9 sm:h-10 sm:w-10 rounded-md overflow-hidden ring-1 ring-white/10 flex items-center justify-center bg-black/30">
                {/* plain <img> keeps things simple (no next/image config) */}
                <img
                  src={logoSrc || DEFAULT_PUBLIC_LOGO}
                  alt="Black Truth TV Logo"
                  className="h-full w-full object-contain"
                />
              </div>
              <div className="leading-tight">
                <div className="text-white font-extrabold tracking-tight text-sm sm:text-base">
                  {BRAND_NAME}
                </div>
                {channelName ? (
                  <div className="text-[10px] sm:text-xs text-white/70">{channelName}</div>
                ) : null}
              </div>
            </Link>
          </div>

          <nav className="hidden md:flex items-center gap-6 text-sm">
            <Link href="/" className="hover:text-white/90 text-white/70">Home</Link>
            <Link href="/guide" className="hover:text-white/90 text-white/70">Guide</Link>
            <Link href="/channels" className="hover:text-white/90 text-white/70">Channels</Link>
            <Link href="/about" className="hover:text-white/90 text-white/70">About</Link>
            <Link href="/contact" className="hover:text-white/90 text-white/70">Contact</Link>
          </nav>

          <div className="flex items-center gap-2">
            <Link
              href="/donate"
              className="inline-flex items-center justify-center rounded-full px-4 py-2 text-sm font-semibold
                         text-black bg-amber-300 hover:bg-amber-200 focus:outline-none focus:ring-2 focus:ring-amber-400
                         shadow-[0_1px_0_rgba(255,255,255,0.2)_inset,0_1px_12px_rgba(0,0,0,0.35)]"
            >
              Donate
            </Link>
          </div>
        </div>

        {/* Mobile quick links */}
        <div className="md:hidden py-2 flex items-center justify-center gap-5 text-xs border-t border-white/10">
          <Link href="/guide" className="hover:text-white text-white/80">Guide</Link>
          <Link href="/channels" className="hover:text-white text-white/80">Channels</Link>
          <Link href="/about" className="hover:text-white text-white/80">About</Link>
          <Link href="/contact" className="hover:text-white text-white/80">Contact</Link>
        </div>
      </div>
    </header>
  );
}

/* --------------------------- PLAYER / SCHEDULING -------------------------- */

const CH21_ID_NUMERIC = 21;
const YT_CH21 = "UCMkW239dyAxDyOFDP0D6p2g";
const ALWAYS_LIVE_CHANNEL_IDS = new Set<number>([CH21_ID_NUMERIC]);

// Player timings
const STABLE_PLAY_MS = 1000;
const CANPLAY_TIMEOUT_MS = 7000;
const STALL_RECOVERY_MS = 3000;
const MAX_ATTEMPTS_PER_SRC = 2;

// Grace windows so minute-by-minute grids don’t “miss” a tick on slight skew
const START_EARLY_GRACE_MS = 30_000;
const END_LATE_GRACE_MS = 15_000;

/* --------------------------------- Helpers -------------------------------- */

function toUtcDate(val?: string | Date | null): Date | null {
  if (!val) return null;
  if (val instanceof Date) return Number.isNaN(val.getTime()) ? null : val;
  let s = String(val).trim();
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(\.\d+)?$/.test(s)) s = s.replace(" ", "T") + "Z";
  else if (!/[zZ]|[+\-]\d{2}:\d{2}$/.test(s)) s = s + "Z";
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}
function baseUrl(u?: string | null) {
  return (u ?? "").split("?")[0];
}
async function resolvePlayableUrl(program: Program): Promise<string | undefined> {
  try {
    const maybe = getVideoUrlForProgram(program) as unknown;
    if (maybe && typeof (maybe as any).then === "function") return await (maybe as Promise<string>);
    return maybe as string | undefined;
  } catch {
    return undefined;
  }
}

/* ------------------------- MP4-only SmartVideo UI ------------------------- */

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
  const attemptsRef = useRef(0);
  const canplayTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stablePlayTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stallTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    attemptsRef.current = 0;
    setShowOverlay(true);
    setOverlayText("Starting stream…");

    if (canplayTimer.current) clearTimeout(canplayTimer.current);
    if (stablePlayTimer.current) clearTimeout(stablePlayTimer.current);
    if (stallTimer.current) clearTimeout(stallTimer.current);

    const v = videoRef.current;
    if (!v) return;

    try {
      v.pause();
      v.removeAttribute("src");
      while (v.firstChild) v.removeChild(v.firstChild);
    } catch {}

    v.crossOrigin = "anonymous";
    v.preload = "auto";
    v.muted = true;
    v.playsInline = true;
    v.src = src;
    v.currentTime = 0;

    setTimeout(() => {
      v.load();
      v.play().catch(() => {});
    }, 0);

    canplayTimer.current = setTimeout(() => {
      tryRecoverOrFail();
    }, CANPLAY_TIMEOUT_MS);

    return () => {
      if (canplayTimer.current) clearTimeout(canplayTimer.current);
      if (stablePlayTimer.current) clearTimeout(stablePlayTimer.current);
      if (stallTimer.current) clearTimeout(stallTimer.current);
      try {
        v.pause();
        v.removeAttribute("src");
        v.load();
      } catch {}
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src]);

  const tryRecoverOrFail = () => {
    const v = videoRef.current;
    if (!v) return;

    const mediaErr = v.error?.code ?? null; // 3 decode, 4 src unsupported
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
        tryRecoverOrFail();
      }, CANPLAY_TIMEOUT_MS);
    } else {
      setOverlayText("Switching to standby…");
      onHardFail();
    }
  };

  return (
    <div className="relative w-full h-full">
      {showOverlay && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black z-10">
          {logo ? (
            <img
              src={logo}
              alt="Channel Logo"
              className="max-h-[60%] max-w-[80%] object-contain drop-shadow-[0_8px_28px_rgba(0,0,0,0.45)]"
            />
          ) : null}
          <div className="flex items-center gap-2 mt-4 text-gray-300">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span>{overlayText}</span>
          </div>
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
        onCanPlay={() => {
          if (canplayTimer.current) clearTimeout(canplayTimer.current);
        }}
        onPlaying={() => {
          if (stablePlayTimer.current) clearTimeout(stablePlayTimer.current);
          stablePlayTimer.current = setTimeout(() => {
            setShowOverlay(false);
            setOverlayText("");
            onReady();
          }, STABLE_PLAY_MS);
        }}
        onWaiting={() => {
          if (stallTimer.current) clearTimeout(stallTimer.current);
          stallTimer.current = setTimeout(() => tryRecoverOrFail(), STALL_RECOVERY_MS);
        }}
        onError={() => tryRecoverOrFail()}
        onEnded={onEnded}
      />
    </div>
  );
}

/* ---------------------------------- PAGE ---------------------------------- */

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

  // hydration-safe key (no Date.now() at render)
  const [videoPlayerKey, setVideoPlayerKey] = useState(0);
  useEffect(() => { setVideoPlayerKey(1); }, []);

  // Build a logo URL from either channelDetails.logo_url (full URL or path in bucket)
  const [logoSrc, setLogoSrc] = useState<string>(DEFAULT_PUBLIC_LOGO);
  useEffect(() => {
    const raw = (channelDetails as any)?.logo_url as string | undefined;
    if (!raw) {
      setLogoSrc(DEFAULT_PUBLIC_LOGO);
      return;
    }
    if (raw.startsWith("http") || raw.startsWith("/")) {
      setLogoSrc(raw);
      return;
    }
    // treat as path in DEFAULT_BUCKET
    const { data } = supabase.storage.from(DEFAULT_BUCKET).getPublicUrl(raw);
    setLogoSrc(data.publicUrl || DEFAULT_PUBLIC_LOGO);
  }, [channelDetails]);

  const isFetchingRef = useRef(false);
  const stableTitleRef = useRef<string | undefined>(undefined);

  // Init: load channel details and handle CH21 (YouTube live)
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

  const isActiveWindow = (start: Date, durationSec: number, nowMs: number) => {
    const startMs = start.getTime();
    const endMs = startMs + durationSec * 1000;
    return nowMs >= (startMs - START_EARLY_GRACE_MS) && nowMs < (endMs + END_LATE_GRACE_MS);
  };

  const fetchCurrentProgram = useCallback(
    async (numericChannelId: number) => {
      if (ALWAYS_LIVE_CHANNEL_IDS.has(numericChannelId)) return;
      if (isFetchingRef.current) return;
      isFetchingRef.current = true;

      const firstLoad = !currentProgram;
      if (firstLoad) setIsLoading(true);

      const nowMs = Date.now();
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
          return isActiveWindow(start, p.duration, nowMs);
        });

        const nextProgram = activeProgram
          ? { ...activeProgram, channel_id: numericChannelId }
          : getStandbyMp4Program(numericChannelId, new Date(nowMs));

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
            setVideoPlayerKey((k) => k + 1);
            return effectiveSrc;
          }
          return prev;
        });

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
            setVideoPlayerKey((k) => k + 1);
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
    const id = setInterval(() => {
      if (document.visibilityState === "visible") {
        fetchCurrentProgram(validatedNumericChannelId);
        fetchUpcomingPrograms(validatedNumericChannelId);
      }
    }, 12000); // minute-by-minute friendly polling
    return () => clearInterval(id);
  }, [validatedNumericChannelId, fetchCurrentProgram, fetchUpcomingPrograms, pollOn]);

  const handleProgramEnded = useCallback(() => {
    if (validatedNumericChannelId !== null && !ALWAYS_LIVE_CHANNEL_IDS.has(validatedNumericChannelId)) {
      fetchCurrentProgram(validatedNumericChannelId);
    }
  }, [validatedNumericChannelId, fetchCurrentProgram]);

  // render
  const frozenTitle = stableTitleRef.current;
  const isYouTubeLive = currentProgram?.id === "live-ch21-youtube";

  const forceStandby = useCallback(async () => {
    if (validatedNumericChannelId == null) return;
    const standby = getStandbyMp4Program(validatedNumericChannelId, new Date());
    setCurrentProgram(standby);
    const signed = await resolvePlayableUrl(standby);
    const effective = signed ?? standby.mp4_url;
    setResolvedSrc((prev) => {
      if (prev !== effective) {
        setVideoPlayerKey((k) => k + 1);
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
        <Loader2 className="h-10 w-10 animate-spin text-amber-300 mb-2" />
        <p>Loading Channel...</p>
      </div>
    );
  } else if (isYouTubeLive) {
    content = (
      <YouTubeEmbed channelId={YT_CH21} title={frozenTitle || "Channel 21 Live"} muted={true} />
    );
  } else if (currentProgram && resolvedSrc) {
    content = (
      <SmartVideo
        key={videoPlayerKey}
        src={resolvedSrc}
        logo={logoSrc}
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
      <TopNav
        channelName={(channelDetails as any)?.name || `Channel ${channelIdString}`}
        logoSrc={logoSrc}
        showBack={false}
      />

      <main className="w-full aspect-video bg-black flex items-center justify-center">
        {content}
      </main>

      <section className="p-4 flex-grow">
        {currentProgram && !isYouTubeLive && (
          <>
            <h2 className="text-2xl font-bold">{frozenTitle}</h2>
            <p className="text-sm text-white/60">
              Channel: {(channelDetails as any)?.name || `Channel ${channelIdString}`}
            </p>
            {currentProgram.id !== STANDBY_PLACEHOLDER_ID && currentProgram.start_time && (
              <p className="text-sm text-white/60">
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
      </section>
    </div>
  );
}
