// app/watch/[channelId]/page.tsx
"use client";

import { useEffect, useMemo, useRef, useState, useCallback, type ReactNode } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, Loader2 } from "lucide-react";
import { supabase, fetchChannelDetails } from "@/lib/supabase";
import VideoPlayer from "@/components/video-player";
import YouTubeEmbed from "@/components/youtube-embed";

/* ---------- minimal types ---------- */
type ChannelRow = {
  id: number;
  name?: string | null;
  logo_url?: string | null;           // poster only
  youtube_channel_id?: string | null; // for ch21 live
  [k: string]: any;
};

type ProgramRow = {
  id: string | number;
  channel_id: number;
  title: string | null;
  mp4_url: string | null;             // full https OR storage key
  start_time: string;                 // UTC (accepts "YYYY-MM-DD HH:mm:ss")
  duration: number;                   // seconds
};

/* ---------- constants ---------- */
const CH21 = 21;
const YT_FALLBACK = "UCMkW239dyAxDyOFDP0D6p2g";
const STANDBY_FILE = "standby_blacktruthtv.mp4";

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

const bucketFor = (id: number) => `channel${id}`;
const cleanKey = (k: string) => k.trim().replace(/^\.?\//, "").replace(/\\/g, "/").replace(/\/{2,}/g, "/");

function publicUrl(bucket: string, key: string): string | undefined {
  try {
    const { data } = supabase.storage.from(bucket).getPublicUrl(cleanKey(key));
    return data?.publicUrl || undefined;
  } catch { return undefined; }
}

function standbyUrl(channelId: number): string | undefined {
  const base = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/+$/, "");
  if (!base) return undefined;
  return `${base}/storage/v1/object/public/${bucketFor(channelId)}/${STANDBY_FILE}`;
}

/** EXACT resolution you want:
 * - If mp4_url is full https:// or starts with '/', use as-is.
 * - Else treat it as a key in channel{ID}.
 * - If it starts with 'channel{ID}/', also try stripped version.
 */
function resolveMp4Src(p: ProgramRow, channelId: number): { src?: string; tried: string[] } {
  const tried: string[] = [];
  const raw = (p?.mp4_url || "").trim();
  if (!raw) return { tried };

  if (/^https?:\/\//i.test(raw) || raw.startsWith("/")) {
    tried.push(raw);
    return { src: raw, tried };
  }

  const bucket = bucketFor(channelId);
  const key = cleanKey(raw);

  const u1 = publicUrl(bucket, key);
  tried.push(`${bucket}:${key}`);
  if (u1) return { src: u1, tried };

  const rx = new RegExp(`^channel${channelId}/`, "i");
  if (rx.test(key)) {
    const stripped = key.replace(rx, "");
    const u2 = publicUrl(bucket, stripped);
    tried.push(`${bucket}:${stripped}`);
    if (u2) return { src: u2, tried };
  }

  return { tried };
}

/* ---------- page ---------- */
export default function WatchPage() {
  const { channelId } = useParams<{ channelId: string }>();
  const router = useRouter();
  const search = useSearchParams();
  const debug = (search?.get("debug") ?? "0") === "1";

  const idNum = useMemo(() => Number(channelId), [channelId]);

  const [channel, setChannel] = useState<ChannelRow | null>(null);
  const [active, setActive] = useState<ProgramRow | null>(null);
  const [nextUp, setNextUp] = useState<ProgramRow | null>(null);

  const [src, setSrc] = useState<string | undefined>(undefined);
  const [usingStandby, setUsingStandby] = useState(false);
  const [tried, setTried] = useState<string[]>([]);

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const poster = channel?.logo_url || undefined;
  const playerKey = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // load channel once
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true); setErr(null);
      const ch = await fetchChannelDetails(channelId!); // uses select("*") inside your lib
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

    // Channel 21 → YouTube Live (no HLS)
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

      // fetch all programs for the channel (simple + deterministic)
      const { data, error } = await supabase
        .from("programs")
        .select("id, channel_id, title, mp4_url, start_time, duration")
        .eq("channel_id", channel.id)
        .order("start_time", { ascending: true });
      if (error) throw new Error(error.message);

      const list = (data || []) as ProgramRow[];

      // strictly active window
      let current: ProgramRow | null = null;
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
        const r = resolveMp4Src(current, channel.id);
        setActive(current);
        setTried(r.tried);

        if (r.src) {
          setSrc(r.src);
          setUsingStandby(false);
        } else {
          setSrc(standbyUrl(channel.id));
          setUsingStandby(true);
        }
        playerKey.current += 1;

        const endAt = addSeconds(toUtcDate(current.start_time)!, current.duration);
        const nextStart = nxt ? toUtcDate(nxt.start_time)! : null;
        schedule(nextStart && nextStart < endAt ? nextStart : endAt);
      } else {
        // none active → standby until next
        setActive(null);
        setSrc(standbyUrl(channel.id));
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

    // refresh every minute if tab visible
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
    content = <YouTubeEmbed channelId={ytId} title={active?.title || "Live"} muted />;
  } else if (src) {
    content = (
      <VideoPlayer
        key={playerKey.current}
        src={src}
        poster={poster}
        programTitle={active ? active.title || undefined : "Standby (waiting for next program)"}
        isStandby={usingStandby}
        onVideoEnded={() => void pickAndPlay()}
        autoPlay={false}      // controls visible
        muted={false}
        playsInline
        preload="metadata"
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

        {(search?.get("debug") ?? "0") === "1" && (
          <div className="mt-2 text-xs bg-gray-900/70 border border-gray-700 rounded p-3 space-y-1">
            <div><b>Bucket:</b> {bucketFor(idNum)}</div>
            <div className="truncate"><b>Playing Src:</b> {src || "—"}</div>
            {tried.length > 0 && <div className="truncate"><b>Tried:</b> {tried.join("  |  ")}</div>}
            <div><b>Using Standby:</b> {usingStandby ? "yes" : "no"}</div>
            <div><b>Poster (logo_url):</b> {poster || "—"}</div>
          </div>
        )}
      </div>
    </div>
  );
}
