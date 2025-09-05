// app/watch/[channelId]/page.tsx
"use client";

import { useEffect, useMemo, useRef, useState, useCallback, type ReactNode } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, Loader2 } from "lucide-react";
import { supabase, fetchChannelDetails } from "@/lib/supabase";
import VideoPlayer from "@/components/video-player";
import YouTubeEmbed from "@/components/youtube-embed";

/* ---------- minimal types ---------- */
type Channel = {
  id: number;
  name?: string | null;
  slug?: string | null;              // used for freedom_school special case
  logo_url?: string | null;          // poster only
  youtube_channel_id?: string | null;// for ch21 live
  [k: string]: any;
};

type Program = {
  id: string | number;
  channel_id: number;
  title: string | null;
  mp4_url: string | null;            // full https OR storage key OR bucket:key
  start_time: string;                // UTC (accepts "YYYY-MM-DD HH:mm:ss")
  duration: number;                  // seconds
};

/* ---------- constants ---------- */
const CH21 = 21;
const YT_FALLBACK = "UCMkW239dyAxDyOFDP0D6p2g";
const STANDBY_FILE = "standby_blacktruthtv.mp4";

/* Build public root ONCE — no getPublicUrl calls */
const PUB_ROOT =
  (process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/+$/, "") +
  "/storage/v1/object/public";

/* ---------- helpers ---------- */
function toUtcDate(val?: string | Date | null): Date | null {
  if (!val) return null;
  if (val instanceof Date) return Number.isNaN(val.getTime()) ? null : val;
  let s = String(val).trim();
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(\.\d+)?$/.test(s)) s = s.replace(" ", "T") + "Z";
  else if (!/[zZ]|[+\-]\d{2}:\d{2}$/.test(s)) s = s + "Z";
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}
const addSeconds = (d: Date, s: number) => new Date(d.getTime() + s * 1000);

const cleanKey = (k: string) =>
  k.trim().replace(/^\.?\//, "").replace(/\\/g, "/").replace(/\/{2,}/g, "/");

function bucketFor(ch: Channel): string {
  const slug = (ch.slug || "").toLowerCase().trim();
  if (slug === "freedom-school" || slug === "freedom_school") return "freedom_school";
  return `channel${Number(ch.id)}`; // channel1, channel2, ...
}

function standbyUrl(ch: Channel): string {
  return `${PUB_ROOT}/${bucketFor(ch)}/${STANDBY_FILE}`;
}

/** URL resolver (PUBLIC buckets):
 * - If mp4_url is full https:// or starts with '/', use as-is.
 * - If "bucket:key" or "storage://bucket/key", build public URL for that bucket.
 * - Else treat as a key in this channel’s bucket (strip accidental 'channel{id}/' or 'freedom_school/' prefixes).
 * - We DO NOT call supabase.storage.getPublicUrl.
 */
function resolveMp4Src(p: Program, ch: Channel): { src?: string; tried: string[] } {
  const tried: string[] = [];
  let raw = (p?.mp4_url || "").trim();
  if (!raw) return { tried };

  // absolute URL or absolute path
  if (/^https?:\/\//i.test(raw) || raw.startsWith("/")) {
    tried.push(raw);
    return { src: raw, tried };
  }

  // bucket override: "bucket:key" OR "storage://bucket/key"
  const m =
    /^([a-z0-9_\-]+):(.+)$/i.exec(raw) ||
    /^storage:\/\/([^/]+)\/(.+)$/i.exec(raw);
  if (m) {
    const b = m[1];
    const key = cleanKey(m[2]);
    const url = `${PUB_ROOT}/${b}/${key}`;
    tried.push(url);
    return { src: url, tried };
  }

  // relative → resolve against this channel’s bucket
  const bucket = bucketFor(ch);
  raw = cleanKey(raw);

  // strip accidental "channel{id}/" or "freedom_school/" prefixes
  const prefixes = [bucket.toLowerCase() + "/", "freedom_school/"];
  for (const pre of prefixes) {
    if (raw.toLowerCase().startsWith(pre)) {
      raw = raw.slice(pre.length);
      break;
    }
  }

  const url = `${PUB_ROOT}/${bucket}/${raw}`;
  tried.push(url);
  return { src: url, tried };
}

/* ---------- page ---------- */
export default function WatchPage() {
  const { channelId } = useParams<{ channelId: string }>();
  const router = useRouter();
  const search = useSearchParams();
  const debug = (search?.get("debug") ?? "0") === "1";

  const idNum = useMemo(() => Number(channelId), [channelId]);

  const [channel, setChannel] = useState<Channel | null>(null);
  const [active, setActive] = useState<Program | null>(null);
  const [nextUp, setNextUp] = useState<Program | null>(null);

  const [src, setSrc] = useState<string | undefined>(undefined);
  const [usingStandby, setUsingStandby] = useState(false);
  const [tried, setTried] = useState<string[]>([]);

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const poster = channel?.logo_url || undefined;
  const playerKey = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // load channel
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true); setErr(null);
      const ch = await fetchChannelDetails(channelId!); // lib fetch uses select("*")
      if (cancelled) return;
      if (!ch) { setErr("Channel not found."); setLoading(false); return; }
      setChannel({ id: Number((ch as any).id), ...ch });
      setLoading(false);
    })();
    return () => { cancelled = true; if (timer.current) clearTimeout(timer.current); };
  }, [channelId]);

  const schedule = (when: Date | null) => {
    if (timer.current) clearTimeout(timer.current);
    if (!when) return;
    const delay = Math.max(0, when.getTime() - Date.now() + 1000);
    timer.current = setTimeout(() => void pickAndPlay(), delay);
  };

  const pickAndPlay = useCallback(async () => {
    if (!channel) return;

    // CH21 → YouTube Live (embed)
    if (channel.id === CH21) {
      const yt = channel.youtube_channel_id || process.env.NEXT_PUBLIC_YT_CH21 || YT_FALLBACK;
      setActive({
        id: "youtube-live",
        channel_id: CH21,
        title: channel.name ? `${channel.name} Live` : "Live",
        mp4_url: `youtube_channel:${yt}`,
        start_time: new Date(Date.now() - 3600000).toISOString(),
        duration: 31536000,
      } as any);
      setNextUp(null);
      setSrc(undefined);
      setUsingStandby(false);
      setTried([]);
      schedule(null);
      return;
    }

    setLoading(true); setErr(null);
    try {
      const now = new Date();

      const { data, error } = await supabase
        .from("programs")
        .select("id, channel_id, title, mp4_url, start_time, duration")
        .eq("channel_id", channel.id)
        .order("start_time", { ascending: true });
      if (error) throw new Error(error.message);

      const list = (data || []) as Program[];

      // find strict active
      let current: Program | null = null;
      for (const p of list) {
        const d = Number((p as any).duration);
        if (!p.start_time || !Number.isFinite(d) || d <= 0) continue;
        const st = toUtcDate(p.start_time); if (!st) continue;
        const en = addSeconds(st, d);
        if (now >= st && now < en) { current = { ...p, duration: d }; break; }
      }

      // next strictly after now
      const nxt = list.find(p => {
        const st = toUtcDate(p.start_time);
        return !!st && st > now;
      }) || null;
      setNextUp(nxt);

      if (current) {
        const r = resolveMp4Src(current, channel);
        setActive(current);
        setTried(r.tried);

        if (r.src) {
          setSrc(r.src);
          setUsingStandby(false);
        } else {
          setSrc(standbyUrl(channel));
          setUsingStandby(true);
        }
        playerKey.current += 1;

        const endAt = addSeconds(toUtcDate(current.start_time)!, current.duration);
        const nextStart = nxt ? toUtcDate(nxt.start_time)! : null;
        schedule(nextStart && nextStart < endAt ? nextStart : endAt);
      } else {
        // none active → standby until next
        setActive(null);
        setSrc(standbyUrl(channel));
        setUsingStandby(true);
        schedule(nxt ? toUtcDate(nxt.start_time)! : null);
      }
    } catch (e: any) {
      setErr(e.message || "Failed to load schedule.");
    } finally {
      setLoading(false);
    }
  }, [channel]);

  useEffect(() => {
    if (!channel || !idNum) return;
    void pickAndPlay();

    // refresh every minute if visible
    const iv = setInterval(() => {
      if (document.visibilityState === "visible") void pickAndPlay();
    }, 60_000);
    return () => clearInterval(iv);
  }, [idNum, channel, pickAndPlay]);

  const isYT = !!active?.mp4_url?.toString().startsWith("youtube_channel:");
  const ytId = isYT ? String(active!.mp4_url).split(":")[1] : null;

  /* ---------- render ---------- */
  let content: ReactNode;
  if (err) {
    content = <p className="text-red-400 p-4 text-center">Error: {err}</p>;
  } else if (loading && !active && !src && !isYT) {
    content = (
      <div className="flex flex-col items-center justify-center h-full">
        <Loader2 className="h-10 w-10 animate-spin text-red-500 mb-2" />
        <p>Loading…</p>
      </div>
    );
  } else if (isYT && ytId) {
    // 🔊 restore sound: do NOT force muted on YouTube
    content = <YouTubeEmbed channelId={ytId} title={active?.title || "Live"} />;
  } else if (src) {
    // 🔊 restore sound: do NOT force muted on HTML5 video
    content = (
      <VideoPlayer
        key={playerKey.current}
        src={src}              // ← MP4 URL ONLY
        poster={poster}        // ← Poster ONLY (never used as src)
        programTitle={active ? active.title || undefined : "Standby (waiting for next program)"}
        isStandby={usingStandby}
        onVideoEnded={() => void pickAndPlay()}
        autoPlay={false}       // allow user to click Play so audio isn't blocked
        muted={false}          // 🔊 sound on
        playsInline
        preload="auto"
      />
    );
  } else {
    content = <p className="text-gray-400 p-4 text-center">Initializing channel…</p>;
  }

  return (
    <div className="bg-black min-h-screen flex flex-col text-white">
      {/* header */}
      <div className="p-4 flex items-center justify-between bg-gray-900/50 sticky top-0 z-10">
        <button onClick={() => router.back()} className="p-2 rounded-full hover:bg-gray-700" aria-label="Go back">
          <ChevronLeft className="h-6 w-6" />
        </button>
        <h1 className="text-xl font-semibold truncate px-2">
          {channel?.name || `Channel ${channelId}`}
        </h1>
        <div className="w-10 h-10" />
      </div>

      {/* player */}
      <div className="w-full aspect-video bg-black flex items-center justify-center">
        {content}
      </div>

      {/* details + Next + optional debug */}
      <div className="p-4 space-y-4">
        {active && channel?.id !== CH21 && (
          <>
            <h2 className="text-2xl font-bold">{active.title || "Now Playing"}</h2>
            <p className="text-sm text-gray-400">
              Start: {(() => { const d = toUtcDate(active.start_time); return d ? d.toLocaleString() : "—"; })()}
              {" • "}Duration: {active.duration}s
              {usingStandby && <span className="text-yellow-400"> • Fallback: Standby</span>}
            </p>
          </>
        )}

        {nextUp && (
          <div className="text-sm text-gray-300">
            <span className="font-medium">Next:</span>{" "}
            {nextUp.title || "Upcoming program"}{" "}
            <span className="text-gray-400">
              — {(() => { const d = toUtcDate(nextUp.start_time); return d ? d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", timeZoneName: "short" }) : "—"; })()}
            </span>
          </div>
        )}

        {debug && (
          <div className="mt-2 text-xs bg-gray-900/70 border border-gray-700 rounded p-3 space-y-1">
            <div><b>Bucket:</b> {channel ? bucketFor(channel) : "—"}</div>
            <div className="truncate"><b>Playing Src:</b> {src || "—"}</div>
            <div><b>Using Standby:</b> {usingStandby ? "yes" : "no"}</div>
            <div><b>Poster (logo_url):</b> {poster || "—"}</div>
            <div><b>Tried:</b> {tried.join("  |  ") || "—"}</div>
          </div>
        )}
      </div>
    </div>
  );
}
