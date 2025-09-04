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

// === config ===
const CH21_ID_NUMERIC = 21;                // always-live YouTube channel
const YT_CH21 = "UCMkW239dyAxDyOFDP0D6p2g";
const ALWAYS_LIVE_CHANNEL_IDS = new Set<number>([CH21_ID_NUMERIC]);

const DEFAULT_SECONDS = 1800;              // 30m if duration missing/invalid
const DRIFT_SECS = 60;                     // small clock drift tolerance

// === tiny helpers ===
const baseUrl = (u?: string | null) => (u ?? "").split("?")[0];
const safeDurSeconds = (v: unknown) => {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_SECONDS;
  return n > 24 * 3600 ? DEFAULT_SECONDS : n; // guard against minute/garbage values
};
const isLiveUTC = (p: { start_time: string; duration: number }, nowMs: number) => {
  const start = new Date(p.start_time).getTime(); // JS Date parses UTC ISO correctly
  const durMs = safeDurSeconds(p.duration) * 1000;
  const end = start + durMs;
  const drift = DRIFT_SECS * 1000;
  return nowMs + drift >= start && nowMs < end + drift;
};

export default function WatchPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();

  const channelIdParam = params.channelId as string;
  const pollOn = (searchParams?.get("poll") ?? "0") === "1";

  const [channelDetails, setChannelDetails] = useState<Channel | null>(null);
  const [numericChannelId, setNumericChannelId] = useState<number | null>(null);

  const [currentProgram, setCurrentProgram] = useState<Program | null>(null);
  const [upcomingPrograms, setUpcomingPrograms] = useState<Program[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [videoPlayerKey, setVideoPlayerKey] = useState(Date.now());

  const isFetchingRef = useRef(false);
  const playerHostRef = useRef<HTMLDivElement | null>(null);

  // freeze player props to avoid pointless reloads
  const stableSrcRef = useRef<string | undefined>(undefined);
  const stablePosterRef = useRef<string | undefined>(undefined);
  const stableTitleRef = useRef<string | undefined>(undefined);

  // Load channel (accepts slug or numeric id)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!channelIdParam) { setError("Channel ID missing."); setIsLoading(false); return; }
      setIsLoading(true); setError(null);

      const details = await fetchChannelDetails(channelIdParam);
      if (!details) { if (!cancelled) { setError("Could not load channel."); setIsLoading(false); } return; }
      if (cancelled) return;

      setChannelDetails(details);
      const n = Number.parseInt(String((details as any).id), 10);
      if (!Number.isFinite(n)) { setError("Channel misconfigured: id must be numeric."); setIsLoading(false); return; }
      setNumericChannelId(n);

      // Force-live channel 21 (YouTube)
      if (ALWAYS_LIVE_CHANNEL_IDS.has(n)) {
        const liveProgram: Program = {
          id: "live-ch21-youtube",
          title: "Live Broadcast (Channel 21)",
          channel_id: CH21_ID_NUMERIC,
          mp4_url: `youtube_channel:${YT_CH21}`,
          start_time: new Date(Date.now() - 3600000).toISOString(),
          duration: 86400 * 365,
        } as any;
        setCurrentProgram(liveProgram);
        stableTitleRef.current = liveProgram.title || "Live";
        setIsLoading(false);
        return;
      }

      setIsLoading(false);
    })();
    return () => { cancelled = true; };
  }, [channelIdParam]);

  // Standby item
  const standbyFor = useCallback((ch: number) => {
    const now = new Date();
    return {
      id: STANDBY_PLACEHOLDER_ID,
      title: "Standby Programming",
      channel_id: ch,
      mp4_url: `channel${ch}/standby_blacktruthtv.mp4`,
      start_time: now.toISOString(),
      duration: 300,
    } as Program;
  }, []);

  // Decide what to play right now: live > next upcoming > most recent past
  const fetchCurrentProgram = useCallback(async (chId: number) => {
    if (ALWAYS_LIVE_CHANNEL_IDS.has(chId) || isFetchingRef.current) return;
    isFetchingRef.current = true;

    const firstLoad = !currentProgram;
    if (firstLoad) setIsLoading(true);

    try {
      const nowIso = new Date().toISOString();
      const nowMs = Date.now();

      // Get rows around "now" using ONLY your columns
      const { data: startedRows, error: e1 } = await supabase
        .from("programs")
        .select("id, channel_id, title, mp4_url, start_time, duration")
        .eq("channel_id", chId)
        .lte("start_time", nowIso)
        .order("start_time", { ascending: false })
        .limit(12);
      if (e1) throw new Error(e1.message);

      const { data: upcomingRows, error: e2 } = await supabase
        .from("programs")
        .select("id, channel_id, title, mp4_url, start_time, duration")
        .eq("channel_id", chId)
        .gt("start_time", nowIso)
        .order("start_time", { ascending: true })
        .limit(6);
      if (e2) throw new Error(e2.message);

      const started = (startedRows ?? []).map(p => ({ ...p, duration: safeDurSeconds(p.duration) })) as Program[];
      const upcoming = (upcomingRows ?? []).map(p => ({ ...p, duration: safeDurSeconds(p.duration) })) as Program[];
      setUpcomingPrograms(upcoming);

      // 1) live now (UTC)
      let candidate = started.find(p => isLiveUTC(p as any, nowMs));

      // 2) else next upcoming
      if (!candidate && upcoming.length) candidate = upcoming[0];

      // 3) else most recent past
      if (!candidate && started.length) candidate = started[0];

      // Prefer one that actually has an mp4_url
      if (candidate && (!candidate.mp4_url || candidate.mp4_url.trim() === "")) {
        const withMp4 =
          started.find(p => p.mp4_url && p.mp4_url.trim() !== "") ||
          upcoming.find(p => p.mp4_url && p.mp4_url.trim() !== "");
        candidate = withMp4 || candidate;
      }

      const chosen = candidate ?? standbyFor(chId);

      setCurrentProgram(prev => {
        if (prev) {
          const same =
            prev.id === chosen.id &&
            baseUrl(prev.mp4_url) === baseUrl(chosen.mp4_url);
          if (same) return prev;
          setVideoPlayerKey(Date.now());
        }
        return chosen;
      });

      // Freeze player props
      const fullSrc = getVideoUrlForProgram(chosen);
      const nextSrcBase = baseUrl(fullSrc);
      const prevSrcBase = baseUrl(stableSrcRef.current);
      if (!stableSrcRef.current || prevSrcBase !== nextSrcBase) {
        stableSrcRef.current = fullSrc;
      }
      const nextTitle = chosen.title || undefined;
      if (stableTitleRef.current !== nextTitle) stableTitleRef.current = nextTitle;
      // (poster_url not part of your schema; leave undefined)
      stablePosterRef.current = undefined;
    } catch (e: any) {
      setError(`Failed to load program: ${e.message}`);
      const fallback = standbyFor(chId);
      setCurrentProgram(fallback);
      stableSrcRef.current = getVideoUrlForProgram(fallback);
      stablePosterRef.current = undefined;
      stableTitleRef.current = fallback.title || undefined;
    } finally {
      if (firstLoad) setIsLoading(false);
      isFetchingRef.current = false;
    }
  }, [currentProgram, standbyFor]);

  const fetchUpcomingPrograms = useCallback(async (chId: number) => {
    if (ALWAYS_LIVE_CHANNEL_IDS.has(chId)) return;
    try {
      const nowIso = new Date().toISOString();
      const { data } = await supabase
        .from("programs")
        .select("id, channel_id, title, mp4_url, start_time, duration")
        .eq("channel_id", chId)
        .gt("start_time", nowIso)
        .order("start_time", { ascending: true })
        .limit(6);
      if (data) setUpcomingPrograms(data as Program[]);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    if (numericChannelId === null) return;
    if (ALWAYS_LIVE_CHANNEL_IDS.has(numericChannelId)) return;

    fetchCurrentProgram(numericChannelId);
    fetchUpcomingPrograms(numericChannelId);

    if (!pollOn) return;
    const i = setInterval(() => {
      if (document.visibilityState === "visible") {
        fetchCurrentProgram(numericChannelId);
        fetchUpcomingPrograms(numericChannelId);
      }
    }, 60_000);
    return () => clearInterval(i);
  }, [numericChannelId, fetchCurrentProgram, fetchUpcomingPrograms, pollOn]);

  const handleProgramEnded = useCallback(() => {
    if (numericChannelId !== null && !ALWAYS_LIVE_CHANNEL_IDS.has(numericChannelId)) {
      fetchCurrentProgram(numericChannelId);
    }
  }, [numericChannelId, fetchCurrentProgram]);

  const handlePrimaryLiveStreamError = useCallback(() => {}, []);

  const frozenSrc = stableSrcRef.current;
  const frozenPoster = stablePosterRef.current;
  const frozenTitle = stableTitleRef.current;

  const isYouTubeLive = currentProgram?.id === "live-ch21-youtube";
  const isStandby = currentProgram?.id === STANDBY_PLACEHOLDER_ID;

  // Save/restore progress for MP4 (not for YouTube)
  useEffect(() => {
    if (!frozenSrc || isYouTubeLive) return;
    if (!playerHostRef.current) return;
    const video: HTMLVideoElement | null = playerHostRef.current.querySelector("video");
    if (!video) return;

    const base = baseUrl(frozenSrc);
    const resumeKey = `btv:resume:${base}`;

    let lastSaved = 0;
    const onLoaded = () => {
      try {
        const raw = localStorage.getItem(resumeKey);
        const t = raw ? parseFloat(raw) : 0;
        if (!Number.isNaN(t) && t > 5 && video.duration && t < video.duration - 3) {
          video.currentTime = t;
        }
      } catch {}
    };
    const saveNow = () => { try { localStorage.setItem(resumeKey, String(Math.floor(video.currentTime || 0))); } catch {} };
    const onTime = () => { const t = Math.floor(video.currentTime || 0); if (t - lastSaved >= 10) { lastSaved = t; saveNow(); } };
    const onPause = () => saveNow();
    const onEnded = () => { try { localStorage.removeItem(resumeKey); } catch {} };

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
  }, [frozenSrc, isYouTubeLive]);

  // --- render ---
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
        isStandby={isStandby}
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
          {(channelDetails as any)?.name || `Channel ${channelIdParam}`}
        </h1>
        <div className="w-10 h-10" />
      </div>

      <div ref={playerHostRef} className="w-full aspect-video bg-black flex items-center justify-center">
        {content}
      </div>

      <div className="p-4 flex-grow">
        {currentProgram && currentProgram.id !== "live-ch21-youtube" && (
          <>
            <h2 className="text-2xl font-bold">{frozenTitle}</h2>
            <p className="text-sm text-gray-400">Channel: {(channelDetails as any)?.name || `Channel ${channelIdParam}`}</p>
            {currentProgram.id !== STANDBY_PLACEHOLDER_ID && currentProgram.start_time && (
              <p className="text-sm text-gray-400">
                Scheduled Start (UTC): {new Date(currentProgram.start_time).toLocaleString()}
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
