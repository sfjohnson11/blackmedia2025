// app/watch/[channelId]/page.tsx
// Schedule:
// - If a program is ACTIVE (start_time <= now < start_time + duration), play it.
// - If none is active, play STANDBY until the next program starts.
// - If an ACTIVE program's URL can't resolve or playback errors, fall back to STANDBY.
// - Channel 21 = YouTube Live via channels.youtube_channel_id.
//
// Tables:
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
  start_time: string; // ISO-ish UTC (can be "YYYY-MM-DD HH:mm:ss")
  duration: number;   // seconds
};

const CH21_ID = 21;
const YT_FALLBACK_CH21 = "UCMkW239dyAxDyOFDP0D6p2g";
const STANDBY_OBJECT = "standby_blacktruthtv.mp4";

/* ───────── helpers ───────── */

const baseNoQuery = (u?: string) => (u || "").split("?")[0];
const cleanPath = (p: string) => p.replace(/^\.?\//, "");
const isYouTubeMarker = (val?: string | null) => !!val && String(val).startsWith("youtube_channel:");

function toUtcDate(val?: string | Date | null): Date | null {
  if (!val) return null;
  if (val instanceof Date) return Number.isNaN(val.getTime()) ? null : val;
  let s = String(val).trim();
  // Accept "YYYY-MM-DD HH:mm:ss(.sss)" and treat as UTC
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(\.\d+)?$/.test(s)) s = s.replace(" ", "T") + "Z";
  // If no timezone marker, force Z
  else if (!/[zZ]|[+\-]\d{2}:\d{2}$/.test(s)) s = s + "Z";
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}
function addSeconds(d: Date, secs: number) { return new Date(d.getTime() + secs * 1000); }

/** Bucket rule: ALL channels use "channel{id}" except Freedom School which is "freedom_school" (lowercase). */
function bucketForChannel(ch: Channel | null): string | null {
  if (!ch) return null;
  const slug = (ch.slug || "").toLowerCase().trim();
  if (slug === "freedom-school" || slug === "freedom_school") return "freedom_school";
  if (Number.isFinite(ch.id) && ch.id > 0) return `channel${ch.id}`;
  return null;
}

/** Public URL helper for *public* buckets (your buckets are public) */
function publicUrl(bucket: string, objectPath: string): string | undefined {
  try {
    const { data } = supabase.storage.from(bucket).getPublicUrl(cleanPath(objectPath));
    return data?.publicUrl || undefined;
  } catch { return undefined; }
}

/** Resolve absolute/bucket/relative into a playable PUBLIC URL (no extension gating) */
async function resolvePlayableUrl(program: Program, channelBucket: string | null) {
  // Prefer your helper if present; otherwise use mp4_url as stored
  let raw = (getVideoUrlForProgram(program) || program.mp4_url || "").trim();
  if (!raw) return undefined;

  // YouTube handled by render branch
  if (isYouTubeMarker(raw)) return undefined;

  // Absolute https or absolute path → use as-is (unchanged logic)
  if (/^https?:\/\//i.test(raw) || raw.startsWith("/")) return raw;

  // Explicit bucket override: "bucket:path" or "storage://bucket/path"
  const m =
    /^([a-z0-9_\-]+):(.+)$/i.exec(raw) ||
    /^storage:\/\/([^/]+)\/(.+)$/i.exec(raw);
  if (m) {
    const b = m[1];
    const p = cleanPath(m[2]);
    return publicUrl(b, p);
  }

  // Relative path: resolve against this channel's bucket (channel{id} or freedom_school)
  if (!channelBucket) return undefined;
  let rel = cleanPath(raw);

  // If someone accidentally stored "channel{id}/file.mp4", strip that prefix
  const prefix = `${channelBucket.replace(/\/+$/, "")}/`.toLowerCase();
  if (rel.toLowerCase().startsWith(prefix)) rel = rel.slice(prefix.length);

  return publicUrl(channelBucket, rel);
}

/** Standby public URL in the same bucket */
function resolveStandbyUrl(channelBucket: string | null) {
  if (!channelBucket) return undefined;
  return publicUrl(channelBucket, STANDBY_OBJECT);
}

/* ───────── page ───────── */

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

  const bucketRef = useRef<string | null>(null);
  const poster = channel?.logo_url || undefined;
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const playerKeyRef = useRef(0);

  // Load channel
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true); setErr(null);
      const ch = await fetchChannelDetails(channelId!);
      if (cancelled) return;
      if (!ch) { setErr("Channel not found."); setLoading(false); return; }
      setChannel(ch as any);
      bucketRef.current = bucketForChannel(ch as any);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
      if (refreshTimer.current) { clearTimeout(refreshTimer.current); refreshTimer.current = null; }
    };
  }, [channelId]);

  const scheduleRefreshAt = (when: Date | null) => {
    if (refreshTimer.current) { clearTimeout(refreshTimer.current); refreshTimer.current = null; }
    if (!when) return;
    const delay = Math.max(0, when.getTime() - Date.now() + 1000);
    refreshTimer.current = setTimeout(() => { void pickAndResolve(); }, delay);
  };

  const pickAndResolve = useCallback(async () => {
    if (!channel) return;

    // Channel 21 = YouTube Live
    if (channel.id === CH21_ID) {
      setActiveProgram({
        id: "youtube-live",
        channel_id: CH21_ID,
        title: channel.name ? `${channel.name} Live` : "Live",
        mp4_url: `youtube_channel:${channel.youtube_channel_id || YT_FALLBACK_CH21}`,
        start_time: new Date(Date.now() - 3600000).toISOString(),
        duration: 31536000, // 1y window
      } as any);
      setNextProgram(null);
      setPlayingSrc(undefined);
      setUsingStandby(false);
      scheduleRefreshAt(null);
      return;
    }

    setLoading(true); setErr(null);

    try {
      const now = new Date();
      const nowIso = now.toISOString();

      // recently started programs (desc)
      const { data: started, error: err1 } = await supabase
        .from("programs")
        .select("id, channel_id, title, mp4_url, start_time, duration")
        .eq("channel_id", channel.id)
        .lte("start_time", nowIso)
        .order("start_time", { ascending: false })
        .limit(8);
      if (err1) throw new Error(err1.message);

      // pick ACTIVE window strictly
      let active: Program | null = null;
      if (started && started.length) {
        for (const p of started as Program[]) {
          if (!p.start_time || typeof p.duration !== "number" || p.duration <= 0) continue;
          const st = toUtcDate(p.start_time); if (!st) continue;
          const en = addSeconds(st, p.duration);
          if (now >= st && now < en) { active = p; break; }
        }
      }

      // NEXT program strictly after now
      const { data: up } = await supabase
        .from("programs")
        .select("id, channel_id, title, mp4_url, start_time, duration")
        .eq("channel_id", channel.id)
        .gt("start_time", nowIso)
        .order("start_time", { ascending: true })
        .limit(1);
      const next = (up && up[0] as Program) || null;
      setNextProgram(next);

      const bucket = bucketRef.current;

      if (active) {
        // Resolve active URL (ACCEPT ANY URL — don't gate by extension)
        const resolved = await resolvePlayableUrl(active, bucket);
        if (resolved) {
          setActiveProgram(active);
          setPlayingSrc(resolved);
          setUsingStandby(false);
          playerKeyRef.current += 1;
        } else {
          // Couldn't resolve → standby
          const standby = resolveStandbyUrl(bucket);
          setActiveProgram(active);
          setPlayingSrc(standby);
          setUsingStandby(true);
          playerKeyRef.current += 1;
        }

        // refresh at the earlier of (active end, next start)
        const endAt = addSeconds(toUtcDate(active.start_time)!, active.duration);
        const nextStart = next ? toUtcDate(next.start_time)! : null;
        const boundary = nextStart && nextStart < endAt ? nextStart : endAt;
        scheduleRefreshAt(boundary);
        setLoading(false);
        return;
      }

      // No active → play standby until next program starts
      const standby = resolveStandbyUrl(bucket);
      setActiveProgram(null);
      setPlayingSrc(standby);
      setUsingStandby(true);
      playerKeyRef.current += 1;
      scheduleRefreshAt(next ? toUtcDate(next.start_time)! : null);
      setLoading(false);
    } catch (e: any) {
      setErr(e.message || "Error loading schedule.");
      setLoading(false);
    }
  }, [channel]);

  useEffect(() => {
    if (!channel || !channelIdNum) return;
    void pickAndResolve();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channelIdNum, channel]);

  /* ───────── render ───────── */

  const isYouTube = isYouTubeMarker(activeProgram?.mp4_url);
  const ytId = isYouTube ? String(activeProgram!.mp4_url).split(":")[1] : null;

  return (
    <div className="bg-black min-h-screen flex flex-col text-white">
      <div className="p-4 flex items-center justify-between bg-gray-900/50 sticky top-0 z-10">
        <button onClick={() => router.back()} className="p-2 rounded-full hover:bg-gray-700" aria-label="Go back">
          <ChevronLeft className="h-6 w-6" />
        </button>
        <h1 className="text-xl font-semibold truncate px-2">
          {channel?.name || `Channel ${channelId}`}
        </h1>
        <div className="w-10 h-10" />
      </div>

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
            poster={channel?.logo_url || undefined}
            programTitle={
              activeProgram
                ? (usingStandby ? `${activeProgram.title || "Program"} (Standby playback)` : activeProgram.title || undefined)
                : "Standby (waiting for next program)"
            }
            onVideoEnded={() => { void pickAndResolve(); }}
            onError={() => {
              // Only on REAL playback error, swap to standby (if available)
              if (!usingStandby) {
                const fallback = resolveStandbyUrl(bucketRef.current);
                if (fallback) {
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
            Standby not available publicly. Waiting for next program…
          </div>
        )}
      </div>

      <div className="p-4 space-y-4">
        {activeProgram && channelIdNum !== CH21_ID && (
          <>
            <h2 className="text-2xl font-bold">{activeProgram.title || "Now Playing"}</h2>
            <p className="text-sm text-gray-400">
              Start: {(() => { const d = toUtcDate(activeProgram.start_time); return d ? d.toLocaleString() : "—"; })()}
              {" • "}Duration: {activeProgram.duration}s
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
                — {(() => { const d = toUtcDate(nextProgram.start_time); return d ? d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", timeZoneName: "short" }) : "—"; })()}
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
            <div><b>Poster (logo_url):</b> {channel?.logo_url || "—"}</div>
          </div>
        )}
      </div>
    </div>
  );
}
