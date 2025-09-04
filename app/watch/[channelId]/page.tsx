// app/watch/[channelId]/page.tsx
"use client";

import { type ReactNode, useEffect, useState, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import VideoPlayer from "@/components/video-player";
import YouTubeEmbed from "@/components/youtube-embed";
import { supabase, getVideoUrlForProgram, fetchChannelDetails, STANDBY_PLACEHOLDER_ID } from "@/lib/supabase";
import type { Program, Channel } from "@/types";
import { ChevronLeft, Loader2 } from "lucide-react";

const CH21_ID_NUMERIC = 21;
const YT_CH21 = "UCMkW239dyAxDyOFDP0D6p2g";
const ALWAYS_LIVE_CHANNEL_IDS = new Set<number>([CH21_ID_NUMERIC]);

function baseUrl(u?: string | null) {
  return (u ?? "").split("?")[0];
}

function isLiveUTC(p: { start_time: string; duration: number }, nowMs: number) {
  const start = new Date(p.start_time).getTime();
  const end = start + Math.max(1, p.duration || 0) * 1000;
  return nowMs >= start && nowMs < end;
}

export default function WatchPage() {
  const params = useParams();
  const router = useRouter();
  const channelIdString = params.channelId as string;

  const [validatedNumericChannelId, setValidatedNumericChannelId] = useState<number | null>(null);
  const [channelDetails, setChannelDetails] = useState<Channel | null>(null);
  const [currentProgram, setCurrentProgram] = useState<Program | null>(null);
  const [upcomingPrograms, setUpcomingPrograms] = useState<Program[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [videoPlayerKey, setVideoPlayerKey] = useState(Date.now());

  const stableSrcRef = useRef<string | undefined>();
  const stableTitleRef = useRef<string | undefined>();

  // load channel
  useEffect(() => {
    (async () => {
      if (!channelIdString) return;

      setIsLoading(true);
      setError(null);

      const details = await fetchChannelDetails(channelIdString);
      if (!details) {
        setError("Could not load channel details.");
        setIsLoading(false);
        return;
      }
      setChannelDetails(details);

      const numericId = parseInt(String((details as any).id), 10);
      if (Number.isNaN(numericId)) {
        setError("Channel misconfigured: missing numeric id.");
        setIsLoading(false);
        return;
      }
      setValidatedNumericChannelId(numericId);

      if (ALWAYS_LIVE_CHANNEL_IDS.has(numericId)) {
        const liveProgram: Program = {
          id: "live-ch21-youtube",
          channel_id: CH21_ID_NUMERIC,
          title: "Live Broadcast (Channel 21)",
          mp4_url: `youtube_channel:${YT_CH21}`,
          duration: 86400 * 365,
          start_time: new Date().toISOString(),
        };
        setCurrentProgram(liveProgram);
        stableTitleRef.current = liveProgram.title;
        setIsLoading(false);
        return;
      }

      setIsLoading(false);
    })();
  }, [channelIdString]);

  // standby
  const getStandbyProgram = useCallback((channelNum: number): Program => ({
    id: STANDBY_PLACEHOLDER_ID,
    channel_id: channelNum,
    title: "Standby Programming",
    mp4_url: `channel${channelNum}/standby_blacktruthtv.mp4`,
    duration: 300,
    start_time: new Date().toISOString(),
  }), []);

  // fetch programs
  const fetchPrograms = useCallback(async (numericChannelId: number) => {
    setIsLoading(true);
    try {
      const nowIso = new Date().toISOString();
      const { data, error: dbError } = await supabase
        .from("programs")
        .select("id, channel_id, title, mp4_url, start_time, duration")
        .eq("channel_id", numericChannelId)
        .order("start_time", { ascending: true });

      if (dbError) throw dbError;

      const rows = (data ?? []) as Program[];
      const nowMs = Date.now();

      const active = rows.find(p => p.start_time && p.duration && isLiveUTC(p, nowMs));
      const upcoming = rows.filter(p => p.start_time > nowIso).slice(0, 6);

      setUpcomingPrograms(upcoming);
      const chosen = active || upcoming[0] || rows[rows.length - 1] || getStandbyProgram(numericChannelId);

      setCurrentProgram(prev => {
        if (prev && prev.id === chosen.id) return prev;
        setVideoPlayerKey(Date.now());
        return chosen;
      });

      stableSrcRef.current = getVideoUrlForProgram(chosen);
      stableTitleRef.current = chosen.title || "";
    } catch (e: any) {
      setError(e.message);
      setCurrentProgram(getStandbyProgram(numericChannelId));
    } finally {
      setIsLoading(false);
    }
  }, [getStandbyProgram]);

  useEffect(() => {
    if (validatedNumericChannelId && !ALWAYS_LIVE_CHANNEL_IDS.has(validatedNumericChannelId)) {
      fetchPrograms(validatedNumericChannelId);
    }
  }, [validatedNumericChannelId, fetchPrograms]);

  const frozenSrc = stableSrcRef.current;
  const frozenTitle = stableTitleRef.current;

  const isYouTubeLive = currentProgram?.id === "live-ch21-youtube";

  let content: ReactNode;
  if (error) {
    content = <p className="text-red-400 p-4 text-center">Error: {error}</p>;
  } else if (isLoading && !currentProgram) {
    content = <Loader2 className="h-10 w-10 animate-spin text-red-500" />;
  } else if (isYouTubeLive) {
    content = <YouTubeEmbed channelId={YT_CH21} title={frozenTitle || "Channel 21 Live"} muted={true} />;
  } else if (currentProgram && frozenSrc) {
    content = (
      <VideoPlayer
        key={videoPlayerKey}
        src={frozenSrc}
        programTitle={frozenTitle}
        onVideoEnded={() => validatedNumericChannelId && fetchPrograms(validatedNumericChannelId)}
        isPrimaryLiveStream={false}
        showNoLiveNotice={false}
      />
    );
  } else {
    content = <p className="text-gray-400 p-4 text-center">Initializing channel...</p>;
  }

  return (
    <div className="bg-black min-h-screen flex flex-col text-white">
      <div className="p-4 flex items-center justify-between bg-gray-900 sticky top-0 z-10">
        <button onClick={() => router.back()} className="p-2 rounded-full hover:bg-gray-700">
          <ChevronLeft className="h-6 w-6" />
        </button>
        <h1 className="text-xl font-semibold truncate">{channelDetails?.name || `Channel ${channelIdString}`}</h1>
        <div className="w-10 h-10" />
      </div>

      <div className="w-full aspect-video bg-black flex items-center justify-center">
        {content}
      </div>

      {upcomingPrograms.length > 0 && (
        <div className="p-4">
          <h3 className="text-lg font-semibold">Upcoming Programs</h3>
          <ul className="text-sm text-gray-300 space-y-1">
            {upcomingPrograms.map(p => (
              <li key={p.id}>
                {p.title} — {new Date(p.start_time).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
