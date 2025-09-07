"use client";

import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import VideoPlayer from "@/components/video-player";
import {
  getCandidateUrlsForProgram,
  getVideoUrlForProgram,
  fetchChannelById,
  supabase,
  STANDBY_PLACEHOLDER_ID,
} from "@/lib/supabase";
import type { Channel, Program } from "@/types";
import { ChevronLeft, Loader2 } from "lucide-react";

type ProgramWithSrc = Program & { _resolved_src?: string };

const CH21_ID_NUMERIC = 21;
const YT_CH21 = "UCMkW239dyAxDyOFDP0D6p2g";
const GRACE_MS = 120_000; // 2 minutes grace around start/end

// --- In-memory cache so we don't keep probing the same asset
// key = `${channel_id}|${mp4_url}|${start_time}`
const urlProbeCache = new Map<string, string | null>();

// ----- time + duration helpers -----
function asSeconds(v: unknown): number {
  if (v == null) return 0;
  if (typeof v === "number" && Number.isFinite(v)) return v;
  const s = String(v).trim();
  const m = /^(\d{1,3}):([0-5]?\d)(?::([0-5]?\d))?$/.exec(s); // HH:MM:SS or MM:SS
  if (m) {
    const hh = m[3] ? Number(m[1]) : 0;
    const mm = Number(m[3] ? m[2] : m[1]);
    const ss = Number(m[3] ? m[3] : m[2]);
    return hh * 3600 + mm * 60 + ss;
  }
  const num = Number(s.replace(/[^\d.]+/g, ""));
  return Number.isFinite(num) && num > 0 ? Math.round(num) : 0;
}

function parseUtcishMs(val: unknown): number {
  const s = String(val || "").trim();
  if (!s) return NaN;
  if (/Z$|[+\-]\d{2}:\d{2}$/.test(s)) return Date.parse(s);
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?$/.test(s)) return Date.parse(s + "Z");
  return Date.parse(s);
}

function isActiveProgram(p: Program, nowMs: number): boolean {
  const startMs = parseUtcishMs(p.start_time);
  const durSec = asSeconds(p.duration);
  if (!Number.isFinite(startMs) || durSec <= 0) return false;
  const endMs = startMs + durSec * 1000;
  return (startMs - GRACE_MS) <= nowMs && nowMs < (endMs + GRACE_MS);
}

/** Try candidate video URLs and return the first that loads metadata (with timeout & CORS). */
async function pickPlayableUrl(candidates: string[], perUrlTimeoutMs = 4000): Promise<string | undefined> {
  for (const url of candidates) {
    // eslint-disable-next-line no-await-in-loop
    const ok = await new Promise<boolean>((resolve) => {
      const v = document.createElement("video");
      v.muted = true;                       // allow autoplay for metadata
      (v as any).playsInline = true;
      v.crossOrigin = "anonymous";          // avoid CORS metadata issues
      v.preload = "metadata";

      let settled = false;
      const cleanup = () => {
        v.onloadedmetadata = null;
        v.onerror = null;
        try { v.src = ""; v.load(); } catch {}
      };

      const to = setTimeout(() => {
        if (!settled) {
          settled = true;
          cleanup();
          resolve(false);
        }
      }, perUrlTimeoutMs);

      v.onloadedmetadata = () => {
        if (!settled) {
          settled = true;
          clearTimeout(to);
          cleanup();
          resolve(true);
        }
      };
      v.onerror = () => {
        if (!settled) {
          settled = true;
          clearTimeout(to);
          cleanup();
          resolve(false);
        }
      };

      v.src = url;
      try { v.load(); } catch {}
    });

    if (ok) return url;
  }
  return undefined;
}

export default function WatchPage() {
  const params = useParams();
  const router = useRouter();
  const channelIdString = params.channelId as string;

  const [channelId, setChannelId] = useState<number | null>(null);
  const [channelDetails, setChannelDetails] = useState<Channel | null>(null);
  const [currentProgram, setCurrentProgram] = useState<ProgramWithSrc | null>(null);
  const [upcomingPrograms, setUpcomingPrograms] = useState<ProgramWithSrc[]>([]);
  const [videoPlayerKey, setVideoPlayerKey] = useState<number>(Date.now());
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isResolvingSrc, setIsResolvingSrc] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const getNowMs = useCallback(() => Date.now(), []);

  // Parse channel id (programs.channel_id is int8 → number)
  useEffect(() => {
    const n = Number.parseInt(channelIdString || "", 10);
    if (!Number.isInteger(n)) {
      setError("Invalid channel ID in URL.");
      setIsLoading(false);
    } else {
      setChannelId(n);
      setError(null);
    }
  }, [channelIdString]);

  // Load channel details (channels.id is TEXT → pass string)
  useEffect(() => {
    if (channelId == null) return;
    let cancelled = false;
    (async () => {
      setIsLoading(true);
      try {
        const details = await fetchChannelById(supabase, String(channelId));
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

  // Fetch current program (with probing + cache + stickiness)
  const fetchCurrentProgram = useCallback(
    async (numericChannelId: number) => {
      const nowMs = getNowMs();

      // EARLY RETURN: if still within current program window and we have a good URL, do nothing
      if (currentProgram && isActiveProgram(currentProgram, nowMs) && currentProgram._resolved_src) {
        return;
      }

      try {
        setIsResolvingSrc(true); // show resolving overlay (prevents standby flicker)

        const { data, error: dbError } = await supabase
          .from("programs")
          .select("channel_id,title,mp4_url,start_time,duration")
          .eq("channel_id", numericChannelId)
          .order("start_time", { ascending: true });

        if (dbError) throw new Error(`Database error: ${dbError.message}`);

        const rows = (data || []) as Program[];
        let active = rows.find((p) => isActiveProgram(p, nowMs));

        // Choose program (active or standby)
        let programToSet: Program =
          active
            ? { ...active, channel_id: numericChannelId }
            : ({
                id: STANDBY_PLACEHOLDER_ID as any,
                title: "Standby Programming",
                description: "Programming will resume shortly.",
                channel_id: numericChannelId,
                mp4_url: `channel${numericChannelId}/standby_blacktruthtv.mp4`,
                duration: 300,
                start_time: new Date().toISOString(),
                poster_url: (channelDetails as any)?.logo_url || null,
              } as unknown as Program);

        // Build a cache key specific to this asset instance
        const cacheKey = `${programToSet.channel_id}|${programToSet.mp4_url}|${programToSet.start_time}`;

        // Resolve a playable URL (use cache first)
        let resolvedSrc = urlProbeCache.get(cacheKey) ?? undefined;
        if (resolvedSrc === undefined) {
          const candidates = getCandidateUrlsForProgram(programToSet);
          resolvedSrc = (await pickPlayableUrl(candidates)) ?? null; // null = probed and failed
          urlProbeCache.set(cacheKey, resolvedSrc);
        }

        // If failed, force standby (but only after probing completes)
        if (!resolvedSrc) {
          programToSet = {
            id: STANDBY_PLACEHOLDER_ID as any,
            title: "Standby Programming",
            description: "File missing or misnamed. Standby will play.",
            channel_id: numericChannelId,
            mp4_url: `channel${numericChannelId}/standby_blacktruthtv.mp4`,
            duration: 300,
            start_time: new Date().toISOString(),
            poster_url: (channelDetails as any)?.logo_url || null,
          } as unknown as Program;
          // Standby URL doesn't need probing (assumed to exist)
          resolvedSrc = getVideoUrlForProgram(programToSet) || "";
        }

        const finalProgram: ProgramWithSrc = { ...(programToSet as ProgramWithSrc), _resolved_src: resolvedSrc || "" };

        setCurrentProgram((prev) => {
          const prevSrc = prev?._resolved_src;
          const changed = prevSrc !== finalProgram._resolved_src || prev?.start_time !== finalProgram.start_time;
          if (changed) setVideoPlayerKey(Date.now());
          return finalProgram;
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
          _resolved_src: getVideoUrlForProgram({
            channel_id: numericChannelId,
            mp4_url: `channel${numericChannelId}/standby_blacktruthtv.mp4`,
          } as Program) || "",
        } as ProgramWithSrc);
      } finally {
        setIsResolvingSrc(false);
      }
    },
    [channelDetails, getNowMs, currentProgram]
  );

  // Fetch next 6 upcoming for this channel
  const fetchUpcoming = useCallback(async (numericChannelId: number) => {
    try {
      const nowIso = new Date().toISOString();
      const { data, error } = await supabase
        .from("programs")
        .select("channel_id,title,mp4_url,start_time,duration")
        .eq("channel_id", numericChannelId)
        .gt("start_time", nowIso)
        .order("start_time", { ascending: true })
        .limit(6);

      if (!error && data) setUpcomingPrograms(data as ProgramWithSrc[]);
    } catch (e) {
      console.warn("Error loading upcoming programs", e);
    }
  }, []);

  // Smarter polling: wake near expected end, otherwise every 60s; don't poll while probing
  useEffect(() => {
    if (channelId == null) return;
    if (channelId === CH21_ID_NUMERIC) { setIsLoading(false); return; }

    let timer: NodeJS.Timeout | null = null;

    const refetch = () => {
      if (document.visibilityState !== "visible") return;
      if (isResolvingSrc) return; // do not refetch while we're probing
      fetchCurrentProgram(channelId);
      fetchUpcoming(channelId);
    };

    // initial
    refetch();

    const scheduleNext = () => {
      if (currentProgram?.start_time && currentProgram?.duration) {
        const s = parseUtcishMs(currentProgram.start_time);
        const d = asSeconds(currentProgram.duration);
        if (Number.isFinite(s) && d > 0) {
          const endMs = s + d * 1000;
          const wakeIn = Math.max(5_000, endMs - Date.now() - 5_000); // 5s before end
          timer = setTimeout(() => { refetch(); scheduleNext(); }, wakeIn);
          return;
        }
      }
      // no active program → poll in 60s
      timer = setTimeout(() => { refetch(); scheduleNext(); }, 60_000);
    };

    scheduleNext();
    return () => { if (timer) clearTimeout(timer); };
  }, [channelId, currentProgram, fetchCurrentProgram, fetchUpcoming, isResolvingSrc]);

  // Player & render
  const videoSrc = currentProgram?._resolved_src; // <- use the probed, cached URL
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
    // Show the player if we have a URL (even if a background probe is still resolving)
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
  } else if (isResolvingSrc) {
    // Only show spinner if we don't yet have any playable URL
    content = (
      <div className="flex flex-col items-center justify-center h-full">
        <Loader2 className="h-10 w-10 animate-spin text-red-500 mb-2" />
        <p>Preparing stream…</p>
      </div>
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

      {/* Video area */}
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
            {!isStandby && currentProgram.start_time && (
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
                    <li key={`${p.channel_id}-${p.start_time}-${p.title}-${idx}`}>
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
