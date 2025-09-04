// app/watch/[channelId]/page.tsx
// MP4-only + YouTube (ch21), UTC schedule, server-time sync, channel-bucket resolver,
// signed URLs via /api/storage/sign, anti-thrash standby, optional debug overlay.

"use client";

import { useEffect, useState, useCallback, useRef, type ReactNode } from "react";
import TopNav from "@/components/top-nav";
import { useParams, useSearchParams } from "next/navigation";
import {
  getVideoUrlForProgram,
  fetchChannelDetails,
  supabase,
  STANDBY_PLACEHOLDER_ID,
} from "@/lib/supabase";
import { Loader2 } from "lucide-react";
import YouTubeEmbed from "@/components/youtube-embed";

/* ---------------------------- Inline minimal types ---------------------------- */
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

/* ------------------------------ BRAND / BUCKETS ------------------------------ */

const BRAND_BUCKET = "brand";
const BRAND_LOGO_OBJECT = process.env.NEXT_PUBLIC_BRAND_LOGO_OBJECT || "blacktruth1.jpeg";
const PUBLIC_LOGO_FALLBACK = "/brand/blacktruth-logo.png"; // optional fallback in /public

function bucketNameFor(details: Channel | null): string | null {
  if (!details) return null;
  const slug = (details as any)?.slug?.toString().trim();
  if (slug) return slug; // e.g. "freedom_school"
  const n = Number((details as any)?.id);
  if (Number.isFinite(n) && n > 0) return `channel${n}`; // e.g. "channel7"
  return null;
}

/* --------------------------- SCHEDULING / CONSTANTS --------------------------- */

const CH21_ID_NUMERIC = 21;
const YT_CH21 = "UCMkW239dyAxDyOFDP0D6p2g";
const ALWAYS_LIVE_CHANNEL_IDS = new Set<number>([CH21_ID_NUMERIC]);

const STABLE_PLAY_MS = 700;
const CANPLAY_TIMEOUT_MS = 8000;
const STALL_RECOVERY_MS = 3500;
const PROGRESS_STALL_MS = 4000;
const MAX_ATTEMPTS_PER_SRC = 2;

const START_EARLY_GRACE_MS = 30_000;
const END_LATE_GRACE_MS = 15_000;

/* --------------------------------- Helpers -------------------------------- */

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

/** Try server-signed URL (private buckets) then public URL */
async function storageSignedOrPublic(bucket: string, objectPath: string): Promise<string | undefined> {
  const clean = objectPath.replace(/^\.?\//, "");
  // 1) server signer (works with private buckets)
  try {
    const u = new URL("/api/storage/sign", window.location.origin);
    u.searchParams.set("bucket", bucket);
    u.searchParams.set("object", clean);
    const r = await fetch(u.toString(), { cache: "no-store" });
    if (r.ok) {
      const j = await r.json();
      if (j?.url) return j.url as string;
    }
  } catch {}
  // 2) public fallback
  try {
    const { data } = supabase.storage.from(bucket).getPublicUrl(clean);
    return data?.publicUrl || undefined;
  } catch {
    return undefined;
  }
}

/** Try common standby names if your bucket uses a different filename/path */
async function resolveStandbyForBucket(bucket: string) {
  const candidates = [
    "standby_blacktruthtv.mp4",
    "standby.mp4",
    "standby/standby_blacktruthtv.mp4",
    "standby/standby.mp4",
  ];
  for (const p of candidates) {
    const u = await storageSignedOrPublic(bucket, p.replace(/^\.?\//, ""));
    if (u) return { path: p, url: u };
  }
  return null;
}

/** Resolve playable URL following your rules. Returns ONLY a real URL, never raw DB strings. */
async function resolvePlayableUrl(program: Program, channelBucket: string | null): Promise<string | undefined> {
  try {
    const maybe = getVideoUrlForProgram(program) as unknown;
    let raw =
      (maybe && typeof (maybe as any).then === "function"
        ? await (maybe as Promise<string>)
        : (maybe as string | undefined)) || program?.mp4_url || "";

    if (!raw) return undefined;
    if (raw.startsWith("youtube_channel:")) return undefined;

    // absolute or site-relative
    if (/^https?:\/\//i.test(raw) || raw.startsWith("/")) return raw;

    // explicit bucket override: "bucket:path" or "storage://bucket/path"
    const m =
      /^([a-z0-9_\-]+):(.+)$/i.exec(raw) ||
      /^storage:\/\/([^/]+)\/(.+)$/i.exec(raw);
    if (m) {
      const b = m[1];
      const p = m[2].replace(/^\.?\//, "");
      return storageSignedOrPublic(b, p);
    }

    // path inside THIS channel's bucket
    if (!channelBucket) return undefined;

    raw = raw.replace(/^\.?\//, "");
    // strip duplicated prefix like "channel7/file.mp4" inside bucket "channel7"
    const bucketPrefix = `${channelBucket.replace(/\/+$/, "")}/`;
    if (raw.toLowerCase().startsWith(bucketPrefix.toLowerCase())) raw = raw.slice(bucketPrefix.length);

    return storageSignedOrPublic(channelBucket, raw);
  } catch {
    return undefined;
  }
}

/* ------------------------------ SmartVideo player ------------------------------ */

function SmartVideo({
  src,
  logo,
  isStandby,
  onReady,
  onEnded,
  onHardFail,
}: {
  src: string;
  logo: string;
  isStandby: boolean;
  onReady: () => void;
  onEnded: () => void;
  onHardFail: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [showOverlay, setShowOverlay] = useState(true);
  const [overlayText, setOverlayText] = useState("Starting stream…");

  const attemptsRef = useRef(0);
  const gaveUpRef = useRef(false);
  const canplayTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stablePlayTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stallTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const progressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastProgressT = useRef<number>(0);
  const attachModeRef = useRef<"direct" | "source">("direct");

  const clearTimers = () => {
    if (canplayTimer.current) clearTimeout(canplayTimer.current);
    if (stablePlayTimer.current) clearTimeout(stablePlayTimer.current);
    if (stallTimer.current) clearTimeout(stallTimer.current);
    if (progressTimer.current) clearTimeout(progressTimer.current);
  };
  const detach = (v: HTMLVideoElement) => {
    try { v.pause(); v.removeAttribute("src"); while (v.firstChild) v.removeChild(v.firstChild); v.load(); } catch {}
  };
  const attachAndPlay = (mode: "direct" | "source") => {
    const v = videoRef.current!;
    detach(v);
    v.crossOrigin = "anonymous";
    v.preload = "auto";
    v.muted = true;
    v.playsInline = true;

    if (mode === "direct") v.src = src;
    else { const s = document.createElement("source"); s.src = src; s.type = "video/mp4"; v.appendChild(s); }

    setTimeout(() => {
      try { v.currentTime = 0; v.load(); } catch {}
      v.play().catch(() => {});
    }, 0);

    canplayTimer.current = setTimeout(() => tryRecoverOrFail(), CANPLAY_TIMEOUT_MS);
  };

  useEffect(() => {
    attemptsRef.current = 0;
    gaveUpRef.current = false;
    attachModeRef.current = "direct";
    setShowOverlay(true);
    setOverlayText("Starting stream…");
    lastProgressT.current = 0;
    clearTimers();
    if (videoRef.current) attachAndPlay("direct");
    return () => { clearTimers(); if (videoRef.current) detach(videoRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src]);

  const armProgressWatch = () => {
    if (progressTimer.current) clearTimeout(progressTimer.current);
    progressTimer.current = setTimeout(() => {
      const v = videoRef.current; if (!v) return;
      const t = v.currentTime || 0;
      if (t <= lastProgressT.current + 0.01) tryRecoverOrFail();
    }, PROGRESS_STALL_MS);
  };

  const tryRecoverOrFail = () => {
    if (gaveUpRef.current) return;
    const v = videoRef.current; if (!v) return;

    const mediaErr = v.error?.code ?? null; // 3 decode, 4 src unsupported
    if (mediaErr === 3 || mediaErr === 4) {
      if (isStandby) {
        gaveUpRef.current = true;
        clearTimers();
        setOverlayText("Video unavailable");
        setShowOverlay(true);
        return;
      }
      setOverlayText("Switching to standby…");
      onHardFail();
      return;
    }

    if (attemptsRef.current < MAX_ATTEMPTS_PER_SRC) {
      attemptsRef.current += 1;
      setOverlayText("Recovering stream…");
      clearTimers();
      attachAndPlay(attachModeRef.current === "direct" ? "source" : "direct");
    } else {
      if (isStandby) {
        gaveUpRef.current = true;
        clearTimers();
        setOverlayText("Video unavailable");
        setShowOverlay(true);
      } else {
        setOverlayText("Switching to standby…");
        onHardFail();
      }
    }
  };

  return (
    <div className="relative w-full h-full">
      {showOverlay && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black z-10">
          <img
            src={logo}
            alt="Brand"
            className="max-h-[60%] max-w-[80%] object-contain drop-shadow-[0_8px_28px_rgba(0,0,0,0.45)]"
            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
          />
          <div className="flex items-center gap-2 mt-4 text-gray-300">
            {!/unavailable/i.test(overlayText) && <Loader2 className="h-5 w-5 animate-spin" />}
            <span>{overlayText}</span>
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
        onLoadedMetadata={() => { lastProgressT.current = 0; }}
        onCanPlay={() => { if (canplayTimer.current) clearTimeout(canplayTimer.current); }}
        onPlaying={() => {
          if (stablePlayTimer.current) clearTimeout(stablePlayTimer.current);
          stablePlayTimer.current = setTimeout(() => setShowOverlay(false), STABLE_PLAY_MS);
          armProgressWatch();
        }}
        onTimeUpdate={() => { lastProgressT.current = videoRef.current?.currentTime || 0; armProgressWatch(); }}
        onWaiting={() => {
          if (stallTimer.current) clearTimeout(stallTimer.current);
          stallTimer.current = setTimeout(() => tryRecoverOrFail(), STALL_RECOVERY_MS);
        }}
        onStalled={() => tryRecoverOrFail()}
        onError={() => tryRecoverOrFail()}
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
  const pollOn = (searchParams?.get("poll") ?? "0") === "1";

  const [validatedNumericChannelId, setValidatedNumericChannelId] = useState<number | null>(null);
  const [currentProgram, setCurrentProgram] = useState<Program | null>(null);
  const [upcomingPrograms, setUpcomingPrograms] = useState<Program[]>([]);
  const [channelDetails, setChannelDetails] = useState<Channel | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [resolvedSrc, setResolvedSrc] = useState<string | undefined>(undefined);
  const [videoKey, setVideoKey] = useState(0);
  useEffect(() => { setVideoKey(1); }, []);

  // brand logo (signed first, then public)
  const [brandLogo, setBrandLogo] = useState<string>(PUBLIC_LOGO_FALLBACK);
  useEffect(() => {
    (async () => {
      try {
        const u = new URL("/api/storage/sign", window.location.origin);
        u.searchParams.set("bucket", BRAND_BUCKET);
        u.searchParams.set("object", BRAND_LOGO_OBJECT);
        const r = await fetch(u.toString(), { cache: "no-store" });
        if (r.ok) {
          const j = await r.json();
          if (j?.url) { setBrandLogo(j.url); return; }
        }
      } catch {}
      try {
        const { data } = supabase.storage.from(BRAND_BUCKET).getPublicUrl(BRAND_LOGO_OBJECT);
        if (data?.publicUrl) setBrandLogo(data.publicUrl);
      } catch {}
    })();
  }, []);

  // server-time skew
  const skewMsRef = useRef<number>(0);
  useEffect(() => {
    (async () => {
      try {
        const t0 = Date.now();
        const r = await fetch("/api/now", { cache: "no-store" });
        const j = await r.json();
        const t1 = Date.now();
        const rtt = (t1 - t0) / 2;
        const approxServerNowAtClient = j.epochMs + rtt;
        skewMsRef.current = approxServerNowAtClient - t1;
      } catch {
        skewMsRef.current = 0;
      }
    })();
  }, []);
  const nowMs = () => Date.now() + skewMsRef.current;

  const isFetchingRef = useRef(false);
  const stableTitleRef = useRef<string | undefined>(undefined);
  const channelBucketRef = useRef<string | null>(null);
  const quarantineRef = useRef<{ src: string; until: number } | null>(null);

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

      if (ALWAYS_LIVE_CHANNEL_IDS.has(numericId)) {
        const liveProgram: Program = {
          id: "live-ch21-youtube",
          title: "Live Broadcast (Channel 21)",
          channel_id: CH21_ID_NUMERIC,
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
      if (ALWAYS_LIVE_CHANNEL_IDS.has(numericChannelId)) return;
      if (isFetchingRef.current) return;
      isFetchingRef.current = true;

      const firstLoad = !currentProgram;
      if (firstLoad) setIsLoading(true);

      const now = nowMs();
      try {
        const { data: programsData, error: dbError } = await supabase
          .from("programs")
          .select("id, channel_id, title, mp4_url, start_time, duration")
          .eq("channel_id", numericChannelId)
          .order("start_time", { ascending: true });

        if (dbError) throw new Error(`Database error: ${dbError.message}`);
        const programs = (programsData ?? []) as Program[];

        // choose active program with grace
        let active = programs.find((p) => {
          if (!p.start_time || typeof p.duration !== "number" || p.duration <= 0) return false;
          const start = toUtcDate(p.start_time);
          return !!start && isActiveWindow(start, p.duration, now);
        });
        if (!active) {
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

        // resolve chosen; if not resolvable, resolve standby; never pass raw strings to <video>
        let finalProgram = chosen;
        let finalSrc: string | undefined = await resolvePlayableUrl(chosen, bucket);

        if (!finalSrc) {
          const standby = getStandbyProgram(numericChannelId, new Date(now));
          const standbyResolved = await resolvePlayableUrl(standby, bucket);
          if (standbyResolved) { finalProgram = standby; finalSrc = standbyResolved; }
          else {
            const cand = await resolveStandbyForBucket(bucket);
            if (cand) { finalProgram = standby; finalSrc = cand.url; }
          }
        }

        // quarantine: if the src is known-bad, force standby (1 minute)
        const q = quarantineRef.current;
        const inQ = q && finalSrc && baseUrl(finalSrc) === baseUrl(q.src) && now < q.until;
        if (inQ) {
          const standby = getStandbyProgram(numericChannelId, new Date(now));
          const standbyResolved = await resolvePlayableUrl(standby, bucket);
          if (standbyResolved) { finalProgram = standby; finalSrc = standbyResolved; }
          else {
            const cand = await resolveStandbyForBucket(bucket);
            if (cand) { finalProgram = standby; finalSrc = cand.url; }
          }
        }

        setCurrentProgram((prev) => {
          if (prev) {
            const prevSrc = baseUrl(prev.mp4_url);
            const nextSrc = baseUrl(finalProgram.mp4_url);
            if (prev.id === finalProgram.id && prevSrc === nextSrc) return prev;
          }
          return finalProgram;
        });

        setResolvedSrc((prev) => {
          if (finalSrc && prev !== finalSrc) {
            setVideoKey((k) => k + 1);
            return finalSrc;
          }
          return prev;
        });

        stableTitleRef.current = finalProgram?.title || undefined;
      } catch (e: any) {
        setError(e.message || "Failed to load program.");
        const bucket = channelBucketRef.current || `channel${numericChannelId}`;
        const standby = getStandbyProgram(numericChannelId, new Date(now));
        let standbyUrl = await resolvePlayableUrl(standby, bucket);
        if (!standbyUrl) {
          const cand = await resolveStandbyForBucket(bucket);
          standbyUrl = cand?.url;
        }
        setCurrentProgram(standby);
        if (standbyUrl) setResolvedSrc((prev) => (prev !== standbyUrl ? standbyUrl : prev));
        else setResolvedSrc(undefined);
        stableTitleRef.current = standby.title || undefined;
      } finally {
        if (firstLoad) setIsLoading(false);
        isFetchingRef.current = false;
      }
    },
    [currentProgram, getStandbyProgram]
  );

  const fetchUpcomingPrograms = useCallback(async (numericChannelId: number) => {
    try {
      const nowIso = new Date(nowMs()).toISOString();
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

  // aligned refresh / polling
  const minuteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startMinuteAlignedRefresh = useCallback((numericChannelId: number) => {
    if (minuteTimerRef.current) clearTimeout(minuteTimerRef.current);
    const tick = () => {
      if (document.visibilityState === "visible") {
        fetchCurrentProgram(numericChannelId);
        fetchUpcomingPrograms(numericChannelId);
      }
      const n = nowMs();
      const msToNext = 60_000 - (n % 60_000) + 500;
      minuteTimerRef.current = setTimeout(tick, msToNext);
    };
    const n = nowMs();
    const msToNext = 60_000 - (n % 60_000) + 500;
    minuteTimerRef.current = setTimeout(tick, msToNext);
  }, [fetchCurrentProgram, fetchUpcomingPrograms]);

  useEffect(() => {
    if (validatedNumericChannelId === null) return;
    if (ALWAYS_LIVE_CHANNEL_IDS.has(validatedNumericChannelId)) return;

    fetchCurrentProgram(validatedNumericChannelId);
    fetchUpcomingPrograms(validatedNumericChannelId);

    if (pollOn) {
      const id = setInterval(() => {
        if (document.visibilityState === "visible") {
          fetchCurrentProgram(validatedNumericChannelId);
          fetchUpcomingPrograms(validatedNumericChannelId);
        }
      }, 12000);
      return () => clearInterval(id);
    } else {
      startMinuteAlignedRefresh(validatedNumericChannelId);
      return () => { if (minuteTimerRef.current) clearTimeout(minuteTimerRef.current); };
    }
  }, [validatedNumericChannelId, fetchCurrentProgram, fetchUpcomingPrograms, pollOn, startMinuteAlignedRefresh]);

  const handleProgramEnded = useCallback(() => {
    if (validatedNumericChannelId !== null && !ALWAYS_LIVE_CHANNEL_IDS.has(validatedNumericChannelId)) {
      fetchCurrentProgram(validatedNumericChannelId);
    }
  }, [validatedNumericChannelId, fetchCurrentProgram]);

  const handleHardFail = useCallback(async () => {
    if (validatedNumericChannelId == null) return;
    if (resolvedSrc) quarantineRef.current = { src: resolvedSrc, until: Date.now() + 60_000 };
    const standby = getStandbyProgram(validatedNumericChannelId, new Date(nowMs()));
    const bucket = channelBucketRef.current || `channel${validatedNumericChannelId}`;
    let standbyUrl = await resolvePlayableUrl(standby, bucket);
    if (!standbyUrl) {
      const cand = await resolveStandbyForBucket(bucket);
      standbyUrl = cand?.url;
    }
    setCurrentProgram(standby);
    if (standbyUrl) setResolvedSrc(standbyUrl); else setResolvedSrc(undefined);
  }, [validatedNumericChannelId, resolvedSrc, getStandbyProgram]);

  // Debug overlay
  function DebugBlock({ bucket, program, src }: { bucket: string | null; program: Program | null; src?: string }) {
    if (!program) return null;
    const raw = program?.mp4_url || "";
    return (
      <div className="mt-4 text-xs bg-gray-900/70 border border-gray-700 rounded p-3">
        <div><b>Bucket:</b> {bucket || "—"}</div>
        <div><b>DB mp4_url:</b> {String(raw)}</div>
        <div className="truncate"><b>Resolved URL:</b> {src || "—"}</div>
        {src ? (
          <div className="mt-1 flex items-center gap-3">
            <a href={src} target="_blank" className="underline text-amber-300">Open resolved URL</a>
            <button className="px-2 py-0.5 rounded bg-gray-800 border border-gray-700" onClick={() => navigator.clipboard.writeText(src)}>
              Copy URL
            </button>
          </div>
        ) : null}
      </div>
    );
  }

  // render
  const frozenTitle = stableTitleRef.current;
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
    content = <YouTubeEmbed channelId={YT_CH21} title={frozenTitle || "Channel 21 Live"} muted={true} />;
  } else if (currentProgram && resolvedSrc) {
    content = (
      <SmartVideo
        key={videoKey}
        src={resolvedSrc}
        logo={brandLogo}
        isStandby={isStandby}
        onReady={() => {}}
        onEnded={handleProgramEnded}
        onHardFail={handleHardFail}
      />
    );
  } else {
    content = <div className="flex items-center justify-center h-full text-gray-400">Initializing channel…</div>;
  }

  return (
    <div className="bg-black min-h-screen flex flex-col text-white">
      <TopNav channelName={(channelDetails as any)?.name || `Channel ${channelIdString}`} logoSrc={brandLogo} />
      <main className="w-full aspect-video bg-black flex items-center justify-center">{content}</main>

      <section className="p-4 flex-grow">
        {currentProgram && !isYouTubeLive && (
          <>
            <h2 className="text-2xl font-bold">{frozenTitle}</h2>
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
            {error && <p className="text-xs text-red-400 mt-4">{error}</p>}
            {searchParams?.get("debug") === "1" && (
              <DebugBlock bucket={channelBucketRef.current} program={currentProgram} src={resolvedSrc} />
            )}
          </>
        )}
      </section>
    </div>
  );
}
