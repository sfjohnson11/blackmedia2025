// app/watch/[channelId]/page.tsx
// Works with programs columns: channel_id, title, mp4_url, start_time, duration
// No `id` column assumed anywhere.

"use client";

import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import VideoPlayer from "@/components/video-player";
import {
  getVideoUrlForProgram,
  fetchChannelById,     // <- this exists in your lib
  supabase,
  STANDBY_PLACEHOLDER_ID, // placeholder only used to mark standby
} from "@/lib/supabase";
import type { Channel, Program } from "@/types";
import { ChevronLeft, Loader2 } from "lucide-react";

const CH21_ID_NUMERIC = 21;
const YT_CH21 = "UCMkW239dyAxDyOFDP0D6p2g"; // your YouTube channel ID

// Helper: coerce duration to number (accept "1800" or 1800)
function asSeconds(v: unknown): number {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function pickActiveProgram(rows: Program[], nowMs: number): Program | null {
  for (const p of rows) {
    const startMs = Date.parse(String(p.start_time || ""));
    const durSec = asSeconds(p.duration);
    if (!Number.isFinite(startMs) || durSec <= 0) continue;
    const endMs = startMs + durSec * 1000;
    if (startMs <= nowMs && nowMs < endMs) return p;
  }
  return null;
}

export default function WatchPage() {
  const params = useParams();
  const router = useRouter();

  const channelIdString = params.channelId as string;

  const [channelId, setChannelId] = useState<number | null>(null);
  const [channelDetails, setChannelDetails] = useState<Channel | null>(null);

  const [currentProgram, setCurrentProgram] = useState<Program | null>(null);
  const [upcomingPrograms, setUpcomingPrograms] = useState<Program[]>([]);

  const [videoPlayerKey, setVideoPlayerKey] = useState<number>(Date.now());
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Parse & validate channel id
  useEffect(() => {
    if (!channelIdString) {
      setError("Channel ID is missing in URL.");
      setIsLoading(false);
      return;
    }
    const n = Number.parseInt(channelIdString, 10);
    if (!Number.isInteger(n)) {
      setError("Invalid channel ID format in URL.");
      setIsLoading(false);
      return;
    }
    setChannelId(n);
    setError(null);
  }, [channelIdString]);

  // Load channel details (uses numeric id)
  useEffect(() => {
    if (channelId == null) return;
    let cancelled = false;

    (async () => {
      setIsLoading(true);
      try {
        const details = await fetchChannelById(supabase, channelId);
        if (!cancelled) {
          setChannelDetails(details);
          if (!details) setError("Could not load channel details.");
        }
      } catch (e: any) {
        if (!cancelled) setError(e?.message || "Error loading channel details.");
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [channelId]);

  // Fetch current program (strictly for this channel)
  const fetchCurrentProgram = useCallback(
    async (numericChannelId: number) => {
      setIsLoading(true);
      const nowMs = Date.now();
      try {
        const { data, error: dbError } = await supabase
          .from("programs")
          .select("channel_id,title,mp4_url,start_time,duration") // ONLY your real columns
          .eq("channel_id", numericChannelId)
          .order("start_time", { ascending: true });

        if (dbError) throw new Error(`Database error: ${dbError.message}`);

        const rows = (data || []) as Program[];
        const active = pickActiveProgram(rows, nowMs);

        let programToSet: Program;

        if (active) {
          programToSet = { ...active, channel_id: numericChannelId };
        } else {
          // Standby fallback per-channel
          programToSet = {
            // NOTE: your table has no `id`; this placeholder `id` is only for internal flagging
            id: STANDBY_PLACEHOLDER_ID as any,
            title: "Standby Programming",
            description: "Programming will resume shortly.",
            channel_id: numericChannelId,
            mp4_url: `channel${numericChannelId}/standby_blacktruthtv.mp4`,
            duration: 300,
            start_time: new Date().toISOString(),
            // your schema uses logo_url for the channel artwork
            poster_url: (channelDetails as any)?.logo_url || null,
          } as unknown as Program;
        }

        // Reset the player if the media actually changed
        setCurrentProgram((prev) => {
          const prevSrc = prev ? getVideoUrlForProgram(prev) : undefined;
          const nextSrc = getVideoUrlForProgram(programToSet);
          const changed = prevSrc !== nextSrc || prev?.start_time !== programToSet.start_time;
          if (changed) setVideoPlayerKey(Date.now());
          return programToSet;
        });
      } catch (e: any) {
        setError(e?.message || "Error loading schedule.");
        setCurrentProgram({
          id: STANDBY_PLACEHOLDER_ID as any,
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

  // Fetch next 6 upcoming for this channel
  const fetchUpcoming = useCallback(async (numericChannelId: number) => {
    try {
      const nowIso = new Date().toISOString(); // UTC with Z
      const { data, error } = await supabase
        .from("programs")
        .select("channel_id,title,mp4_url,start_time,duration")
        .eq("channel_id", numericChannelId)
        .gt("start_time", nowIso)
        .order("start_time", { ascending: true })
        .limit(6);

      if (!error && data) setUpcomingPrograms(data as Program[]);
    } catch (e) {
      console.warn("Error loading upcoming programs", e);
    }
  }, []);

  // Polling (skip CH21 which is YouTube Live)
  useEffect(() => {
    if (channelId == null) return;
    let timer: NodeJS.Timeout | null = null;

    if (channelId === CH21_ID_NUMERIC) {
      setIsLoading(false);
      return;
    }

    // Initial fetch
    fetchCurrentProgram(channelId);
    fetchUpcoming(channelId);

    // Poll when tab is visible
    timer = setInterval(() => {
      if (document.visibilityState === "visible") {
        fetchCurrentProgram(channelId);
        fetchUpcoming(channelId);
      }
    }, 60_000);

    return () => {
      if (timer) clearInterval(timer);
    };
  }, [channelId, fetchCurrentProgram, fetchUpcoming]);

  // Player props
  const videoSrc = currentProgram ? getVideoUrlForProgram(currentProgram) : undefined;
  const posterSrc =
    (currentProgram as any)?.poster_url ||
    (channelDetails as any)?.logo_url ||
    undefined;
  const isStandby = (currentProgram as any)?.id === STANDBY_PLACEHOLDER_ID;

  const handleEnded = useCallback(() => {
    if (channelId != null && channelId !== CH21_ID_NUMERIC) {
      fetchCurrentProgram(channelId);
      fetchUpcoming(channelId);
    }
  }, [channelId, fetchCurrentProgram, fetchUpcoming]);

  // Render
  const isCh21 = channelId === CH21_ID_NUMERIC;

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
        <p>Loading Channel…</p>
      </div>
    );
  } else if (currentProgram && videoSrc) {
    content = (
      <VideoPlayer
        key={videoPlayerKey}
        src={videoSrc}
        poster={posterSrc}
        isStandby={isStandby}
        programTitle={currentProgram?.title}
        onVideoEnded={handleEnded}
      />
    );
  } else {
    content = <p className="text-gray-400 p-4 text-center">Initializing channel…</p>;
  }

  return (
    <div className="bg-black min-h-screen flex flex-col text-white">
      <div className="p-4 flex items-center justify-between bg-gray-900/50 sticky top-0 z-10">
        <button
          onClick={() => router.back()}
          className="p-2 rounded-full hover:bg-gray-700"
          aria-label="Go back"
        >
          <ChevronLeft className="h-6 w-6" />
        </button>
        <h1 className="text-xl font-semibold truncate px-2">
          {channelDetails?.name || (channelId != null ? `Channel ${channelId}` : "Channel")}
        </h1>
        <div className="w-10 h-10" />
      </div>

      {/* Video */}
      <div className="w-full aspect-video bg-black flex items-center justify-center">
        {content}
      </div>

      {/* Below the player */}
      <div className="p-4 flex-grow">
        {channelId !== CH21_ID_NUMERIC && currentProgram && !isLoading && (
          <>
            <h2 className="text-2xl font-bold">{currentProgram.title}</h2>
            <p className="text-sm text-gray-400">
              Channel: {channelDetails?.name || (channelId != null ? `Channel ${channelId}` : "")}
            </p>
            {!(isStandby) && currentProgram.start_time && (
              <p className="text-sm text-gray-400">
                Scheduled Start: {new Date(currentProgram.start_time).toLocaleString()}
              </p>
            )}

            {currentProgram?.description && (
              <p className="text-xs text-gray-300 mt-1">{currentProgram.description}</p>
            )}

            {upcomingPrograms.length > 0 && (
              <div className="mt-6">
                <h3 className="text-lg font-semibold text-white mb-2">Upcoming Programs</h3>
                <ul className="text-sm text-gray-300 space-y-1">
                  {upcomingPrograms.map((p, idx) => (
                    <li
                      // No `id` column → use a stable composite key
                      key={`${p.channel_id}-${p.start_time}-${p.title}-${idx}`}
                    >
                      <span className="font-medium">{p.title}</span>{" "}
                      <span className="text-gray-400">
                        —{" "}
                        {new Date(p.start_time!).toLocaleTimeString("en-US", {
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
