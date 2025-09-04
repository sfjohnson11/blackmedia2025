// app/watch/[channelId]/page.tsx
// Schedule rules:
//  - Play ACTIVE program when start_time <= now < start_time + duration (UTC)
//  - If NO program is active, play STANDBY until the next program starts
//  - If an ACTIVE program fails to resolve/play, fallback to STANDBY
//  - CH 21 = YouTube Live via channels.youtube_channel_id
// Schema used:
//   channels: id, name, slug, description, logo_url, youtube_channel_id, youtube_is_live, is_active
//   programs: id, channel_id, title, mp4_url, start_time (UTC), duration (seconds)

"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, Loader2 } from "lucide-react";
import YouTubeEmbed from "@/components/youtube-embed";
import VideoPlayer from "@/components/video-player";
import { supabase, fetchChannelDetails, getVideoUrlForProgram } from "@/lib/supabase";

type Channel = {
  id: number;
  name: string | null;
  slug: string | null;
  description: string | null;
  logo_url: string | null;
  youtube_channel_id: string | null;
  youtube_is_live: boolean | null;
  is_active: boolean | null;
};

type Program = {
  id: string | number;
  channel_id: number;
  title: string | null;
  mp4_url: string | null;
  start_time: string; // ISO UTC
  duration: number;   // seconds
};

const CH21_ID = 21;
const YT_FALLBACK_CH21 = "UCMkW239dyAxDyOFDP0D6p2g";
const STANDBY_OBJECT = "standby_blacktruthtv.mp4"; // your standby filename inside channel bucket

/* ----------------- helpers ----------------- */

const baseNoQuery = (u?: string) => (u || "").split("?")[0];
const cleanPath = (p: string) => p.replace(/^\.?\//, "");
const isVideoUrl = (u?: string) => !!u && /\.(mp4|m3u8)$/i.test(baseNoQuery(u));

function toDate(val: string | Date) { return val instanceof Date ? val : new Date(val); }
function addSeconds(d: Date, secs: number) { return new Date(d.getTime() + secs * 1000); }

function bucketForChannel(ch: Channel | null): string | null {
  if (!ch) return null;
  if (ch.slug && ch.slug.trim()) return ch.slug.trim();
  if (Number.isFinite(ch.id) && ch.id > 0) return `channel${ch.id}`;
  return null;
}

function publicUrl(bucket: string, objectPath: string): string | undefined {
  try {
    const { data } = supabase.storage.from(bucket).getPublicUrl(cleanPath(objectPath));
    return data?.publicUrl || undefined;
  } catch { return undefined; }
}

async function resolvePlayableUrl(program: Program, channelBucket: string | null) {
  let raw = (getVideoUrlForProgram(program) || "").trim();
  if (!raw) return undefined;

  if (/^https?:\/\//i.test(raw) || raw.startsWith("/")) return raw;

  const m =
    /^([a-z0-9_\-]+):(.+)$/i.exec(raw) ||
    /^storage:\/\/([^/]+)\/(.+)$/i.exec(raw);
  if (m) {
    const b = m[1];
    const p = m[2];
    return publicUrl(b, p);
  }

  if (!channelBucket) return undefined;
  raw = cleanPath(raw);
  const prefix = `${channelBucket.replace(/\/+$/, "")}/`.toLowerCase();
  if (raw.toLowerCase().startsWith(prefix)) raw = raw.slice(prefix.length);
  return publicUrl(channelBucket, raw);
}

function resolveStandbyUrl(channelBucket: string | null) {
  if (!channelBucket) return undefined;
  return publicUrl(channelBucket, STANDBY_OBJECT);
}

/* ----------------- page ----------------- */

export default function WatchPage() {
  const { channelId } = useParams<{ channelId: string }>();
  const router = useRouter();
  const search = useSearchParams();

  const channelIdNum = useMemo(() => Number(channelId), [channelId]);
  const debugOn = (search?.get("debug") ?? "0") === "1";

  const [channel, setChannel] = useState<Channel | null>(null);
  const [activeProgram, setActiveProgram] = useState<Program | null>(null);
  const [nextProgram, setNextProgram] = useState<Program | null>(null);
  const [playingSrc, setPlayingSrc] = useState<string | undefined>(undefined);
  const [usingStandby, setUsingStandby] = useState(false);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const poster = channel?.logo_url || undefined;
  const bucketRef = useRef<string | null>(null);
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const playerKeyRef = useRef(0);

  // Load channel
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setErr(null);

      const ch = await fetchChannelDetails(channelId!);
      if (cancelled) return;

      if (!ch) {
        setErr("Channel not found.");
        setLoading(false);
        return;
      }
      setChannel(ch as any);
      bucketRef.current = bucketForChannel(ch as any);
      setLoading(false);
    })();

    return () => {
      cancelled = true;
      if (refreshTimer.current) {
        clearTimeout(refreshTimer.current);
        refreshTimer.current = null;
      }
    };
  }, [channelId]);

  const scheduleRefreshAt = (when: Date | null) => {
    if (refreshTimer.current) {
      clearTimeout(refreshTimer.current);
      refreshTimer.current = null;
    }
    if (!when) return;
    const delay = Math.max(0, when.getTime() - Date.now() + 1000); // +1s safety
    refreshTimer.current = setTimeout(() => {
      void pickAndResolve();
    }, delay);
  };

  // Pick active, next; play active or standby; schedule next refresh boundary
  const pickAndResolve = useCallback(async () => {
    if (!channel) return;

    // CH 21 = YouTube Live
    if (channel.id === CH21_ID) {
      setActiveProgram({
        id: "youtube-live",
        channel_id: CH21_ID,
        title: channel.name ? `${channel.name} Live` : "Live",
        mp4_url: `youtube_channel:${channel.youtube_channel_id || YT_FALLBACK_CH21}`,
        start_time: new Date(Date.now() - 3600000).toISOString(),
        duration: 31536000,
      } as any);
      setNextProgram(null);
      setPlayingSrc(undefined);
      setUsingStandby(false);
      scheduleRefreshAt(null);
      return;
    }

    setLoading(true);
    setErr(null);

    try {
      const now = new Date();
      const nowISO = now.toISOString();

      // get most recent few started programs
      const { data: started } = await supabase
        .from("programs")
        .select("id, channel_id, title, mp4_url, start_time, duration")
        .eq("channel_id", channel.id)
        .lte("start_time", nowISO)
        .order("start_time", { ascending: false })
        .limit(5);

      // find active window
      let active: Program | null = null;
      if (started && started.length) {
        for (const p of started as Program[]) {
          if (!p.start_time || typeof p.duration !== "number" || p.duration <= 0) continue;
          const st = toDate(p.start_time);
          const en = addSeconds(st, p.duration);
          if (now >= st && now < en) { active = p; break; }
        }
      }

      // next up strictly after now
      const { data: up } = await supabase
        .from("programs")
        .select("id, channel_id, title, mp4_url, start_time, duration")
        .eq("channel_id", channel.id)
        .gt("start_time", nowISO)
        .order("start_time", { ascending: true })
        .limit(1);

      const next = (up && up[0] as Program) || null;
      setNextProgram(next);

      const bucket = bucketRef.current;

      if (active) {
        // Active exists → resolve or fallback to standby
        const resolved = await resolvePlayableUrl(active, bucket);
        if (isVideoUrl(resolved)) {
          setActiveProgram(active);
          setPlayingSrc(resolved);
          setUsingStandby(false);
          playerKeyRef.current += 1;
        } else {
          const standby = resolveStandbyUrl(bucket);
          setActiveProgram(active);
          setPlayingSrc(isVideoUrl(standby) ? standby : undefined);
          setUsingStandby(true);
          playerKeyRef.current += 1;
        }

        // refresh at earliest boundary (end of active or next start, whichever is sooner)
        const endAt = addSeconds(toDate(active.start_time), active.duration);
        const nextStart = next ? toDate(next.start_time) : null;
        const boundary = nextStart && nextStart < endAt ? nextStart : endAt;
        scheduleRefreshAt(boundary);
        setLoading(false);
        return;
      }

      // No active → play standby until next start
      const standby = resolveStandbyUrl(bucket);
      setActiveProgram(null);
      setPlayingSrc(isVideoUrl(standby) ? standby : undefined);
      setUsingStandby(true);
      playerKeyRef.current += 1;

      // refresh exactly at next start (if any)
      scheduleRefreshAt(next ? toDate(next.start_time) : null);
      setLoading(false);
    } catch (e: any) {
      setErr(e.message || "Error loading schedule.");
      setLoading(false);
    }
  }, [channel]);

  // run and then re-run at boundaries
  useEffect(() => {
    if (!channel || !channelIdNum) return;
    void pickAndResolve();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channelIdNum, channel]);

  /* ----------------- render ----------------- */

  const isYouTube = !!activeProgram?.mp4_url?.toString().startsWith("youtube_channel:");
  const ytId = isYouTube ? String(activeProgram!.mp4_url).split(":")[1] : null;

  return (
    <div className="bg-black min-h-screen flex flex-col text-white">
      {/* Header */}
      <div className="p-4 flex items-center justify-between bg-gray-900/50 sticky top-0 z-10">
        <button onClick={() => router.back()} className="p-2 rounded-full hover:bg-gray-700" aria-label="Go back">
          <ChevronLeft className="h-6 w-6" />
        </button>
        <h1 className="text-xl font-semibold truncate px-2">
          {channel?.name || `Channel ${channelId}`}
        </h1>
        <div className="w-10 h-10" />
      </div>

      {/* Player */}
      <div className="w-full aspect-video bg-black flex items-center justify-center">
        {err ? (
          <div className="text-red-400 p-4">Error: {err}</div>
        ) : loading && !channel ? (
          <div className="flex flex-col items-center justify-center h-full">
            <Loader2 className="h-10 w-10 animate-spin text-red-500 mb-2" />
            <p>Loading…</p>
          </div>
        ) : isYouTube && ytId ? (
          <YouTubeEmbed channelId={ytId} title={activeProgram?.title || "Live"} muted={true} />
        ) : playingSrc ? (
          <VideoPlayer
            key={playerKeyRef.current}
            src={playingSrc}
            poster={poster}
            programTitle={
              activeProgram
                ? (usingStandby ? `${activeProgram.title || "Program"} (Standby playback)` : activeProgram.title || undefined)
                : (usingStandby ? "Standby (Waiting for next program)" : undefined)
            }
            onVideoEnded={() => { void pickAndResolve(); }}
            onError={() => {
              // If video errors at runtime, switch to standby (if not already)
              if (!usingStandby) {
                const fallback = resolveStandbyUrl(bucketRef.current);
                if (isVideoUrl(fallback)) {
                  setPlayingSrc(fallback);
                  setUsingStandby(true);
                  playerKeyRef.current += 1;
                }
              }
            }}
            autoPlay={false}
            muted={false}
            playsInline
            preload="metadata"
          />
        ) : (
          <div className="text-gray-300 text-sm p-4">
            {channelIdNum === CH21_ID
              ? "Loading YouTube…"
              : "Standby not available publicly. Waiting for next program…"}
          </div>
        )}
      </div>

      {/* Details / Next up / Debug */}
      <div className="p-4 space-y-4">
        {activeProgram && channelIdNum !== CH21_ID && (
          <>
            <h2 className="text-2xl font-bold">{activeProgram.title || "Now Playing"}</h2>
            <p className="text-sm text-gray-400">
              Start: {new Date(activeProgram.start_time).toLocaleString()} • Duration: {activeProgram.duration}s
              {usingStandby && <span className="text-yellow-400"> • Fallback: Standby asset</span>}
            </p>
          </>
        )}

        <div>
          <h3 className="text-lg font-semibold text-white mb-2">Next Up</h3>
          {nextProgram ? (
            <div className="text-sm text-gray-300">
              <span className="font-medium">{nextProgram.title || "Untitled"}</span>{" "}
              <span className="text-gray-400">
                — {new Date(nextProgram.start_time).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", timeZoneName: "short" })}
              </span>
            </div>
          ) : (
            <div className="text-sm text-gray-400">Nothing scheduled after this.</div>
          )}
        </div>

        {debugOn && (
          <div className="mt-2 text-xs bg-gray-900/70 border border-gray-700 rounded p-3 space-y-1">
            <div><b>Bucket:</b> {bucketRef.current || "—"}</div>
            <div><b>Active Program:</b> {activeProgram ? `${String(activeProgram.id)} • ${activeProgram.title || "—"}` : "— (none)"}</div>
            <div className="truncate"><b>Playing Src:</b> {playingSrc || "—"}</div>
            <div><b>Using Standby:</b> {usingStandby ? "yes" : "no"}</div>
            <div><b>Poster (logo_url):</b> {poster || "—"}</div>
          </div>
        )}
      </div>
    </div>
  );
}
