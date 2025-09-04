// app/watch/[channelId]/page.tsx
// Channel 21 = always YouTube Live (uses channels.youtube_channel_id).
// programs: id, channel_id, title, mp4_url, start_time, duration (UTC)
// channels: id, name, slug, description, logo_url, image_url, youtube_channel_id, youtube_is_live, is_active
// Resolves MP4 from PUBLIC buckets: slug → bucket, else channel{id}

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

/* ───────── constants ───────── */

const CH21_ID_NUMERIC = 21;
const ALWAYS_LIVE_CHANNEL_IDS = new Set<number>([CH21_ID_NUMERIC]);

const ENV_YT_CH21 = process.env.NEXT_PUBLIC_YT_CH21 || "";
const HARDCODED_FALLBACK_YT = "UCMkW239dyAxDyOFDP0D6p2g";

const START_EARLY_GRACE_MS = 30_000;
const END_LATE_GRACE_MS = 15_000;

/* ───────── helpers ───────── */

const baseUrl = (u?: string | null) => (u ?? "").split("?")[0];

function toUtcDate(val?: string | Date | null): Date | null {
  if (!val) return null;
  if (val instanceof Date) return Number.isNaN(val.getTime()) ? null : val;
  let s = String(val).trim();
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(\.\d+)?$/.test(s)) s = s.replace(" ", "T") + "Z";
  else if (!/[zZ]|[+\-]\d{2}:\d{2}$/.test(s)) s = s + "Z";
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

function bucketNameFor(details: Channel | null): string | null {
  if (!details) return null;
  const slug = (details as any)?.slug?.toString().trim();
  if (slug) return slug;
  const n = Number((details as any)?.id);
  if (Number.isFinite(n) && n > 0) return `channel${n}`;
  return null;
}

function publicUrl(bucket: string, objectPath: string): string | undefined {
  const clean = objectPath.replace(/^\.?\//, "");
  try {
    const { data } = supabase.storage.from(bucket).getPublicUrl(clean);
    return data?.publicUrl || undefined;
  } catch {
    return undefined;
  }
}

async function resolvePlayableUrl(program: Program, channelBucket: string | null) {
  try {
    const maybe = getVideoUrlForProgram(program) as unknown;
    let raw =
      (maybe && typeof (maybe as any).then === "function"
        ? await (maybe as Promise<string>)
        : (maybe as string | undefined)) || (program as any)?.mp4_url || "";

    if (!raw) return undefined;
    if (/^https?:\/\//i.test(raw) || raw.startsWith("/")) return raw;

    // explicit bucket override: bucket:path or storage://bucket/path
    const m =
      /^([a-z0-9_\-]+):(.+)$/i.exec(raw) ||
      /^storage:\/\/([^/]+)\/(.+)$/i.exec(raw);
    if (m) {
      const b = m[1];
      const p = m[2].replace(/^\.?\//, "");
      return publicUrl(b, p);
    }

    if (!channelBucket) return undefined;
    raw = raw.replace(/^\.?\//, "");
    const prefix = `${channelBucket.replace(/\/+$/, "")}/`.toLowerCase();
    if (raw.toLowerCase().startsWith(prefix)) raw = raw.slice(prefix.length);
    return publicUrl(channelBucket, raw);
  } catch {
    return undefined;
  }
}

function pickYouTubeChannelId(details: Channel | null): string | null {
  const dbId = (details as any)?.youtube_channel_id?.toString().trim();
  if (dbId) return dbId;
  if (ENV_YT_CH21) return ENV_YT_CH21;
  if (HARDCODED_FALLBACK_YT) return HARDCODED_FALLBACK_YT;
  return null;
}

/* ───────── page ───────── */

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

  const isFetchingRef = useRef(false);
  const stableSrcRef = useRef<string | undefined>(undefined);
  const stablePosterRef = useRef<string | undefined>(undefined);
  const stableTitleRef = useRef<string | undefined>(undefined);
  const channelBucketRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async function init() {
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

      if (ALWAYS_LIVE_CHANNEL_IDS.has(numericId)) {
        const ytChannelId = pickYouTubeChannelId(details);
        if (!ytChannelId) {
          setError("Channel 21 is set to YouTube Live but youtube_channel_id is missing.");
          setIsLoading(false);
          return;
        }
        const liveProgram: Program = {
          id: "live-youtube",
          title: (details as any)?.name ? `${(details as any).name} Live` : "Live Broadcast (Channel 21)",
          channel_id: CH21_ID_NUMERIC,
          mp4_url: `youtube_channel:${ytChannelId}`, // marker
          duration: 86400 * 365,
          start_time: new Date(Date.now() - 3600000).toISOString(),
        } as any;
        setCurrentProgram(liveProgram);
        stableTitleRef.current = (liveProgram as any).title || undefined;
        setIsLoading(false);
        return;
      }

      setIsLoading(false);
    })();

    return () => { cancelled = true; };
  }, [channelIdString]);

  const getStandbyMp4Program = useCallback(
    (channelNum: number, now: Date): Program =>
      ({
        id: STANDBY_PLACEHOLDER_ID,
        title: "Standby Programming",
        channel_id: channelNum,
        mp4_url: "standby_blacktruthtv.mp4", // expected inside this channel's bucket
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

        const activeProgram = programs.find((p: any) => {
          if (!p.start_time || typeof p.duration !== "number" || p.duration <= 0) return false;
          const start = toUtcDate(p.start_time as any);
          if (!start) return false;
          return isActiveWindow(start, p.duration as any, nowMs);
        });

        const chosen = (activeProgram
          ? { ...(activeProgram as any), channel_id: numericChannelId }
          : getStandbyMp4Program(numericChannelId, new Date(nowMs))) as Program;

        const bucket = channelBucketRef.current || `channel${numericChannelId}`;
        const resolved = await resolvePlayableUrl(chosen as any, bucket);

        // Update current program only if identity/base URL changes (prevents player thrash)
        setCurrentProgram((prev: any) => {
          if (prev) {
            const prevSrc = baseUrl((prev as any).mp4_url);
            const nextSrc = baseUrl((chosen as any).mp4_url);
            const same = (prev as any).id === (chosen as any).id && prevSrc === nextSrc;
            if (same) return prev;
            setVideoPlayerKey((k) => k + 1);
          }
          return chosen;
        });

        // Freeze player props
        const nextSrcBase = baseUrl(resolved);
        const prevSrcBase = baseUrl(stableSrcRef.current);
        if (!stableSrcRef.current || prevSrcBase !== nextSrcBase) {
          stableSrcRef.current = resolved;
        }
        const poster =
          (channelDetails as any)?.logo_url ||
          (channelDetails as any)?.image_url ||
          undefined;
        if (stablePosterRef.current !== poster) stablePosterRef.current = poster;
        const nextTitle = (chosen as any)?.title || undefined;
        if (stableTitleRef.current !== nextTitle) stableTitleRef.current = nextTitle;
      } catch (e: any) {
        setError(e.message);
        const fallback = getStandbyMp4Program(numericChannelId, new Date(nowMs));
        setCurrentProgram(fallback as any);
        const bucket = channelBucketRef.current || `channel${numericChannelId}`;
        const resolvedFallback = await resolvePlayableUrl(fallback as any, bucket);
        stableSrcRef.current = resolvedFallback;
        stablePosterRef.current =
          (channelDetails as any)?.logo_url ||
          (channelDetails as any)?.image_url ||
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
    if (ALWAYS_LIVE_CHANNEL_IDS.has(numericChannelId)) return;
    try {
      const nowIso = new Date().toISOString();
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
    if (ALWAYS_LIVE_CHANNEL_IDS.has(validatedNumericChannelId)) return;

    fetchCurrentProgram(validatedNumericChannelId);
    fetchUpcomingPrograms(validatedNumericChannelId);

    if (!pollOn) return;
    const id = setInterval(() => {
      if (document.visibilityState === "visible") {
        fetchCurrentProgram(validatedNumericChannelId);
        fetchUpcomingPrograms(validatedNumericChannelId);
      }
    }, 60_000);
    return () => clearInterval(id);
  }, [validatedNumericChannelId, fetchCurrentProgram, fetchUpcomingPrograms, pollOn]);

  const frozenSrc = stableSrcRef.current;
  const frozenPoster = stablePosterRef.current;
  const frozenTitle = stableTitleRef.current;

  const isYouTubeLive = (currentProgram as any)?.mp4_url?.toString().startsWith("youtube_channel:");
  const youtubeChannelId = isYouTubeLive
    ? ((currentProgram as any).mp4_url as string).split(":")[1]
    : null;

  /* ───────── render ───────── */

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
    content = <YouTubeEmbed channelId={youtubeChannelId} title={frozenTitle || "Live"} muted={true} />;
  } else if (currentProgram && frozenSrc) {
    content = (
      <VideoPlayer
        key={videoPlayerKey}
        src={frozenSrc}
        poster={frozenPoster}
        isStandby={(currentProgram as any).id === STANDBY_PLACEHOLDER_ID}
        programTitle={frozenTitle}
        onVideoEnded={() => {
          if (validatedNumericChannelId !== null) fetchCurrentProgram(validatedNumericChannelId);
        }}
        autoPlay
        muted
        playsInline
        preload="auto"
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
                            ? d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", timeZoneName: "short" })
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
            <div><b>Program.mp4_url (raw):</b> {String((currentProgram as any)?.mp4_url || "")}</div>
            <div className="truncate"><b>Resolved MP4 URL:</b> {stableSrcRef.current || "—"}</div>
            <div><b>Poster:</b> {String(frozenPoster || "")}</div>
          </div>
        )}
      </div>
    </div>
  );
}
