// app/watch/[channelId]/page.tsx
// PUBLIC buckets only — MP4 + YouTube (ch21), UTC schedule (+grace), stable player,
// resolves from channel buckets (channel1..channel29 or slug like freedom_school),
// no flicker: only remounts when the src actually changes, gentle recovery (no thrash),
// small debug panel (?debug=1) to reveal the resolved URL.

"use client";

import { useEffect, useState, useCallback, useRef, type ReactNode } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import { Loader2, ChevronLeft } from "lucide-react";
import {
  supabase,
  fetchChannelDetails,
  getVideoUrlForProgram,
  STANDBY_PLACEHOLDER_ID,
} from "@/lib/supabase";

/* ---------- Minimal inline types ---------- */
type Program = {
  id: string;
  channel_id: number;
  title?: string | null;
  mp4_url?: string | null;
  start_time?: string | null; // UTC ISO
  duration: number; // seconds
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

/* ---------- Simple inline TopNav ---------- */
function TopNav({ title }: { title?: string }) {
  const router = useRouter();
  return (
    <header className="sticky top-0 z-20 bg-black/70 backdrop-blur border-b border-white/10">
      <div className="mx-auto max-w-7xl px-3 sm:px-4">
        <div className="h-14 sm:h-16 flex items-center justify-between">
          <button
            onClick={() => router.push("/")}
            className="p-2 rounded-full hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-white/20"
            aria-label="Go home"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
          <h1 className="text-sm sm:text-base font-semibold truncate">{title || "Channel"}</h1>
          <div className="w-10 h-10" />
        </div>
      </div>
    </header>
  );
}

/* ---------- Brand/logo from 'brand' (PUBLIC) ---------- */
const BRAND_BUCKET = "brand";
const BRAND_LOGO_OBJECT = process.env.NEXT_PUBLIC_BRAND_LOGO_OBJECT || "blacktruth1.jpeg";
const PUBLIC_LOGO_FALLBACK = "/brand/blacktruth-logo.png";

/* ---------- Channel bucket names ---------- */
function bucketNameFor(details: Channel | null): string | null {
  if (!details) return null;
  const slug = (details as any)?.slug?.toString().trim();
  if (slug) return slug; // e.g. "freedom_school"
  const n = Number((details as any)?.id);
  if (Number.isFinite(n) && n > 0) return `channel${n}`; // e.g. "channel7"
  return null;
}

/* ---------- Scheduling ---------- */
const CH21 = 21;
const YT_CH21 = "UCMkW239dyAxDyOFDP0D6p2g";

const START_EARLY_GRACE_MS = 30_000;
const END_LATE_GRACE_MS = 15_000;
const POLL_MS = 15_000; // not too aggressive

/* ---------- Player constants ---------- */
const OVERLAY_HIDE_DELAY_MS = 600;
const CANPLAY_TIMEOUT_MS = 9000;
const LONG_BUFFER_MS = 6000; // show "Buffering…" if waiting this long
const MAX_RECOVERIES = 1;    // one gentle reload attempt only

/* ---------- Helpers ---------- */
function toUtcDate(val?: string | Date | null): Date | null {
  if (!val) return null;
  if (val instanceof Date) return Number.isNaN(val.getTime()) ? null : val;
  let s = String(val).trim();
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(\.\d+)?$/.test(s)) s = s.replace(" ", "T") + "Z";
  else if (!/[zZ]|[+\-]\d{2}:\d{2}$/.test(s)) s = s + "Z";
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}
const baseUrl = (u?: string | null) => (u ?? "").split("?")[0];

function publicUrl(bucket: string, objectPath: string): string | undefined {
  const clean = objectPath.replace(/^\.?\//, "");
  try {
    const { data } = supabase.storage.from(bucket).getPublicUrl(clean);
    return data?.publicUrl || undefined;
  } catch {
    return undefined;
  }
}

function resolveStandbyPublic(bucket: string) {
  const candidates = [
    "standby_blacktruthtv.mp4",
    "standby.mp4",
    "standby/standby_blacktruthtv.mp4",
    "standby/standby.mp4",
  ];
  for (const p of candidates) {
    const u = publicUrl(bucket, p);
    if (u) return { path: p, url: u };
  }
  return null;
}

/** Resolve to a public URL based on your rules (no signing, no auth) */
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
    const prefix = `${channelBucket.replace(/\/+$/, "")}/`.toLowerCase();
    if (raw.toLowerCase().startsWith(prefix)) raw = raw.slice(prefix.length);
    return publicUrl(channelBucket, raw);
  } catch {
    return undefined;
  }
}

/* ---------- Simple YouTube live (CH21) ---------- */
function YouTubeLive({ channelId, title }: { channelId: string; title?: string }) {
  const src = `https://www.youtube.com/embed/live_stream?channel=${encodeURIComponent(
    channelId
  )}&autoplay=1&mute=1&playsinline=1`;
  return (
    <iframe
      title={title || "YouTube Live"}
      src={src}
      allow="autoplay; encrypted-media; picture-in-picture"
      referrerPolicy="no-referrer-when-downgrade"
      className="w-full h-full"
    />
  );
}

/* ---------- SmartVideo (steady, no thrash) ---------- */
function SmartVideo({
  src,
  logo,
  isStandby,
  onReady,
  onEnded,
  onHardFail,
}: {
  src: string;
  logo?: string;
  isStandby: boolean;
  onReady: () => void;
  onEnded: () => void;
  onHardFail: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [overlay, setOverlay] = useState<{ visible: boolean; text: string }>({
    visible: true,
    text: "Starting stream…",
  });

  const recoveryCount = useRef(0);
  const canplayTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hideOverlayTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longBufferTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimers = () => {
    if (canplayTimeout.current) clearTimeout(canplayTimeout.current);
    if (hideOverlayTimer.current) clearTimeout(hideOverlayTimer.current);
    if (longBufferTimer.current) clearTimeout(longBufferTimer.current);
  };

  const attachAndPlay = () => {
    const v = videoRef.current!;
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
    v.src = src;

    setTimeout(() => {
      try { v.currentTime = 0; v.load(); } catch {}
      v.play().catch(() => {});
    }, 0);

    // fail if we never reach canplay
    canplayTimeout.current = setTimeout(() => {
      handleHardFailure();
    }, CANPLAY_TIMEOUT_MS);
  };

  const handleHardFailure = () => {
    // Only one gentle recovery attempt; then give up to standby
    if (recoveryCount.current < MAX_RECOVERIES) {
      recoveryCount.current += 1;
      setOverlay({ visible: true, text: "Recovering stream…" });
      attachAndPlay();
    } else {
      if (!isStandby) {
        setOverlay({ visible: true, text: "Switching to standby…" });
        onHardFail();
      } else {
        setOverlay({ visible: true, text: "Video unavailable" });
      }
    }
  };

  useEffect(() => {
    recoveryCount.current = 0;
    setOverlay({ visible: true, text: "Starting stream…" });
    clearTimers();
    if (videoRef.current) attachAndPlay();

    return () => {
      clearTimers();
      const v = videoRef.current;
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
    <div className="relative w-full h-full">
      {overlay.visible && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black z-10">
          {logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logo}
              alt="Brand"
              className="max-h-[60%] max-w-[80%] object-contain drop-shadow-[0_8px_28px_rgba(0,0,0,0.45)]"
              onError={(e) => ((e.currentTarget as HTMLImageElement).style.display = "none")}
            />
          ) : null}
          <div className="flex items-center gap-2 mt-4 text-gray-300">
            {!/unavailable/i.test(overlay.text) && <Loader2 className="h-5 w-5 animate-spin" />}
            <span>{overlay.text}</span>
          </div>
        </div>
      )}

      <video
        ref={videoRef}
        key={src}
        autoPlay
        muted
        playsInline
        preload="auto"
        controls={false}
        disablePictureInPicture
        crossOrigin="anonymous"
        className="w-full h-full"
        onCanPlay={() => {
          if (canplayTimeout.current) clearTimeout(canplayTimeout.current);
        }}
        onPlaying={() => {
          if (hideOverlayTimer.current) clearTimeout(hideOverlayTimer.current);
          setOverlay((o) => (o.visible ? { ...o, text: "Starting…" } : o));
          hideOverlayTimer.current = setTimeout(() => {
            setOverlay({ visible: false, text: "" });
          }, OVERLAY_HIDE_DELAY_MS);
        }}
        onWaiting={() => {
          // Only show buffering after a while; do not restart source here.
          if (longBufferTimer.current) clearTimeout(longBufferTimer.current);
          longBufferTimer.current = setTimeout(() => {
            setOverlay({ visible: true, text: "Buffering…" });
          }, LONG_BUFFER_MS);
        }}
        onTimeUpdate={() => {
          // If we see progress, hide any buffering overlay.
          if (longBufferTimer.current) clearTimeout(longBufferTimer.current);
          if (overlay.visible && overlay.text === "Buffering…") {
            setOverlay({ visible: false, text: "" });
          }
        }}
        onStalled={() => {
          // Let it try on its own; hard-fail only if canplay timer triggers or media error below.
        }}
        onError={() => {
          handleHardFailure();
        }}
        onEnded={onEnded}
      />
    </div>
  );
}

/* ---------------------------------- PAGE ---------------------------------- */
export default function WatchPage() {
  const params = useParams();
  const searchParams = useSearchParams();

  const channelIdString = params.channelId as string;
  const debugOn = (searchParams?.get("debug") ?? "0") === "1";

  const [validatedNumericChannelId, setValidatedNumericChannelId] = useState<number | null>(null);
  const [currentProgram, setCurrentProgram] = useState<Program | null>(null);
  const [upcomingPrograms, setUpcomingPrograms] = useState<Program[]>([]);
  const [channelDetails, setChannelDetails] = useState<Channel | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [resolvedSrc, setResolvedSrc] = useState<string | undefined>(undefined);
  const [videoKey, setVideoKey] = useState(0);
  useEffect(() => { setVideoKey(1); }, []);

  // brand logo (PUBLIC)
  const [brandLogo, setBrandLogo] = useState<string>(PUBLIC_LOGO_FALLBACK);
  useEffect(() => {
    try {
      const { data } = supabase.storage.from(BRAND_BUCKET).getPublicUrl(BRAND_LOGO_OBJECT);
      if (data?.publicUrl) setBrandLogo(data.publicUrl);
    } catch {}
  }, []);

  const isFetchingRef = useRef(false);
  const stableTitleRef = useRef<string | undefined>(undefined);
  const channelBucketRef = useRef<string | null>(null);
  const playingSrcRef = useRef<string | null>(null); // to avoid re-mount while same src is playing

  // Init channel
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!channelIdString) {
        setError("Channel ID is missing in URL.");
        setIsLoading(false);
        return;
      }
      setIsLoading(true);
      setError(null);

      const details = await fetchChannelDetails(channelIdString);
      if (!details) {
        if (!cancelled) { setError("Could not load channel details."); setIsLoading(false); }
        return;
      }
      if (cancelled) return;

      setChannelDetails(details);
      channelBucketRef.current = bucketNameFor(details);

      const numericId = Number.parseInt(String((details as any).id), 10);
      if (!Number.isNaN(numericId)) setValidatedNumericChannelId(numericId);

      // CH21 always-live on YouTube
      if (numericId === CH21) {
        const liveProgram: Program = {
          id: "live-ch21-youtube",
          title: "Live Broadcast (Channel 21)",
          channel_id: CH21,
          mp4_url: `youtube_channel:${YT_CH21}`,
          duration: 86400 * 365,
          start_time: new Date(Date.now() - 3600000).toISOString(),
        } as any;
        setCurrentProgram(liveProgram);
        stableTitleRef.current = liveProgram.title || undefined;
        setResolvedSrc(undefined);
        setIsLoading(false);
        return;
      }

      setIsLoading(false);
    })();
    return () => { cancelled = true; };
  }, [channelIdString]);

  const getStandbyProgram = useCallback(
    (channelNum: number, now: Date): Program =>
      ({ id: STANDBY_PLACEHOLDER_ID, title: "Standby Programming", channel_id: channelNum, mp4_url: "standby_blacktruthtv.mp4", duration: 300, start_time: now.toISOString() } as any),
    []
  );

  const isActiveWindow = (start: Date, durationSec: number, nowMillis: number) => {
    const startMs = start.getTime();
    const endMs = startMs + durationSec * 1000;
    return nowMillis >= (startMs - START_EARLY_GRACE_MS) && nowMillis < (endMs + END_LATE_GRACE_MS);
  };

  const fetchCurrentProgram = useCallback(
    async (numericChannelId: number) => {
      if (isFetchingRef.current) return;
      isFetchingRef.current = true;

      const firstLoad = !currentProgram;
      if (firstLoad) setIsLoading(true);

      const now = Date.now();
      try {
        const { data: programsData, error: dbError } = await supabase
          .from("programs")
          .select("id, channel_id, title, mp4_url, start_time, duration")
          .eq("channel_id", numericChannelId)
          .order("start_time", { ascending: true });

        if (dbError) throw new Error(`Database error: ${dbError.message}`);
        const programs = (programsData ?? []) as Program[];

        // active with grace
        let active = programs.find((p) => {
          if (!p.start_time || typeof p.duration !== "number" || p.duration <= 0) return false;
          const start = toUtcDate(p.start_time);
          return !!start && isActiveWindow(start, p.duration, now);
        });

        if (!active) {
          // near-start window to avoid “missed tick”
          active = programs.find((p) => {
            if (!p.start_time || typeof p.duration !== "number" || p.duration <= 0) return false;
            const start = toUtcDate(p.start_time);
            if (!start) return false;
            const delta = start.getTime() - now;
            return delta > -END_LATE_GRACE_MS && delta <= START_EARLY_GRACE_MS;
          });
        }

        const chosen = active ? { ...active, channel_id: numericChannelId } : getStandbyProgram(numericChannelId, new Date(now));
        const bucket = channelBucketRef.current || `channel${numericChannelId}`;

        let finalProgram = chosen;
        let finalSrc = await resolvePlayableUrl(chosen, bucket);

        if (!finalSrc) {
          // fallback to standby in same bucket
          const standby = getStandbyProgram(numericChannelId, new Date(now));
          finalProgram = standby;
          finalSrc =
            (await resolvePlayableUrl(standby, bucket)) ||
            resolveStandbyPublic(bucket)?.url;
        }

        // Only update if program or URL actually changed
        setCurrentProgram((prev) => {
          if (prev) {
            const sameProgram = prev.id === finalProgram.id && baseUrl(prev.mp4_url) === baseUrl(finalProgram.mp4_url);
            if (sameProgram) return prev;
          }
          return finalProgram;
        });

        setResolvedSrc((prev) => {
          if (finalSrc && prev !== finalSrc) {
            playingSrcRef.current = finalSrc;
            setVideoKey((k) => k + 1);
            return finalSrc;
          }
          return prev;
        });

        stableTitleRef.current = finalProgram?.title || undefined;
      } catch (e: any) {
        setError(e.message || "Failed to load program.");
        const standby = getStandbyProgram(numericChannelId, new Date(now));
        const bucket = channelBucketRef.current || `channel${numericChannelId}`;
        const fallback =
          (await resolvePlayableUrl(standby, bucket)) ||
          resolveStandbyPublic(bucket)?.url;
        setCurrentProgram(standby);
        if (fallback && resolvedSrc !== fallback) {
          playingSrcRef.current = fallback;
          setResolvedSrc(fallback);
          setVideoKey((k) => k + 1);
        }
      } finally {
        if (firstLoad) setIsLoading(false);
        isFetchingRef.current = false;
      }
    },
    [currentProgram, getStandbyProgram, resolvedSrc]
  );

  const fetchUpcomingPrograms = useCallback(async (numericChannelId: number) => {
    try {
      const nowIso = new Date().toISOString(); // DB times are UTC
      const { data } = await supabase
        .from("programs")
        .select("id, channel_id, title, mp4_url, start_time, duration")
        .eq("channel_id", numericChannelId)
        .gt("start_time", nowIso)
        .order("start_time", { ascending: true })
        .limit(8);
      if (data) setUpcomingPrograms(data as Program[]);
    } catch {
      setUpcomingPrograms([]);
    }
  }, []);

  // polling that DOES NOT re-mount if src is unchanged
  useEffect(() => {
    if (validatedNumericChannelId === null) return;
    if (validatedNumericChannelId === CH21) return;

    fetchCurrentProgram(validatedNumericChannelId);
    fetchUpcomingPrograms(validatedNumericChannelId);

    const id = setInterval(() => {
      if (document.visibilityState === "visible") {
        fetchCurrentProgram(validatedNumericChannelId);
        fetchUpcomingPrograms(validatedNumericChannelId);
      }
    }, POLL_MS);
    return () => clearInterval(id);
  }, [validatedNumericChannelId, fetchCurrentProgram, fetchUpcomingPrograms]);

  const handleProgramEnded = useCallback(() => {
    if (validatedNumericChannelId !== null && validatedNumericChannelId !== CH21) {
      fetchCurrentProgram(validatedNumericChannelId);
    }
  }, [validatedNumericChannelId, fetchCurrentProgram]);

  const forceStandby = useCallback(async () => {
    if (validatedNumericChannelId == null) return;
    const standby = getStandbyProgram(validatedNumericChannelId, new Date());
    setCurrentProgram(standby);
    const bucket = channelBucketRef.current || `channel${validatedNumericChannelId}`;
    const u =
      (await resolvePlayableUrl(standby, bucket)) ||
      resolveStandbyPublic(bucket)?.url;
    if (u && resolvedSrc !== u) {
      playingSrcRef.current = u;
      setResolvedSrc(u);
      setVideoKey((k) => k + 1);
    }
  }, [validatedNumericChannelId, getStandbyProgram, resolvedSrc]);

  // render
  const frozenTitle = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (currentProgram?.title) frozenTitle.current = currentProgram.title;
  }, [currentProgram?.title]);

  const isYouTubeLive = currentProgram?.id === "live-ch21-youtube";
  const isStandby = currentProgram?.id === STANDBY_PLACEHOLDER_ID;

  let content: ReactNode;
  if (error && !currentProgram) {
    content = <p className="text-red-400 p-4 text-center">Error: {error}</p>;
  } else if (isLoading && !currentProgram) {
    content = (
      <div className="flex flex-col items-center justify-center h-full">
        <Loader2 className="h-10 w-10 animate-spin text-amber-300 mb-2" />
        <p>Loading Channel...</p>
      </div>
    );
  } else if (isYouTubeLive) {
    content = <YouTubeLive channelId={YT_CH21} title={frozenTitle.current || "Channel 21 Live"} />;
  } else if (currentProgram && resolvedSrc) {
    content = (
      <SmartVideo
        key={videoKey}
        src={resolvedSrc}
        logo={brandLogo}
        isStandby={isStandby}
        onReady={() => {}}
        onEnded={handleProgramEnded}
        onHardFail={forceStandby}
      />
    );
  } else {
    content = <div className="flex items-center justify-center h-full text-gray-400">Initializing channel…</div>;
  }

  return (
    <div className="bg-black min-h-screen flex flex-col text-white">
      <TopNav title={(channelDetails as any)?.name || `Channel ${channelIdString}`} />

      <main className="w-full aspect-video bg-black flex items-center justify-center">
        {content}
      </main>

      <section className="p-4 flex-grow">
        {currentProgram && !isYouTubeLive && (
          <>
            <h2 className="text-2xl font-bold">{frozenTitle.current || currentProgram.title || "Program"}</h2>
            <p className="text-sm text-white/60">
              Channel: {(channelDetails as any)?.name || `Channel ${channelIdString}`}
            </p>
            {currentProgram.id !== STANDBY_PLACEHOLDER_ID && currentProgram.start_time && (
              <p className="text-sm text-white/60">
                Scheduled Start: {(() => { const d = toUtcDate(currentProgram.start_time); return d ? d.toLocaleString() : "—"; })()}
              </p>
            )}
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
                          — {d ? d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", timeZoneName: "short" }) : "—"}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
            {(searchParams?.get("debug") ?? "0") === "1" && (
              <div className="mt-4 text-xs bg-gray-900/70 border border-gray-700 rounded p-3">
                <div><b>Bucket:</b> {channelBucketRef.current || "—"}</div>
                <div><b>DB mp4_url:</b> {String((currentProgram as any)?.mp4_url || "")}</div>
                <div className="truncate"><b>Resolved URL:</b> {resolvedSrc || "—"}</div>
                {resolvedSrc ? (
                  <div className="mt-1 flex items-center gap-3">
                    <a href={resolvedSrc} target="_blank" className="underline text-amber-300">Open resolved URL</a>
                    <button
                      className="px-2 py-0.5 rounded bg-gray-800 border border-gray-700"
                      onClick={() => navigator.clipboard.writeText(resolvedSrc!)}
                    >
                      Copy URL
                    </button>
                  </div>
                ) : null}
                {error && <div className="text-red-400 mt-2">{error}</div>}
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}
