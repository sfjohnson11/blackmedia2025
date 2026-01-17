"use client";

import { useParams, useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useState,
  type ReactNode,
  type FormEvent,
} from "react";
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

type ChatMessage = {
  id: string;
  room_id: string;
  sender_id: string;
  message: string;
  created_at: string;
};

const CH21_ID_NUMERIC = 21;
const YT_CH21 = "UCMkW239dyAxDyOFDP0D6p2g";
const GRACE_MS = 120_000; // 2 minutes grace around start/end

// 🔒 Feature flag (server env). Default OFF. Turn ON only after deploy + when ready to flip buckets.
const USE_SIGNED_MEDIA =
  typeof window !== "undefined" &&
  String(process.env.NEXT_PUBLIC_USE_SIGNED_MEDIA || "").toLowerCase() === "true";

// In-memory cache so we don't keep probing the same asset
// key = `${channel_id}|${mp4_url}|${start_time}`
const urlProbeCache = new Map<string, string | null>();

/* ---------------- UI overlays (pure UI; safe to add) ---------------- */
const LoadingOverlay = ({
  visible,
  label = "Preparing stream…",
}: {
  visible: boolean;
  label?: string;
}) => {
  if (!visible) return null;
  return (
    <div
      className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-[1px] pointer-events-none select-none"
      aria-live="polite"
      role="status"
    >
      <div className="flex items-center gap-3 px-4 py-2 rounded-full bg-black/60">
        <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24" aria-hidden="true">
          <circle
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
            fill="none"
            opacity=".25"
          />
          <path
            d="M22 12a10 10 0 0 1-10 10"
            fill="none"
            stroke="currentColor"
            strokeWidth="4"
          />
        </svg>
        <span className="text-sm">{label}</span>
      </div>
    </div>
  );
};

const MobileHint = ({ show }: { show: boolean }) => {
  if (!show) return null;
  return (
    <div className="absolute bottom-3 left-1/2 -translate-x-1/2 px-3 py-1.5 rounded-full bg-black/60 text-xs pointer-events-none">
      Tap for sound if muted
    </div>
  );
};
/* ------------------------------------------------------------------- */

/* ---------- Time & duration helpers ---------- */
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

/** Robust UTC parser — accepts common Postgres/Supabase variants and coerces to UTC */
function parseUtcishMs(val: unknown): number {
  if (val == null) return NaN;
  let s = String(val).trim();
  if (!s) return NaN;

  // "YYYY-MM-DD HH:mm:ss" -> "YYYY-MM-DDTHH:mm:ss"
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/.test(s)) {
    s = s.replace(" ", "T");
  }

  if (/[zZ]$/.test(s)) {
    s = s.replace(/[zZ]$/, "Z");
  } else {
    // Normalize offsets: +00, +0000, +00:00, +07, +0730 → "+00:00"/"+07:30"
    const m = /([+\-]\d{2})(:?)(\d{2})?$/.exec(s);
    if (m) {
      const hh = m[1];
      const mm = m[3] ?? "00";
      s = s.replace(/([+\-]\d{2})(:?)(\d{2})?$/, `${hh}:${mm}`);
      if (/([+\-]00:00)$/.test(s)) s = s.replace(/([+\-]00:00)$/, "Z");
    } else if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?$/.test(s)) {
      s += "Z"; // bare ISO → UTC
    } else if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(?:\.\d+)?$/.test(s)) {
      s = s.replace(" ", "T") + "Z"; // bare datetime → UTC
    }
  }

  const t = Date.parse(s);
  return Number.isNaN(t) ? NaN : t;
}

function isActiveProgram(p: Program, nowMs: number): boolean {
  const startMs = parseUtcishMs(p.start_time);
  const durSec = asSeconds(p.duration);
  if (!Number.isFinite(startMs) || durSec <= 0) return false;
  const endMs = startMs + durSec * 1000;
  return startMs - GRACE_MS <= nowMs && nowMs < endMs + GRACE_MS;
}

/** Quick HEAD check; ok = fast positive signal, but not required */
async function headOk(url: string, timeoutMs = 4500): Promise<boolean> {
  try {
    const ctrl = new AbortController();
    const to = setTimeout(() => ctrl.abort(), timeoutMs);
    const res = await fetch(url, {
      method: "HEAD",
      mode: "cors",
      redirect: "follow",
      signal: ctrl.signal as any,
    });
    clearTimeout(to);
    return res.ok;
  } catch {
    return false; // CORS/timeout doesn't prove it's missing
  }
}

/** Resolve candidate: HEAD pass first, then metadata probe with longer timeout */
async function resolvePlayableUrl(candidates: string[]): Promise<string | undefined> {
  for (const url of candidates) {
    const ok = await headOk(url, 4500);
    if (ok) return url;
  }
  for (const url of candidates) {
    // eslint-disable-next-line no-await-in-loop
    const ok = await new Promise<boolean>((resolve) => {
      const v = document.createElement("video");
      v.muted = true;
      (v as any).playsInline = true;
      v.crossOrigin = "anonymous";
      v.preload = "metadata";

      let settled = false;
      const cleanup = () => {
        v.onloadedmetadata = null;
        v.onerror = null;
        try {
          v.src = "";
          v.load();
        } catch {}
      };

      const to = setTimeout(() => {
        if (!settled) {
          settled = true;
          cleanup();
          resolve(false);
        }
      }, 12_000); // allow slow storage

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
      try {
        v.load();
      } catch {}
    });
    if (ok) return url;
  }
  return undefined; // we'll still try the first candidate in the player if needed
}

/* ---------------- Signed URL helper (SAFE: never crashes watch page) ---------------- */
function parseSupabaseStorageUrl(
  url: string
): { bucket: string; path: string } | null {
  try {
    const u = new URL(url);
    const parts = u.pathname.split("/").filter(Boolean);

    // /storage/v1/object/public/<bucket>/<path...>
    const idx = parts.findIndex((p) => p === "object");
    if (idx === -1) return null;

    const bucket = parts[idx + 2];
    const path = parts.slice(idx + 3).join("/");
    if (!bucket || !path) return null;

    return { bucket, path };
  } catch {
    return null;
  }
}

async function getSignedUrlFromPublicUrl(publicUrl: string): Promise<string | null> {
  // If feature flag off, don't attempt
  if (!USE_SIGNED_MEDIA) return null;

  // If it's not a Supabase storage URL, leave it alone
  if (!publicUrl.includes("/storage/v1/object/")) return null;

  const parsed = parseSupabaseStorageUrl(publicUrl);
  if (!parsed) return null;

  try {
    const res = await fetch("/api/media/signed-url", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(parsed),
    });

    const j = await res.json().catch(() => ({}));

    if (!res.ok) {
      return null;
    }

    return typeof j?.signedUrl === "string" ? j.signedUrl : null;
  } catch {
    return null;
  }
}
/* ------------------------------------------------------------------- */

export default function WatchPage() {
  const params = useParams();
  const router = useRouter();
  const channelIdString = params.channelId as string;

  const [channelId, setChannelId] = useState<number | null>(null);
  const [channelDetails, setChannelDetails] = useState<Channel | null>(null);
  const [currentProgram, setCurrentProgram] =
    useState<ProgramWithSrc | null>(null);
  const [upcomingPrograms, setUpcomingPrograms] = useState<ProgramWithSrc[]>([]);
  const [videoPlayerKey, setVideoPlayerKey] = useState<number>(Date.now());
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isResolvingSrc, setIsResolvingSrc] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // 🔹 Signed src state (does NOT affect anything until buckets are private / flag enabled)
  const [signedVideoSrc, setSignedVideoSrc] = useState<string | null>(null);

  // 🔹 Chat state
  const [chatRoomId, setChatRoomId] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatLoading, setChatLoading] = useState<boolean>(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);

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
      if (
        currentProgram &&
        isActiveProgram(currentProgram, nowMs) &&
        currentProgram._resolved_src
      ) {
        return;
      }

      try {
        setIsResolvingSrc(true); // show resolving overlay

        const { data, error: dbError } = await supabase
          .from("programs")
          .select("channel_id,title,mp4_url,start_time,duration")
          .eq("channel_id", numericChannelId)
          .order("start_time", { ascending: true });

        if (dbError) throw new Error(`Database error: ${dbError.message}`);

        const rows = (data || []) as Program[];
        const active = rows.find((p) => isActiveProgram(p, nowMs));

        // Choose program (active or standby)
        let programToSet: Program = active
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

          // ✅ IMPORTANT CHANGE:
          // If you turn on signed media + buckets are private, probing HEAD/metadata will fail.
          // So we pick the first candidate and later convert it to a signed URL for playback.
          if (USE_SIGNED_MEDIA) {
            resolvedSrc = candidates[0] ?? null;
          } else {
            // Normal current behavior (public buckets)
            resolvedSrc =
              (await resolvePlayableUrl(candidates)) ?? candidates[0] ?? null;
          }

          urlProbeCache.set(cacheKey, resolvedSrc);
        }

        // If we have no candidates at all, or resolution failed → use this channel's standby
        if (!resolvedSrc) {
          programToSet = {
            id: STANDBY_PLACEHOLDER_ID as any,
            title: "Standby Programming",
            description: "File missing/unreachable. Playing standby.",
            channel_id: numericChannelId,
            mp4_url: `channel${numericChannelId}/standby_blacktruthtv.mp4`,
            duration: 300,
            start_time: new Date().toISOString(),
            poster_url: (channelDetails as any)?.logo_url || null,
          } as unknown as Program;
          resolvedSrc = getVideoUrlForProgram(programToSet) || "";
        }

        const finalProgram: ProgramWithSrc = {
          ...(programToSet as ProgramWithSrc),
          _resolved_src: resolvedSrc || "",
        };

        setCurrentProgram((prev) => {
          const prevSrc = prev?._resolved_src;
          const changed =
            prevSrc !== finalProgram._resolved_src ||
            prev?.start_time !== finalProgram.start_time;
          if (changed) setVideoPlayerKey(Date.now());
          return finalProgram;
        });
      } catch (e: any) {
        setError(e?.message || "Error loading schedule.");
        setCurrentProgram({
          id: STANDBY_PLACEHOLDER_ID as any,
          title: "Standby Programming - Error",
          description: "Error loading schedule. Standby will play.",
          channel_id: numericChannelId,
          mp4_url: `channel${numericChannelId}/standby_blacktruthtv.mp4`,
          duration: 300,
          start_time: new Date().toISOString(),
          poster_url: (channelDetails as any)?.logo_url || null,
          _resolved_src:
            getVideoUrlForProgram({
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

  // Polling: wake near expected end, otherwise every 60s; don't poll while probing
  useEffect(() => {
    if (channelId == null) return;
    if (channelId === CH21_ID_NUMERIC) {
      setIsLoading(false);
      return;
    }

    let timer: NodeJS.Timeout | null = null;

    const refetch = () => {
      if (document.visibilityState !== "visible") return;
      if (isResolvingSrc) return; // do not refetch while probing
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
          timer = setTimeout(() => {
            refetch();
            scheduleNext();
          }, wakeIn);
          return;
        }
      }
      // no active program → poll in 60s
      timer = setTimeout(() => {
        refetch();
        scheduleNext();
      }, 60_000);
    };

    scheduleNext();
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [
    channelId,
    currentProgram,
    fetchCurrentProgram,
    fetchUpcoming,
    isResolvingSrc,
  ]);

  // 🔹 When currentProgram._resolved_src changes, attempt to sign it (only when flag enabled)
  useEffect(() => {
    let cancelled = false;

    (async () => {
      const publicUrl = currentProgram?._resolved_src || null;

      // Clear when program changes
      setSignedVideoSrc(null);

      if (!publicUrl) return;
      if (!USE_SIGNED_MEDIA) return;

      const signed = await getSignedUrlFromPublicUrl(publicUrl);
      if (!cancelled && signed) {
        setSignedVideoSrc(signed);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [currentProgram?._resolved_src]);

  // 🔹 Load chat room for this channel
  useEffect(() => {
    if (channelId == null) return;
    let cancelled = false;

    (async () => {
      setChatLoading(true);
      setChatError(null);
      try {
        const { data, error } = await supabase
          .from("chat_rooms")
          .select("id")
          .eq("channel_id", channelId)
          .limit(1)
          .maybeSingle();

        if (error) throw error;

        if (!data) {
          if (!cancelled) {
            setChatRoomId(null);
            setChatError("Chat is not enabled for this channel yet.");
          }
        } else {
          if (!cancelled) {
            setChatRoomId(data.id as string);
          }
        }
      } catch (e: any) {
        if (!cancelled) {
          console.error("Error loading chat room:", e);
          setChatError("Could not load chat room.");
        }
      } finally {
        if (!cancelled) setChatLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [channelId]);

  // 🔹 Load chat messages (simple polling)
  useEffect(() => {
    if (!chatRoomId) return;
    let cancelled = false;

    const loadMessages = async () => {
      try {
        const { data, error } = await supabase
          .from("chat_messages")
          .select("id,room_id,sender_id,message,created_at")
          .eq("room_id", chatRoomId)
          .order("created_at", { ascending: true });

        if (error) throw error;
        if (!cancelled) {
          setChatMessages((data || []) as ChatMessage[]);
        }
      } catch (e) {
        if (!cancelled) {
          console.error("Error loading chat messages:", e);
          setChatError("Could not load chat messages.");
        }
      }
    };

    loadMessages();
    const interval = setInterval(loadMessages, 5000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [chatRoomId]);

  // 🔹 Send a message
  const handleSendMessage = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!newMessage.trim() || !chatRoomId || sending) return;

    setSending(true);
    setChatError(null);

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        throw new Error("You must be logged in to send a message.");
      }

      const { data, error } = await supabase
        .from("chat_messages")
        .insert({
          room_id: chatRoomId,
          sender_id: user.id,
          message: newMessage.trim(),
        })
        .select("id,room_id,sender_id,message,created_at")
        .single();

      if (error) throw error;

      setChatMessages((prev) => [...prev, data as ChatMessage]);
      setNewMessage("");
    } catch (e: any) {
      console.error("Error sending chat message:", e);
      setChatError(e?.message || "Could not send message.");
    } finally {
      setSending(false);
    }
  };

  // Player & render
  const videoSrc = currentProgram?._resolved_src; // current behavior
  const finalVideoSrc = signedVideoSrc || videoSrc; // ✅ only change that matters
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
  } else if (currentProgram && finalVideoSrc) {
    // Show the player if we have a URL
    content = (
      <VideoPlayer
        key={videoPlayerKey}
        src={finalVideoSrc}
        poster={posterSrc}
        isStandby={isStandby}
        programTitle={currentProgram?.title}
        onVideoEnded={handleEnded}
      />
    );
  } else if (isResolvingSrc) {
    content = (
      <div className="flex flex-col items-center justify-center h-full">
        <Loader2 className="h-10 w-10 animate-spin text-red-500 mb-2" />
        <p>Preparing stream…</p>
      </div>
    );
  } else {
    content = (
      <p className="text-gray-400 p-4 text-center">Initializing channel…</p>
    );
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
          {channelDetails?.name ||
            (channelId != null ? `Channel ${channelId}` : "Channel")}
        </h1>
        <div className="w-10 h-10" />
      </div>

      {/* Video area + subtle overlays */}
      <div className="relative w-full aspect-video bg-black flex items-center justify-center">
        {content}
        <LoadingOverlay
          visible={Boolean((isLoading && !currentProgram) || isResolvingSrc)}
          label={
            isLoading && !currentProgram ? "Loading channel…" : "Preparing stream…"
          }
        />
        <MobileHint show={!isResolvingSrc && Boolean(currentProgram?._resolved_src)} />
      </div>

      {/* Below the player */}
      <div className="p-4 flex-grow space-y-6">
        {/* Program info (non-CH21) */}
        {channelId !== CH21_ID_NUMERIC && currentProgram && !isLoading && (
          <>
            <div>
              <h2 className="text-2xl font-bold">{currentProgram.title}</h2>
              <p className="text-sm text-gray-400">
                Channel:{" "}
                {channelDetails?.name ||
                  (channelId != null ? `Channel ${channelId}` : "")}
              </p>
              {!isStandby && currentProgram.start_time && (
                <p className="text-sm text-gray-400">
                  Scheduled Start: {new Date(currentProgram.start_time).toLocaleString()}
                </p>
              )}
              {currentProgram?.description && (
                <p className="text-xs text-gray-300 mt-1">{currentProgram.description}</p>
              )}
            </div>

            {upcomingPrograms.length > 0 && (
              <div className="mt-2">
                <h3 className="text-lg font-semibold text-white mb-2">
                  Upcoming Programs
                </h3>
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

        {/* 🔹 Channel Chat (all channels, including 21) */}
        <div className="mt-4 rounded-2xl border border-gray-800 bg-gray-950/70 p-4">
          <div className="flex items-center justify-between mb-2">
            <div>
              <h3 className="text-lg font-semibold">Channel Chat</h3>
              <p className="text-xs text-gray-400">
                Talk with other members about what&apos;s on this channel.
              </p>
            </div>
            {channelId != null && (
              <span className="text-[11px] text-gray-500">
                Channel {channelDetails?.name || channelId}
              </span>
            )}
          </div>

          {chatError && <p className="text-xs text-red-400 mb-2">{chatError}</p>}

          {!chatRoomId && !chatError && !chatLoading && (
            <p className="text-xs text-gray-400">
              Chat is not enabled for this channel yet.
            </p>
          )}

          {chatRoomId && (
            <>
              <div className="h-56 max-h-72 mb-3 rounded-lg border border-gray-800 bg-black/60 p-2 overflow-y-auto text-xs">
                {chatLoading && !chatMessages.length ? (
                  <p className="text-gray-400">Loading chat…</p>
                ) : chatMessages.length === 0 ? (
                  <p className="text-gray-400">
                    No messages yet. Be the first to add a comment.
                  </p>
                ) : (
                  chatMessages.map((m) => (
                    <div key={m.id} className="mb-1.5">
                      <span className="text-[10px] text-gray-500 mr-1">
                        {new Date(m.created_at).toLocaleTimeString("en-US", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                      <span className="font-semibold text-amber-300 mr-1">Member</span>
                      <span className="text-gray-100 break-words">{m.message}</span>
                    </div>
                  ))
                )}
              </div>

              <form onSubmit={handleSendMessage} className="flex gap-2 items-center">
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Type a comment…"
                  className="flex-1 rounded-full border border-gray-700 bg-gray-950 px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-amber-400"
                />
                <button
                  type="submit"
                  disabled={sending || !newMessage.trim()}
                  className="rounded-full bg-amber-600 px-3 py-1.5 text-xs font-semibold text-black hover:bg-amber-500 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {sending ? "Sending…" : "Send"}
                </button>
              </form>

              <p className="mt-1 text-[10px] text-gray-500">
                Chat is moderated. Please keep comments respectful.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
