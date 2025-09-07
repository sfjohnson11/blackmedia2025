// app/watch/[channelId]/page.tsx
"use client";

import { type ReactNode, useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import VideoPlayer from "@/components/video-player";
import {
  getVideoUrlForProgram,
  supabase,
  // If you have this exported, keep it. If not, we'll just use a string id below.
  // STANDBY_PLACEHOLDER_ID,
  fetchChannelById,
  type Program as SupaProgram,
  type Channel as SupaChannel,
} from "@/lib/supabase";
import { ChevronLeft, Loader2 } from "lucide-react";

type Program = SupaProgram & {
  poster_url?: string | null;
};
type Channel = SupaChannel & {
  image_url?: string | null; // for backward compatibility with your older code
};

const CH21_ID_NUMERIC = 21;
const HLS_LIVE_STREAM_URL_CH21 =
  "https://cdn.livepush.io/hls/fe96095a2d2b4314aa1789fb309e48f8/index.m3u8";

// Local constant if you don't export STANDBY_PLACEHOLDER_ID:
const STANDBY_ID_FALLBACK = "standby-placeholder";

export default function WatchPage() {
  const params = useParams();
  const router = useRouter();
  const channelIdString = params.channelId as string;

  const [validatedNumericChannelId, setValidatedNumericChannelId] = useState<number | null>(null);
  const [currentProgram, setCurrentProgram] = useState<Program | null>(null);
  const [upcomingPrograms, setUpcomingPrograms] = useState<Program[]>([]);
  const [channelDetails, setChannelDetails] = useState<Channel | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [videoPlayerKey, setVideoPlayerKey] = useState(Date.now());
  const [hlsStreamFailedForCh21, setHlsStreamFailedForCh21] = useState(false);
  const [youtubeLiveSrc, setYoutubeLiveSrc] = useState<string | null>(null); // render iframe when present

  // ---- helpers -------------------------------------------------------------

  const buildStandbyMp4For = (id: number) =>
    `channel${id}/standby_blacktruthtv.mp4`;

  const getCh21StandbyMp4Program = useCallback(
    (now: Date): Program => ({
      id: STANDBY_ID_FALLBACK,
      title: "Channel 21 - Standby",
      description: "Live stream currently unavailable. Standby programming will play.",
      channel_id: CH21_ID_NUMERIC,
      mp4_url: buildStandbyMp4For(CH21_ID_NUMERIC),
      duration: 300,
      start_time: now.toISOString(),
      poster_url: channelDetails?.image_url || channelDetails?.logo_url || null,
    }),
    [channelDetails]
  );

  // ---- bootstrap numeric id + channel details -----------------------------

  useEffect(() => {
    if (!channelIdString) {
      setError("Channel ID is missing in URL.");
      setIsLoading(false);
      return;
    }
    const numericId = Number.parseInt(channelIdString, 10);
    if (Number.isNaN(numericId)) {
      setError("Invalid channel ID format in URL.");
      setIsLoading(false);
      return;
    }
    setValidatedNumericChannelId(numericId);
    setError(null);
    if (numericId !== CH21_ID_NUMERIC) setHlsStreamFailedForCh21(false);

    (async () => {
      setIsLoading(true);
      // Use your existing supabase helper to fetch the channel row
      const ch = await fetchChannelById(supabase, numericId);
      setChannelDetails(ch as Channel);
      if (!ch) setError("Could not load channel details.");
      // If ch21 has a YouTube channel id, build iframe src now
      if (numericId === CH21_ID_NUMERIC) {
        const yt = (ch?.youtube_channel_id || "").trim();
        setYoutubeLiveSrc(yt ? `https://www.youtube.com/embed/live_stream?channel=${encodeURIComponent(yt)}&autoplay=0&mute=0&playsinline=1` : null);
      } else {
        setYoutubeLiveSrc(null);
      }
      setIsLoading(false);
    })();
  }, [channelIdString]);

  // ---- programs: current + upcoming ---------------------------------------

  const fetchCurrentProgram = useCallback(
    async (numericChannelId: number) => {
      setIsLoading(true);
      const now = new Date();

      try {
        const { data: programsData, error: dbError } = await supabase
          .from("programs")
          .select("*, duration")
          .eq("channel_id", numericChannelId)
          .order("start_time", { ascending: true });

        if (dbError) throw new Error(`Database error: ${dbError.message}`);

        const programs = (programsData || []) as Program[];

        // find active by UTC + seconds (no parsing, seconds only)
        const activeProgram = programs.find((p) => {
          if (!p.start_time || typeof p.duration !== "number" || p.duration <= 0) return false;
          const start = new Date(p.start_time);
          const end = new Date(start.getTime() + p.duration * 1000);
          return now >= start && now < end;
        });

        let programToSet: Program | null = null;

        if (activeProgram) {
          programToSet = { ...activeProgram, channel_id: numericChannelId };
          // When a scheduled program is live, clear any ch21 failure state
          if (numericChannelId === CH21_ID_NUMERIC) setHlsStreamFailedForCh21(false);
        } else if (numericChannelId === CH21_ID_NUMERIC) {
          // Channel 21:
          // Prefer YouTube Live iframe when youtube_channel_id is present
          if (youtubeLiveSrc) {
            programToSet = {
              id: "youtube-ch21",
              title: "YouTube Live (Channel 21)",
              description: "Live broadcast via YouTube.",
              channel_id: CH21_ID_NUMERIC,
              // NOTE: we won't feed this into VideoPlayer; we render an iframe when youtubeLiveSrc is set.
              mp4_url: buildStandbyMp4For(CH21_ID_NUMERIC), // harmless placeholder for typing
              duration: 86400 * 7,
              start_time: new Date(Date.now() - 3600000).toISOString(),
              poster_url: channelDetails?.image_url || channelDetails?.logo_url || null,
            };
          } else {
            // HLS or standby fallback (your original behavior)
            programToSet = hlsStreamFailedForCh21
              ? getCh21StandbyMp4Program(now)
              : {
                  id: "live-ch21-hls",
                  title: "Live Broadcast (Channel 21)",
                  description: "Currently broadcasting live.",
                  channel_id: CH21_ID_NUMERIC,
                  mp4_url: `/api/cors-proxy?url=${encodeURIComponent(HLS_LIVE_STREAM_URL_CH21)}`,
                  duration: 86400 * 7,
                  start_time: new Date(Date.now() - 3600000).toISOString(),
                  poster_url: channelDetails?.image_url || channelDetails?.logo_url || null,
                };
          }
        } else {
          // Other channels: standby when no active program
          programToSet = {
            id: STANDBY_ID_FALLBACK,
            title: "Standby Programming",
            description: "Programming will resume shortly.",
            channel_id: numericChannelId,
            mp4_url: buildStandbyMp4For(numericChannelId),
            duration: 300,
            start_time: now.toISOString(),
            poster_url: channelDetails?.image_url || channelDetails?.logo_url || null,
          };
        }

        setCurrentProgram((prev) => {
          if (
            prev?.id !== programToSet!.id ||
            prev?.start_time !== programToSet!.start_time ||
            prev?.mp4_url !== programToSet!.mp4_url
          ) {
            setVideoPlayerKey(Date.now());
          }
          return programToSet;
        });
      } catch (e: any) {
        setError(e.message);
        if (numericChannelId === CH21_ID_NUMERIC) {
          setCurrentProgram(getCh21StandbyMp4Program(now));
        } else {
          setCurrentProgram({
            id: STANDBY_ID_FALLBACK,
            title: "Standby Programming - Error",
            description: "Error loading schedule. Standby content will play.",
            channel_id: numericChannelId,
            mp4_url: buildStandbyMp4For(numericChannelId),
            duration: 300,
            start_time: now.toISOString(),
            poster_url: channelDetails?.image_url || channelDetails?.logo_url || null,
          });
        }
      } finally {
        setIsLoading(false);
      }
    },
    [hlsStreamFailedForCh21, getCh21StandbyMp4Program, channelDetails, youtubeLiveSrc]
  );

  const fetchUpcomingPrograms = useCallback(async (numericChannelId: number) => {
    try {
      const nowIso = new Date().toISOString();
      const { data, error } = await supabase
        .from("programs")
        .select("*")
        .eq("channel_id", numericChannelId)
        .gt("start_time", nowIso)
        .order("start_time", { ascending: true })
        .limit(6);

      if (!error && data) setUpcomingPrograms(data as Program[]);
    } catch (e) {
      console.warn("Error loading upcoming programs", e);
    }
  }, []);

  // polling loop (your original had 60s)
  useEffect(() => {
    let polling: NodeJS.Timeout | undefined;
    if (validatedNumericChannelId !== null) {
      fetchCurrentProgram(validatedNumericChannelId);
      fetchUpcomingPrograms(validatedNumericChannelId);
      polling = setInterval(() => {
        if (document.visibilityState === "visible") {
          fetchCurrentProgram(validatedNumericChannelId);
          fetchUpcomingPrograms(validatedNumericChannelId);
        }
      }, 60_000);
    }
    return () => polling && clearInterval(polling);
  }, [validatedNumericChannelId, fetchCurrentProgram, fetchUpcomingPrograms]);

  // CH21: if HLS errors, flip to standby immediately
  const handlePrimaryLiveStreamError = useCallback(() => {
    if (validatedNumericChannelId === CH21_ID_NUMERIC && !hlsStreamFailedForCh21) {
      setHlsStreamFailedForCh21(true);
      setCurrentProgram(getCh21StandbyMp4Program(new Date()));
      setVideoPlayerKey(Date.now());
    }
  }, [validatedNumericChannelId, hlsStreamFailedForCh21, getCh21StandbyMp4Program]);

  // ---- render selection ----------------------------------------------------

  const videoSrc = currentProgram ? getVideoUrlForProgram(currentProgram) : undefined;
  const posterSrc = currentProgram?.poster_url || channelDetails?.image_url || channelDetails?.logo_url || undefined;
  const shouldLoopInPlayer = currentProgram?.id === STANDBY_ID_FALLBACK;
  const isPrimaryHLS = currentProgram?.id === "live-ch21-hls";
  const showNoLiveNoticeForCh21 =
    validatedNumericChannelId === CH21_ID_NUMERIC &&
    hlsStreamFailedForCh21 &&
    currentProgram?.id === STANDBY_ID_FALLBACK;

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
  } else if (validatedNumericChannelId === CH21_ID_NUMERIC && youtubeLiveSrc) {
    // Render YouTube Live iframe when youtube_channel_id exists
    content = (
      <div className="relative w-full h-full">
        <iframe
          title="YouTube Live"
          className="w-full h-full"
          allow="autoplay; encrypted-media; picture-in-picture"
          src={youtubeLiveSrc}
        />
        <div className="absolute bottom-2 left-2 bg-black/60 text-white text-xs px-2 py-1 rounded">
          Tap ▶ in the player for sound
        </div>
      </div>
    );
  } else if (currentProgram && videoSrc) {
    // Your original VideoPlayer path (MP4 or HLS via proxy)
    content = (
      <VideoPlayer
        key={videoPlayerKey}
        src={videoSrc}
        poster={posterSrc || undefined}
        isStandby={shouldLoopInPlayer}
        programTitle={currentProgram?.title}
        // The following props are no-ops if your current VideoPlayer doesn't use them
        // but keep them for compatibility with your last working setup
        // @ts-ignore
        isPrimaryLiveStream={isPrimaryHLS && validatedNumericChannelId === CH21_ID_NUMERIC}
        // @ts-ignore
        onPrimaryLiveStreamError={handlePrimaryLiveStreamError}
        // @ts-ignore
        showNoLiveNotice={showNoLiveNoticeForCh21}
        // Ensure audio is ON in your VideoPlayer component (muted={false})
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
            <h2 className="text-2xl font-bold">{currentProgram.title}</h2>
            <p className="text-sm text-gray-400">Channel: {channelDetails?.name || `Channel ${channelIdString}`}</p>

            {currentProgram.id !== STANDBY_ID_FALLBACK &&
              currentProgram.id !== "live-ch21-hls" &&
              currentProgram.start_time && (
                <p className="text-sm text-gray-400">
                  Scheduled Start: {new Date(currentProgram.start_time).toLocaleString([], { timeZoneName: "short" })}
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
                        — {new Date(program.start_time!).toLocaleTimeString([], {
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
