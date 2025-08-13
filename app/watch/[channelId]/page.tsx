// app/watch/[channelId]/page.tsx — YouTube live override for Channel 21
"use client";

import { type ReactNode, useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import VideoPlayer from "@/components/video-player";
import {
  getVideoUrlForProgram,
  fetchChannelDetails,
  supabase,
  STANDBY_PLACEHOLDER_ID,
} from "@/lib/supabase";
import type { Program, Channel } from "@/types";
import { ChevronLeft, Loader2 } from "lucide-react";
import YouTubeEmbed from "@/components/youtube-embed"; // <-- A) IMPORT HERE

const CH21_ID_NUMERIC = 21;

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

  useEffect(() => {
    if (!channelIdString) {
      setError("Channel ID is missing in URL.");
      setIsLoading(false);
      return;
    }
    const numericId = Number.parseInt(channelIdString, 10);
    if (isNaN(numericId)) {
      setError("Invalid channel ID format in URL.");
      setIsLoading(false);
      return;
    }
    setValidatedNumericChannelId(numericId);
    setError(null);

    const loadChannelDetails = async () => {
      setIsLoading(true);
      const details = await fetchChannelDetails(channelIdString);
      setChannelDetails(details);
      if (!details) setError("Could not load channel details.");
    };
    loadChannelDetails();
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

        const programs = programsData as Program[];
        const activeProgram = programs?.find((p) => {
          if (!p.start_time || typeof p.duration !== "number" || p.duration <= 0) return false;
          const start = new Date(p.start_time);
          const end = new Date(start.getTime() + p.duration * 1000);
          return now >= start && now < end;
        });

        let programToSet: Program | null = null;

        // Prefer YouTube live for Channel 21 if flagged in DB
        const ch21YouTubeLive =
          numericChannelId === CH21_ID_NUMERIC &&
          !!channelDetails?.youtube_channel_id &&
          !!channelDetails?.youtube_is_live;

        if (ch21YouTubeLive) {
          // Override schedule while live
          programToSet = {
            id: "live-ch21-youtube",
            title: "Live Broadcast (Channel 21)",
            description: "Currently broadcasting live via YouTube.",
            channel_id: CH21_ID_NUMERIC,
            mp4_url: `youtube_channel:${channelDetails!.youtube_channel_id}`, // marker for render
            duration: 86400 * 7,
            start_time: new Date(Date.now() - 3600000).toISOString(),
            poster_url: channelDetails?.image_url || null,
          };
        } else if (activeProgram) {
          programToSet = { ...activeProgram, channel_id: numericChannelId };
        } else {
          programToSet = getStandbyMp4Program(numericChannelId, now);
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
        setCurrentProgram(getStandbyMp4Program(numericChannelId, now));
      } finally {
        setIsLoading(false);
      }
    },
    [channelDetails, getStandbyMp4Program]
  );

  const fetchUpcomingPrograms = useCallback(async (numericChannelId: number) => {
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
    } catch (e) {
      console.warn("Error loading upcoming programs", e);
    }
  }, []);

  useEffect(() => {
    let pollingInterval: NodeJS.Timeout | undefined;
    if (validatedNumericChannelId !== null) {
      fetchCurrentProgram(validatedNumericChannelId);
      fetchUpcomingPrograms(validatedNumericChannelId);
      pollingInterval = setInterval(() => {
        if (document.visibilityState === "visible") {
          fetchCurrentProgram(validatedNumericChannelId);
          fetchUpcomingPrograms(validicatedNumericChannelId);
        }
      }, 60000);
    }
    return () => pollingInterval && clearInterval(pollingInterval);
  }, [validatedNumericChannelId, fetchCurrentProgram, fetchUpcomingPrograms]);

  const videoSrc = currentProgram ? getVideoUrlForProgram(currentProgram) : undefined;
  const posterSrc = currentProgram?.poster_url || channelDetails?.image_url || undefined;
  const shouldLoopInPlayer = currentProgram?.id === STANDBY_PLACEHOLDER_ID;

  // YouTube-live branch flag
  const isYouTubeLive =
    validatedNumericChannelId === CH21_ID_NUMERIC && currentProgram?.id === "live-ch21-youtube";

  const handleProgramEnded = useCallback(() => {
    if (validatedNumericChannelId !== null) {
      fetchCurrentProgram(validatedNumericChannelId);
    }
  }, [validatedNumericChannelId, fetchCurrentProgram]);

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
    // Render YouTube when live
    const chId = currentProgram?.mp4_url?.startsWith("youtube_channel:")
      ? currentProgram.mp4_url.split(":")[1]
      : channelDetails?.youtube_channel_id || "";
    content = chId ? (
      <YouTubeEmbed channelId={chId} title={currentProgram?.title || "Channel 21 Live"} muted={true} />
    ) : (
      <p className="text-gray-400 p-4 text-center">Live stream not configured.</p>
    );
  } else if (currentProgram && videoSrc) {
    // VOD / scheduled MP4/HLS
    content = (
      <VideoPlayer
        key={videoPlayerKey}
        src={videoSrc}
        poster={posterSrc}
        isStandby={shouldLoopInPlayer}
        programTitle={currentProgram?.title}
        onVideoEnded={handleProgramEnded}
        isPrimaryLiveStream={false}
        onPrimaryLiveStreamError={() => {}}
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
        {currentProgram && !isLoading && (
          <>
            <h2 className="text-2xl font-bold">{currentProgram.title}</h2>
            <p className="text-sm text-gray-400">Channel: {channelDetails?.name || `Channel ${channelIdString}`}</p>
            {currentProgram.id !== STANDBY_PLACEHOLDER_ID &&
              currentProgram.id !== "live-ch21-youtube" &&
              currentProgram.start_time && (
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
