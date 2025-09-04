// app/watch/[channelId]/page.tsx
// Strict public MP4 or YouTube (CH21), UTC schedule, minimal retries, debug link.
// Columns used match your schema EXACTLY. No auth/signer, no relative path magic.

"use client";

import { useEffect, useState, useCallback, useRef, type ReactNode } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Loader2, ChevronLeft } from "lucide-react";
import { supabase } from "@/lib/supabase";

/* ───────── DB row types (match your schema) ───────── */
type ChannelRow = {
  id: number;
  name: string | null;
  slug: string | null;
  description: string | null;
  logo_url: string | null;
  image_url: string | null;
  youtube_channel_id: string | null;
  youtube_is_live: boolean | null;
  is_active: boolean | null;
};

type ProgramRow = {
  id: string;
  channel_id: number;
  title: string;
  mp4_url: string | null; // "bucket:path/file.mp4" OR "https://..." OR "youtube_channel:ID"
  start_time: string;     // UTC
  duration: number;       // seconds
};

/* ───────── constants ───────── */
const CH21 = 21;
const ALWAYS_YT = new Set([CH21]);
const START_EARLY_GRACE_MS = 30_000;
const END_LATE_GRACE_MS = 15_000;
const STANDBY_OBJECT = "standby_blacktruthtv.mp4"; // must exist in each channel bucket

/* ───────── helpers ───────── */
const baseUrl = (u?: string | null) => (u ?? "").split("?")[0];

function toUtcDate(val?: string | Date | null): Date | null {
  if (!val) return null;
  if (val instanceof Date) return Number.isNaN(val.getTime()) ? null : val;
  let s = String(val).trim();
  // allow "YYYY-MM-DD HH:mm:ss"
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(\.\d+)?$/.test(s)) s = s.replace(" ", "T") + "Z";
  // if no timezone, treat as Z (UTC)
  else if (!/[zZ]|[+\-]\d{2}:\d{2}$/.test(s)) s = s + "Z";
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

function publicUrl(bucket: string, objectPath: string): string | undefined {
  const clean = objectPath.replace(/^\/+/, "");
  try {
    const { data } = supabase.storage.from(bucket).getPublicUrl(clean);
    return data?.publicUrl || undefined;
  } catch {
    return undefined;
  }
}

/** STRICT resolver:
 * - "https://..." → as-is
 * - "/..." (site-relative) → as-is (if you ever host locally)
 * - "bucketName:path/inside/bucket.mp4" → resolve via Storage public URL
 * - "youtube_channel:ID" → handled upstream (returns undefined here)
 * - anything else → undefined
 */
function resolveMp4UrlStrict(raw: string | null | undefined): string | undefined {
  if (!raw) return undefined;
  if (raw.startsWith("youtube_channel:")) return undefined; // handled elsewhere
  if (/^https?:\/\//i.test(raw) || raw.startsWith("/")) return raw;

  const i = raw.indexOf(":");
  if (i > 0) {
    const bucket = raw.slice(0, i).trim();
    const path = raw.slice(i + 1).replace(/^\/+/, "");
    if (!bucket || !path) return undefined;
    return publicUrl(bucket, path);
  }
  return undefined; // no relative support
}

/* ───────── simple YouTube embed ───────── */
function YouTubeEmbed({ channelId, title }: { channelId: string; title?: string }) {
  return (
    <iframe
      title={title || "Live"}
      className="w-full h-full"
      src={`https://www.youtube.com/embed/live_stream?channel=${encodeURIComponent(channelId)}&autoplay=1&mute=1`}
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
      allowFullScreen
      referrerPolicy="strict-origin-when-cross-origin"
    />
  );
}

/* ───────── lightweight MP4 player ───────── */
function SmartVideo({
  src,
  poster,
  isStandby,
  onEnded,
}: {
  src: string;
  poster?: string | null;
  isStandby: boolean;
  onEnded: () => void;
}) {
  const vref = useRef<HTMLVideoElement | null>(null);
  const [overlay, setOverlay] = useState<{ show: boolean; text: string }>({
    show: true,
    text: "Starting stream…",
  });

  const CANPLAY_TIMEOUT = 8000;
  const STABLE_MS = 600;
  const MAX_RETRIES = 1;
  const triesRef = useRef(0);
  const canplayTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stableTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimers = () => {
    if (canplayTimer.current) clearTimeout(canplayTimer.current);
    if (stableTimer.current) clearTimeout(stableTimer.current);
  };

  const attach = () => {
    const v = vref.current;
    if (!v) return;

    try {
      v.pause();
      v.removeAttribute("src");
      while (v.firstChild) v.removeChild(v.firstChild);
      v.load();
    } catch {}

    v.crossOrigin = "anonymous";
    v.preload = "auto";
    v.muted = true;
    v.playsInline = true;

    const s = document.createElement("source");
    s.src = src;
    s.type = "video/mp4";
    v.appendChild(s);

    setOverlay({ show: true, text: "Starting stream…" });

    setTimeout(() => {
      try {
        v.currentTime = 0;
        v.load();
      } catch {}
      v.play().catch(() => {});
    }, 0);

    canplayTimer.current = setTimeout(() => {
      if (triesRef.current < MAX_RETRIES) {
        triesRef.current += 1;
        setOverlay({ show: true, text: "Recovering stream…" });
        attach();
      } else {
        setOverlay({
          show: true,
          text: isStandby ? "Video unavailable" : "A video playback error occurred.",
        });
      }
    }, CANPLAY_TIMEOUT);
  };

  useEffect(() => {
    console.log("[Player] src:", src);
    triesRef.current = 0;
    clearTimers();
    attach();
    return () => {
      clearTimers();
      const v = vref.current;
      if (v) {
        try {
          v.pause();
          v.removeAttribute("src");
          v.load();
        } catch {}
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src]);

  return (
    <div className="relative w-full h-full bg-black">
      {overlay.show && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-black">
          {poster ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={poster}
              alt="Poster"
              className="max-h-[60%] max-w-[80%] object-contain"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).style.display = "none";
              }}
            />
          ) : null}
          <div className="mt-4 flex items-center gap-2 text-gray-300">
            {!/unavailable|error/i.test(overlay.text) && <Loader2 className="h-5 w-5 animate-spin" />}
            <span>{overlay.text}</span>
          </div>
          <div className="mt-2 text-[11px] text-gray-500 break-all px-3 text-center">
            <a href={src} target="_blank" rel="noreferrer" className="underline opacity-80 hover:opacity-100">
              Open video URL
            </a>
          </div>
        </div>
      )}

      <video
        ref={vref}
        autoPlay
        muted
        playsInline
        preload="auto"
        controls={false}
        poster={poster || undefined}
        className="w-full h-full"
        onCanPlay={() => {
          if (canplayTimer.current) clearTimeout(canplayTimer.current);
        }}
        onPlaying={() => {
          if (stableTimer.current) clearTimeout(stableTimer.current);
          stableTimer.current = setTimeout(() => setOverlay({ show: false, text: "" }), STABLE_MS);
        }}
        onEnded={onEnded}
        onError={() =>
          setOverlay({
            show: true,
            text: isStandby ? "Video unavailable" : "A video playback error occurred.",
          })
        }
      />
    </div>
  );
}

/* ───────── page ───────── */
export default function WatchPage() {
  const { channelId } = useParams<{ channelId: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();

  const pollOn = (searchParams?.get("poll") ?? "0") === "1";
  const debugOn = (searchParams?.get("debug") ?? "0") === "1";

  const [channel, setChannel] = useState<ChannelRow | null>(null);
  const [validatedId, setValidatedId] = useState<number | null>(null);

  const [current, setCurrent] = useState<ProgramRow | null>(null);
  const [upcoming, setUpcoming] = useState<ProgramRow[]>([]);

  const [resolvedSrc, setResolvedSrc] = useState<string | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [videoKey, setVideoKey] = useState(1);
  const isFetchingRef = useRef(false);

  // fetch channel by id or slug using EXACT columns
  const fetchChannel = useCallback(async (idOrSlug: string) => {
    const cols =
      "id, name, slug, description, logo_url, image_url, youtube_channel_id, youtube_is_live, is_active";
    const n = Number(idOrSlug);
    if (Number.isFinite(n)) {
      const { data, error } = await supabase.from("channels").select(cols).eq("id", n).single();
      if (error) throw new Error(error.message);
      return data as ChannelRow;
    } else {
      const { data, error } = await supabase.from("channels").select(cols).eq("slug", idOrSlug).single();
      if (error) throw new Error(error.message);
      return data as ChannelRow;
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (!channelId) throw new Error("Channel ID is missing in URL.");
        setIsLoading(true);
        setErr(null);

        const ch = await fetchChannel(channelId);
        if (cancelled) return;
        setChannel(ch);

        const n = Number(ch.id);
        if (!Number.isFinite(n)) throw new Error("Channel misconfigured: missing numeric id.");
        setValidatedId(n);

        // Channel 21 = always YouTube (read from DB)
        if (ALWAYS_YT.has(n)) {
          const yt = (ch.youtube_channel_id || "").trim();
          if (!yt) throw new Error("Channel 21 missing youtube_channel_id.");
          setCurrent({
            id: "live-youtube",
            channel_id: n,
            title: ch.name || "Live Broadcast",
            mp4_url: `youtube_channel:${yt}`,
            start_time: new Date(Date.now() - 3600000).toISOString(),
            duration: 86400 * 365,
          } as any);
          setResolvedSrc(undefined);
        }
      } catch (e: any) {
        setErr(e.message || "Failed to load channel.");
      } finally {
        setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [channelId, fetchChannel]);

  const isActiveWindow = (start: Date, dur: number, nowMs: number) => {
    const s = start.getTime();
    const e = s + dur * 1000;
    return nowMs >= s - START_EARLY_GRACE_MS && nowMs < e + END_LATE_GRACE_MS;
  };

  const standbyFor = useCallback(
    (n: number): ProgramRow => ({
      id: "standby",
      channel_id: n,
      title: "Standby Programming",
      mp4_url: `channel${n}:${STANDBY_OBJECT}`, // explicit bucket:path
      start_time: new Date().toISOString(),
      duration: 300,
    }),
    []
  );

  const fetchSchedule = useCallback(
    async (n: number) => {
      if (ALWAYS_YT.has(n)) return;
      if (isFetchingRef.current) return;
      isFetchingRef.current = true;

      const first = !current;
      if (first) setIsLoading(true);
      const nowMs = Date.now();

      try {
        const { data, error } = await supabase
          .from("programs")
          .select("id, channel_id, title, mp4_url, start_time, duration")
          .eq("channel_id", n)
          .order("start_time", { ascending: true });

        if (error) throw new Error(error.message);
        const rows = (data || []) as ProgramRow[];

        // pick active (with grace)
        const active = rows.find((p) => {
          if (!p.start_time || typeof p.duration !== "number" || p.duration <= 0) return false;
          const start = toUtcDate(p.start_time);
          return !!start && isActiveWindow(start, p.duration, nowMs);
        });

        const chosen = active ?? standbyFor(n);

        // STRICT: only bucket:path or https:// allowed
        const resolved = resolveMp4UrlStrict(chosen.mp4_url);
        if (!resolved) {
          const sb = standbyFor(n);
          const r2 = resolveMp4UrlStrict(sb.mp4_url);
          setCurrent(sb);
          setResolvedSrc(r2);
          setErr("Invalid mp4_url. Use 'bucketName:path.mp4' or a full https:// URL.");
        } else {
          setErr(null);
          setCurrent((prev) => {
            if (prev) {
              const sameId = prev.id === chosen.id;
              const sameSrc = baseUrl(prev.mp4_url) === baseUrl(chosen.mp4_url);
              if (sameId && sameSrc) return prev;
              setVideoKey((k) => k + 1);
            }
            return chosen;
          });
          setResolvedSrc((prev) => (prev !== resolved ? resolved : prev));
        }

        // upcoming (future)
        const nowIso = new Date().toISOString();
        const { data: upc } = await supabase
          .from("programs")
          .select("id, channel_id, title, mp4_url, start_time, duration")
          .eq("channel_id", n)
          .gt("start_time", nowIso)
          .order("start_time", { ascending: true })
          .limit(6);
        setUpcoming((upc || []) as ProgramRow[]);
      } catch (e: any) {
        setErr(e.message || "Failed to load schedule.");
        const sb = standbyFor(n);
        const r2 = resolveMp4UrlStrict(sb.mp4_url);
        setCurrent(sb);
        setResolvedSrc(r2);
      } finally {
        if (first) setIsLoading(false);
        isFetchingRef.current = false;
      }
    },
    [current, standbyFor]
  );

  useEffect(() => {
    if (validatedId && !ALWAYS_YT.has(validatedId)) {
      fetchSchedule(validatedId);
      if (pollOn) {
        const id = setInterval(() => {
          if (document.visibilityState === "visible") fetchSchedule(validatedId);
        }, 60_000);
        return () => clearInterval(id);
      }
    }
  }, [validatedId, fetchSchedule, pollOn]);

  /* ───────── render ───────── */
  const isYouTube = (current?.mp4_url || "").startsWith("youtube_channel:");
  const ytId = isYouTube ? (current!.mp4_url as string).split(":")[1] : null;

  let content: ReactNode;
  if (err && !current) {
    content = <p className="text-red-400 p-4 text-center">Error: {err}</p>;
  } else if (isLoading && !current) {
    content = (
      <div className="flex flex-col items-center justify-center h-full">
        <Loader2 className="h-10 w-10 animate-spin text-red-500 mb-2" />
        <p>Loading Channel…</p>
      </div>
    );
  } else if (isYouTube && ytId) {
    content = <YouTubeEmbed channelId={ytId} title={channel?.name || "Live"} />;
  } else if (current && resolvedSrc) {
    content = (
      <SmartVideo
        key={videoKey}
        src={resolvedSrc}
        poster={channel?.logo_url || channel?.image_url || undefined}
        isStandby={current.id === "standby"}
        onEnded={() => {
          if (validatedId) fetchSchedule(validatedId);
        }}
      />
    );
  } else {
    content = <p className="text-gray-400 p-4 text-center">Initializing…</p>;
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
        <h1 className="text-xl font-semibold truncate px-2">{channel?.name || `Channel ${channelId}`}</h1>
        <div className="w-10 h-10" />
      </div>

      <div className="w-full aspect-video bg-black flex items-center justify-center">{content}</div>

      <div className="p-4 flex-grow">
        {current && !isYouTube && (
          <>
            <h2 className="text-2xl font-bold">{current.title}</h2>
            <p className="text-sm text-gray-400">Channel: {channel?.name || `Channel ${channelId}`}</p>
            {current.id !== "standby" && current.start_time && (
              <p className="text-sm text-gray-400">
                Scheduled Start:{" "}
                {(() => {
                  const d = toUtcDate(current.start_time);
                  return d ? d.toLocaleString() : "—";
                })()}
              </p>
            )}

            {upcoming.length > 0 && (
              <div className="mt-6">
                <h3 className="text-lg font-semibold text-white mb-2">Upcoming Programs</h3>
                <ul className="text-sm text-gray-300 space-y-1">
                  {upcoming.map((p) => {
                    const d = toUtcDate(p.start_time);
                    return (
                      <li key={p.id}>
                        <span className="font-medium">{p.title}</span>{" "}
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

            {debugOn && (
              <div className="mt-4 text-xs bg-gray-900/70 border border-gray-700 rounded p-3 space-y-1 break-all">
                <div>
                  <b>Raw mp4_url:</b> {String(current?.mp4_url || "")}
                </div>
                <div className="truncate">
                  <b>Resolved MP4 URL:</b> {resolvedSrc || "—"}
                </div>
                {err ? (
                  <div className="text-red-400">
                    <b>Error:</b> {err}
                  </div>
                ) : null}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
