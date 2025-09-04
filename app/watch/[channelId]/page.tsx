// app/watch/[channelId]/page.tsx — Channel 21 is ALWAYS YouTube Live (24/7) + stable player
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
// If your project already exports Program/Channel from "@/types", feel free to use that instead.
type Program = {
  id: string;
  channel_id: number;
  title?: string | null;
  description?: string | null;
  mp4_url?: string | null;
  start_time?: string | null; // UTC ISO
  duration: number; // seconds
  poster_url?: string | null;
};
type Channel = {
  id: number | string;
  name?: string | null;
  slug?: string | null;
  description?: string | null;
  logo_url?: string | null;
  image_url?: string | null;
  youtube_channel_id?: string | null;
  youtube_is_live?: boolean | null;
  is_active?: boolean | null;
};
import { ChevronLeft, Loader2 } from "lucide-react";
import YouTubeEmbed from "@/components/youtube-embed";

/* ------------------------ CONSTANTS ------------------------ */

const CH21_ID_NUMERIC = 21;
/** Your 24/7 YouTube Channel ID for Channel 21 */
const YT_CH21 = "UCMkW239dyAxDyOFDP0D6p2g";

/** Channels that are *always* live on YouTube (skip schedule fetch) */
const ALWAYS_LIVE_CHANNEL_IDS = new Set<number>([CH21_ID_NUMERIC]);

/** Grace so minute-by-minute shows don’t “miss” a tick */
const START_EARLY_GRACE_MS = 30_000;
const END_LATE_GRACE_MS = 15_000;

/* ------------------------ HELPERS ------------------------ */

/** Normalize to ignore rotating query params */
function baseUrl(u?: string | null) {
  return (u ?? "").split("?")[0];
}

/** Parse DB times as UTC even if stored w/o Z (e.g. "YYYY-MM-DD HH:mm:ss") */
function toUtcDate(val?: string | Date | null): Date | null {
  if (!val) return null;
  if (val instanceof Date) return Number.isNaN(val.getTime()) ? null : val;
  let s = String(val).trim();
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(\.\d+)?$/.test(s)) s = s.replace(" ", "T") + "Z";
  else if (!/[zZ]|[+\-]\d{2}:\d{2}$/.test(s)) s = s + "Z";
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Choose channel bucket name from slug or numeric id */
function bucketNameFor(details: Channel | null): string | null {
  if (!details) return null;
  const slug = (details as any)?.slug?.toString().trim();
  if (slug) return slug;                    // e.g. "freedom_school"
  const n = Number((details as any)?.id);
  if (Number.isFinite(n) && n > 0) return `channel${n}`; // e.g. "channel7"
  return null;
}

/** Build a public Supabase Storage URL (all your buckets are PUBLIC) */
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
async function resolvePlayableUrl(program: Program, channelBucket: string | null): Promise<string | undefined> {
  try {
    const maybe = getVideoUrlForProgram(program) as unknown;
    let raw =
      (maybe && typeof (maybe as any).then === "function"
        ? await (maybe as Promise<string>)
        : (maybe as string | undefined)) || program?.mp4_url || "";

    if (!raw) return undefined;
    if (raw.startsWith("youtube_channel:")) return undefined;

    // Absolute/site-relative
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

    // Otherwise path inside THIS channel's bucket
    if (!channelBucket) return undefined;
    raw = raw.replace(/^\.?\//, "");
    // Allow mp4_url that already starts with "channelX/"
    const prefix = `${channelBucket.replace(/\/+$/, "")}/`.toLowerCase();
    if (raw.toLowerCase().startsWith(prefix)) raw = raw.slice(prefix.length);
    return publicUrl(channelBucket, raw);
  } catch {
    return undefined;
  }
}

/* ------------------------ PAGE ------------------------ */

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
  const [videoPlayerKey, setVideoPlayerKey] = useState(1);

  // Prevent overlapping fetches
  const isFetchingRef = useRef(false);

  // Freeze values passed to the HTML player
  const stableSrcRef = useRef<string | undefined>(undefined);
  const stablePosterRef = useRef<string | undefined>(undefined);
  const stableTitleRef = useRef<string | undefined>(undefined);

  // Track this channel’s bucket
  const channelBucketRef = useRef<string | null>(null);

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
      channelBucketRef.current = bucketNameFor(details);

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
          poster_url: (details as any)?.image_url || null,
        };
        setCurrentProgram(liveProgram);
        stableTitleRef.current = liveProgram.title || undefined;
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
      title: "Standby Programming",
      description: "Programming will resume shortly.",
      channel_id: channelNum,
      // We will resolve this inside the current channel bucket
      mp4_url: "standby_blacktruthtv.mp4",
      duration: 300,
      start_time: now.toISOString(),
      poster_url: null,
    }),
    []
  );

  const isActiveWindow = (start: Date, durationSec: number, nowMs: number) => {
    const startMs = start.getTime();
    const endMs = startMs + durationSec * 1000;
    return nowMs >= (startMs - START_EARLY_GRACE_MS) && nowMs < (endMs + END_LATE_GRACE_MS);
  };

  // Regular schedule fetch for non-always-live channels
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
          .select("id, channel_id, title, description, mp4_url, start_time, duration")
          .eq("channel_id", numericChannelId)
          .order("start_time", { ascending: true });

        if (dbError) throw new Error(`Database error: ${dbError.message}`);

        const programs = (programsData ?? []) as Program[];

        // pick active program using UTC (+ grace)
        const activeProgram = programs.find((p) => {
          if (!p.start_time || typeof p.duration !== "number" || p.duration <= 0) return false;
          const start = toUtcDate(p.start_time);
          if (!start) return false;
          return isActiveWindow(start, p.duration, nowMs);
        });

        const nextProgram = activeProgram
          ? { ...activeProgram, channel_id: numericChannelId }
          : getStandbyMp4Program(numericChannelId, new Date(nowMs));

        // Resolve to a *public* URL inside this channel's bucket (or leave absolute)
        const bucket = channelBucketRef.current || `channel${numericChannelId}`;
        const resolved = await resolvePlayableUrl(nextProgram, bucket);

        // Only change if program id OR base media URL actually changed
        setCurrentProgram((prev) => {
          if (prev) {
            const prevSrc = baseUrl(prev.mp4_url);
            const nextSrc = baseUrl(nextProgram.mp4_url);
            const same = prev.id === nextProgram.id && prevSrc === nextSrc;
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
          nextProgram?.poster_url ||
          (channelDetails as any)?.image_url ||
          (channelDetails as any)?.logo_url ||
          undefined;
        if (stablePosterRef.current !== nextPoster) stablePosterRef.current = nextPoster;

        const nextTitle = nextProgram?.title || undefined;
        if (stableTitleRef.current !== nextTitle) stableTitleRef.current = nextTitle;
      } catch (e: any) {
        setError(e.message);
        const fallback = getStandbyMp4Program(numericChannelId, new Date(nowMs));
        setCurrentProgram(fallback);
        const bucket = channelBucketRef.current || `channel${numericChannelId}`;
        const resolvedFallback = await resolvePlayableUrl(fallback, bucket);
        stableSrcRef.current = resolvedFallback;
        stablePosterRef.current =
          fallback.poster_url || (channelDetails as any)?.image_url || (channelDetails as any)?.logo_url || undefined;
        stableTitleRef.current = fallback.title || undefined;
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

  // Use frozen values for the player
  const frozenSrc = stableSrcRef.current;
  const frozenPoster = stablePosterRef.current;
  const frozenTitle = stableTitleRef.current;

  const isYouTubeLive = currentProgram?.id === "live-ch21-youtube";
  const shouldLoopInPlayer = currentProgram?.id === STANDBY_PLACEHOLDER_ID;

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
      <div className="w-full aspect-video bg-black flex items-center justify-center">{content}</div>
      <div className="p-4 flex-grow">
        {currentProgram && !isYouTubeLive && (
          <>
            <h2 className="text-2xl font-bold">{frozenTitle}</h2>
            <p className="text-sm text-gray-400">
              Channel: {(channelDetails as any)?.name || `Channel ${channelIdString}`}
            </p>
            {currentProgram.id !== STANDBY_PLACEHOLDER_ID && currentProgram.start_time && (
              <p className="text-sm text-gray-400">
                Scheduled Start: {(() => {
                  const d = toUtcDate(currentProgram.start_time);
                  return d ? d.toLocaleString() : "—";
                })()}
              </p>
            )}
            <p className="text-xs text-gray-300 mt-1">{currentProgram.description}</p>

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
