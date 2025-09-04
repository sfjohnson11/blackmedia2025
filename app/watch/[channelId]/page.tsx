// app/watch/[channelId]/page.tsx
// CH21 is ALWAYS YouTube Live (24/7).
// Programs table columns: id, channel_id, title, mp4_url, start_time, duration (UTC).
// Resolves MP4s from public Supabase buckets per-channel (channelN or slug), UTC-safe schedule.

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

/* ─────────────── Constants ─────────────── */

const CH21_ID_NUMERIC = 21;

// Optional env fallback for CH21 if DB youtube_channel_id is empty:
const ENV_YT_CH21 = process.env.NEXT_PUBLIC_YT_CH21 || "";

// Final safety fallback (prefer DB/env above)
const HARDCODED_FALLBACK_YT = "UCMkW239dyAxDyOFDP0D6p2g";

/** Channels that are *always* live on YouTube (skip schedule fetch) */
const ALWAYS_LIVE_CHANNEL_IDS = new Set<number>([CH21_ID_NUMERIC]);

/** Grace so minute-by-minute shows don’t “miss” a tick */
const START_EARLY_GRACE_MS = 30_000;
const END_LATE_GRACE_MS = 15_000;

/* ─────────────── Helpers ─────────────── */

function baseUrl(u?: string | null) {
  return (u ?? "").split("?")[0];
}

/** Parse DB times as UTC even if stored w/o Z (e.g. "YYYY-MM-DD HH:mm:ss") */
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

/** Choose channel bucket name from slug or numeric id */
function bucketNameFor(details: Channel | null): string | null {
  if (!details) return null;
  const slug = (details as any)?.slug?.toString().trim();
  if (slug) return slug; // e.g. "freedom_school"
  const n = Number((details as any)?.id);
  if (Number.isFinite(n) && n > 0) return `channel${n}`; // e.g. "channel7"
  return null;
}

/** PUBLIC Supabase Storage URL (all your buckets are PUBLIC) */
function publicUrl(bucket: string, objectPath: string): string | undefined {
  const clean = objectPath.replace(/^\.?\//, "");
  try {
    const { data } = supabase.storage.from(bucket).getPublicUrl(clean);
    return data?.publicUrl || undefined;
  } catch {
    return undefined;
  }
}

/** Resolve to a *public* URL based on your rules (no auth, no signing) */
async function resolvePlayableUrl(
  program: Program,
  channelBucket: string | null
): Promise<string | undefined> {
  try {
    const maybe = getVideoUrlForProgram(program) as unknown;
    let raw =
      (maybe && typeof (maybe as any).then === "function"
        ? await (maybe as Promise<string>)
        : (maybe as string | undefined)) || (program as any)?.mp4_url || "";

    if (!raw) return undefined;
    if (raw.startsWith("youtube_channel:")) return undefined;

    // Absolute or site-relative
    if (/^https?:\/\//i.test(raw) || raw.startsWith("/")) return raw;

    // Explicit bucket override: "bucket:path" or "storage://bucket/path"
    const m =
      /^([a-z0-9_\-]+):(.+)$/i.exec(raw) ||
      /^storage:\/\/([^/]+)\/(.+)$/i.exec(raw);
    if (m) {
      const b = m[1];
      const p = m[2].replace(/^\.?\//, "");
      return publicUrl(b, p);
    }

    // Otherwise: treat as path inside THIS channel's bucket
    if (!channelBucket) return undefined;
    raw = raw.replace(/^\.?\//, "");
    const prefix = `${channelBucket.replace(/\/+$/, "")}/`.toLowerCase();
    if (raw.toLowerCase().startsWith(prefix)) raw = raw.slice(prefix.length);
    return publicUrl(channelBucket, raw);
  } catch {
    return undefined;
  }
}

/** Extract YouTube channel ID to use (DB → env → hardcoded fallback) */
function pickYouTubeChannelId(details: Channel | null): string | null {
  const dbId = (details as any)?.youtube_channel_id?.toString().trim();
  if (dbId) return dbId;
  if (ENV_YT_CH21) return ENV_YT_CH21;
  if (HARDCODED_FALLBACK_YT) return HARDCODED_FALLBACK_YT;
  return null;
}

/* ─────────────── Page ─────────────── */

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
  const [videoPlayerKey, setVideoPlayerKey] = useState(1);

  // Prevent overlapping fetches
  const isFetchingRef = useRef(false);

  // Freeze values passed to the HTML player
  const stableSrcRef = useRef<string | undefined>(undefined);
  const stablePosterRef = useRef<string | undefined>(undefined);
  const stableTitleRef = useRef<string | undefined>(undefined);

  // Track this channel’s bucket
  const channelBucketRef = useRef<string | null>(null);

  /* Init channel details / CH21 YouTube */
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
      channelBucketRef.current = bucketNameFor(details);

      const numericId = Number.parseInt(String((details as any).id), 10);
      if (Number.isNaN(numericId)) {
        setError("Channel misconfigured: missing numeric id.");
        setIsLoading(false);
        return;
      }
      setValidatedNumericChannelId(numericId);

      // CH21: Always YouTube Live — use real channel ID from DB (or env fallback)
      if (ALWAYS_LIVE_CHANNEL_IDS.has(numericId)) {
        const ytChannelId = pickYouTubeChannelId(details);
        if (!ytChannelId) {
          setError("Channel 21 is configured as always-live on YouTube, but no youtube_channel_id is set.");
          setIsLoading(false);
          return;
        }
        const liveProgram: Program = {
          id: "live-youtube",
          title: (details as any)?.name ? `${(details as any).name} Live` : "Live Broadcast (Channel 21)",
          channel_id: CH21_ID_NUMERIC,
          // marker that carries the chosen YouTube channel id
          mp4_url: `youtube_channel:${ytChannelId}`,
          duration: 86400 * 365,
          start_time: new Date(Date.now() - 3600000).toISOString(),
        } as any;
        setCurrentProgram(liveProgram);
        stableTitleRef.current = (liveProgram as any).title || undefined;
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
      title: "Standby Programming",
      channel_id: channelNum,
      mp4_url: "standby_blacktruthtv.mp4", // resolved inside this channel's bucket
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

  /* Fetch active + upcoming for non-YouTube channels */
  const fetchCurrentProgram = useCallback(
    async (numericChannelId: number) => {
      if (ALWAYS_LIVE_CHANNEL_IDS.has(numericChannelId)) return; // never fetch schedule for 24/7 live
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

        // pick active program using UTC (+ grace)
        const activeProgram = programs.find((p: any) => {
          if (!p.start_time || typeof p.duration !== "number" || p.duration <= 0) return false;
          const start = toUtcDate(p.start_time as any);
          if (!start) return false;
          return isActiveWindow(start, p.duration as any, nowMs);
        });

        const nextProgram = (activeProgram
          ? { ...(activeProgram as any), channel_id: numericChannelId }
          : getStandbyMp4Program(numericChannelId, new Date(nowMs))) as Program;

        // Resolve to a *public* URL inside this channel's bucket (or leave absolute)
        const bucket = channelBucketRef.current || `channel${numericChannelId}`;
        const resolved = await resolvePlayableUrl(nextProgram as any, bucket);

        // Only change if program id OR base media URL actually changed
        setCurrentProgram((prev: any) => {
          if (prev) {
            const prevSrc = baseUrl((prev as any).mp4_url);
            const nextSrc = baseUrl((nextProgram as any).mp4_url);
            const same = (prev as any).id === (nextProgram as any).id && prevSrc === nextSrc;
            if (same) return prev;
            setVideoPlayerKey((k) => k + 1);
          }
          return nextProgram;
        });

        // Freeze props so the player doesn’t reload on harmless updates
        const nextSrcBase = baseUrl(resolved);
        const prevSrcBase = baseUrl(stableSrcRef.current);
        if (!stableSrcRef.current || prevSrcBase !== nextSrcBase) {
          stableSrcRef.current = resolved;
        }
        const nextPoster =
          (channelDetails as any)?.image_url ||
          (channelDetails as any)?.logo_url ||
          undefined;
        if (stablePosterRef.current !== nextPoster) stablePosterRef.current = nextPoster;

        const nextTitle = (nextProgram as any)?.title || undefined;
        if (stableTitleRef.current !== nextTitle) stableTitleRef.current = nextTitle;
      } catch (e: any) {
        setError(e.message);
        const fallback = getStandbyMp4Program(numericChannelId, new Date(nowMs));
        setCurrentProgram(fallback as any);
        const bucket = channelBucketRef.current || `channel${numericChannelId}`;
        const resolvedFallback = await resolvePlayableUrl(fallback as any, bucket);
        stableSrcRef.current = resolvedFallback;
        stablePosterRef.current =
          (channelDetails as any)?.image_url ||
          (channelDetails as any)?.logo_url ||
          undefined;
        stableTitleRef.current = (fallback as any).title || undefined;
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
      const nowIso = new Date().toISOString(); // DB times are UTC
      const { data } = await supabase
        .from("programs")
        .select("id, channel_id, title, mp4_url, start_time, duration")
        .eq("channel_id", numericChannelId)
        .gt("start_time", nowIso)
        .order("start_time", { ascending: true })
        .limit(6);

      if (data) setUpcomingPrograms(data as Program[]);
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

  // Frozen values for the player
  const frozenSrc = stableSrcRef.current;
  const frozenPoster = stablePosterRef.current;
  const frozenTitle = stableTitleRef.current;

  // Detect YouTube from program mp4_url marker (used only for CH21)
  const isYouTubeLive = (currentProgram as any)?.mp4_url?.toString().startsWith("youtube_channel:");
  const youtubeChannelId = isYouTubeLive
    ? ((currentProgram as any).mp4_url as string).split(":")[1]
    : null;

  /* ─────────────── Render ─────────────── */

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
  } else if (isYouTubeLive && youtubeChannelId) {
    content = (
      <YouTubeEmbed
        channelId={youtubeChannelId}
        title={frozenTitle || "Live"}
        muted={true}
      />
    );
  } else if (currentProgram && frozenSrc) {
    content = (
      <VideoPlayer
        key={videoPlayerKey}
        src={frozenSrc}
        poster={frozenPoster}
        isStandby={(currentProgram as any).id === STANDBY_PLACEHOLDER_ID}
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
            {(currentProgram as any).id !== STANDBY_PLACEHOLDER_ID && (currentProgram as any).start_time && (
              <p className="text-sm text-gray-400">
                Scheduled Start: {(() => {
                  const d = toUtcDate((currentProgram as any).start_time);
                  return d ? d.toLocaleString() : "—";
                })()}
              </p>
            )}

            {upcomingPrograms.length > 0 && (
              <div className="mt-6">
                <h3 className="text-lg font-semibold text-white mb-2">Upcoming Programs</h3>
                <ul className="text-sm text-gray-300 space-y-1">
                  {upcomingPrograms.map((program: any) => {
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

        {(searchParams?.get("debug") ?? "0") === "1" && (
          <div className="mt-4 text-xs bg-gray-900/70 border border-gray-700 rounded p-3">
            <div><b>Bucket:</b> {channelBucketRef.current || "—"}</div>
            <div><b>DB youtube_channel_id:</b> {String((channelDetails as any)?.youtube_channel_id || "")}</div>
            <div><b>Chosen YouTube channel:</b> {youtubeChannelId || pickYouTubeChannelId(channelDetails) || "—"}</div>
            <div><b>Program mp4_url:</b> {String((currentProgram as any)?.mp4_url || "")}</div>
            <div className="truncate"><b>Resolved MP4 URL:</b> {stableSrcRef.current || "—"}</div>
          </div>
        )}
      </div>
    </div>
  );
}
