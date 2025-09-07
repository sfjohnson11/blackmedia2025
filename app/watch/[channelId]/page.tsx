// watch.tsx — With safe guide below video (UTC + seconds, correct imports, poster, standby)
"use client";

import { type ReactNode, useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import VideoPlayer from "@/components/video-player";
import {
  getVideoUrlForProgram,
  fetchChannelById,
  supabase,
  STANDBY_PLACEHOLDER_ID,
} from "@/lib/supabase";
import type { Program, Channel } from "@/types";
import { ChevronLeft, Loader2 } from "lucide-react";

const CH21_ID_NUMERIC = 21;
const YT_CH21 = "UCMkW239dyAxDyOFDP0D6p2g"; // your YouTube channel ID

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
      const details = await fetchChannelById(supabase, numericId);
      setChannelDetails(details);
      if (!details) setError("Could not load channel details.");
      setIsLoading(false);
    };
    loadChannelDetails();
  }, [channelIdString]);

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
        const activeProgram = programs.find((p) => {
          const dur = Number(p.duration ?? 0);
          if (!p.start_time || !Number.isFinite(dur) || dur <= 0) return false;
          const start = new Date(p.start_time); // you store UTC with Z — good
          const end = new Date(start.getTime() + dur * 1000);
          return now >= start && now < end;
        });

        let programToSet: Program | null = null;

        if (activeProgram) {
          programToSet = { ...activeProgram, channel_id: numericChannelId };
        } else {
          programToSet = {
            id: STANDBY_PLACEHOLDER_ID,
            title: "Standby Programming",
            description: "Programming will resume shortly.",
            channel_id: numericChannelId,
            mp4_url: `channel${numericChannelId}/standby_blacktruthtv.mp4`,
            duration: 300,
            start_time: now.toISOString(),
            // use the correct poster field from your schema
            poster_url: (channelDetails as any)?.logo_url || null,
          } as unknown as Program;
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
        setCurrentProgram({
          id: STANDBY_PLACEHOLDER_ID,
          title: "Standby Programming - Error",
          description: "Error loading schedule. Standby content will play.",
          channel_id: numericChannelId,
          mp4_url: `channel${numericChannelId}/standby_blacktruthtv.mp4`,
          duration: 300,
          start_time: new Date().toISOString(),
          poster_url: (channelDetails as any)?.logo_url || null,
        } as unknown as Program);
      } finally {
        setIsLoading(false);
      }
    },
    [channelDetails]
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
      if (validatedNumericChannelId !== CH21_ID_NUMERIC) {
        fetchCurrentProgram(validatedNumericChannelId);
        fetchUpcomingPrograms(validatedNumericChannelId);
        pollingInterval = setInterval(() => {
          if (document.visibilityState === "visible") {
            fetchCurrentProgram(validatedNumericChannelId);
            fetchUpcomingPrograms(validicatedNumericChannelId);
          }
        }, 60000);
      } else {
        setIsLoading(false);
      }
    }
    return () => pollingInterval && clearInterval(pollingInterval);
  }, [validatedNumericChannelId, fetchCurrentProgram, fetchUpcomingPrograms]);

  const videoSrc = currentProgram ? getVideoUrlForProgram(currentProgram) : undefined;
  const posterSrc = (currentProgram as any)?.poster_url || (channelDetails as any)?.logo_url || undefined;
  const shouldLoopInPlayer = currentProgram?.id === STANDBY_PLACEHOLDER_ID;

  const handleProgramEnded = useCallback(() => {
    if (validatedNumericChannelId !== null && validatedNumericChannelId !== CH21_ID_NUMERIC) {
      fetchCurrentProgram(validatedNumericChannelId);
    }
  }, [validatedNumericChannelId, fetchCurrentProgram]);

  const isCh21 = validatedNumericChannelId === CH21_ID_NUMERIC;
  let content: ReactNode;

  if (isCh21) {
    const ytUrl = `https://www.youtube.com/embed/live_stream?channel=${encodeURIComponent(
      YT_CH21
    )}&autoplay=1&mute=1&playsinline=1&rel=0&modestbranding=1`;

    content = isLoading ? (
      <div className="flex flex-col items-center justify-center h-full">
        <Loader2 className="h-10 w-10 animate-spin text-red-500 mb-2" />
        <p>Loading Channel 21…</p>
      </div>
    ) : (
      <iframe
        title="YouTube Live (Channel 21)"
        className="w-full h-full"
        src={ytUrl}
        allow="autoplay; encrypted-media; picture-in-picture"
        allowFullScreen
        referrerPolicy="origin-when-cross-origin"
      />
    );
  } else if (error) {
    content = <p className="text-red-400 p-4 text-center">Error: {error}</p>;
  } else if (isLoading && !currentProgram) {
    content = (
      <div className="flex flex-col items-center justify-center h-full">
        <Loader2 className="h-10 w-10 animate-spin text-red-500 mb-2" />
        <p>Loading Channel...</p>
      </div>
    );
  } else if (currentProgram && videoSrc) {
    content = (
      <VideoPlayer
        key={videoPlayerKey}
        src={videoSrc}
        poster={posterSrc}
        isStandby={shouldLoopInPlayer}
        programTitle={currentProgram?.title}
        onVideoEnded={handleProgramEnded}
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
          {channelDetails?.name || `Channel ${channelIdString}`}
        </h1>
        <div className="w-10 h-10" />
      </div>

      <div className="w-full aspect-video bg-black flex items-center justify-center">{content}</div>

      <div className="p-4 flex-grow">
        {validatedNumericChannelId !== CH21_ID_NUMERIC && currentProgram && !isLoading && (
          <>
            <h2 className="text-2xl font-bold">{currentProgram.title}</h2>
            <p className="text-sm text-gray-400">Channel: {channelDetails?.name || `Channel ${channelIdString}`}</p>
            {currentProgram.id !== STANDBY_PLACEHOLDER_ID && currentProgram.start_time && (
              <p className="text-sm text-gray-400">
                Scheduled Start: {new Date(currentProgram.start_time).toLocaleString()}
              </p>
            )}
            {currentProgram.description && (
              <p className="text-xs text-gray-300 mt-1">{currentProgram.description}</p>
            )}

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
