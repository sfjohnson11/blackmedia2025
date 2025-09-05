// app/watch/[channelId]/page.tsx
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, Loader2 } from "lucide-react";
import YouTubeEmbed from "@/components/youtube-embed";
import VideoPlayer from "@/components/video-player";
import { supabase, fetchChannelDetails, getVideoUrlForProgram } from "@/lib/supabase";

/* ---------- types ---------- */
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
  start_time: string; // ISO-ish UTC (accepts "YYYY-MM-DD HH:mm:ss")
  duration: number;   // seconds
};

/* ---------- constants ---------- */
const CH21_ID = 21;
const YT_FALLBACK_CH21 = "UCMkW239dyAxDyOFDP0D6p2g";

// change this to your exact standby filename if different
const STANDBY_NAMES = [
  "standby_blacktruthtv.mp4",
  "Standby_blacktruthtv.mp4",
  "standby.mp4",
  "Standby.mp4",
];

/* ---------- helpers ---------- */
const cleanPath = (p: string) => p.replace(/^\.?\//, "");

function toUtcDate(val?: string | Date | null): Date | null {
  if (!val) return null;
  if (val instanceof Date) return Number.isNaN(val.getTime()) ? null : val;
  let s = String(val).trim();
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(\.\d+)?$/.test(s)) s = s.replace(" ", "T") + "Z";
  else if (!/[zZ]|[+\-]\d{2}:\d{2}$/.test(s)) s = s + "Z";
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}
const addSeconds = (d: Date, secs: number) => new Date(d.getTime() + secs * 1000);

function bucketCandidates(ch: Channel | null): string[] {
  if (!ch) return [];
  const out = new Set<string>();
  const slug = (ch.slug || "").trim();
  if (slug) {
    out.add(slug);
    out.add(slug.toLowerCase());
  }
  if (Number.isFinite(ch.id) && ch.id > 0) {
    out.add(`channel${ch.id}`);
    out.add(`Channel${ch.id}`); // some setups used a capital C
  }
  return Array.from(out);
}

function publicUrl(bucket: string, objectPath: string): string | undefined {
  try {
    const { data } = supabase.storage.from(bucket).getPublicUrl(cleanPath(objectPath));
    return data?.publicUrl || undefined;
  } catch {
    return undefined;
  }
}

// Build candidate URLs for a program:
// - absolute http(s) or "/" → use as-is
// - "bucket:path" or "storage://bucket/path" → try exact + lowercased bucket
// - relative → try across bucket candidates; if path starts with "<bucket>/", also try the stripped key
function candidateUrlsForProgram(program: Program, channel: Channel | null): string[] {
  const raw = (getVideoUrlForProgram(program) || "").trim();
  if (!raw) return [];

  if (/^https?:\/\//i.test(raw) || raw.startsWith("/")) return [raw];

  const m =
    /^([a-z0-9_\-]+):(.+)$/i.exec(raw) ||
    /^storage:\/\/([^/]+)\/(.+)$/i.exec(raw);
  if (m) {
    const b = m[1];
    const p = m[2];
    const tries = [publicUrl(b, p), publicUrl(b.toLowerCase(), p)];
    return tries.filter(Boolean) as string[];
  }

  const buckets = bucketCandidates(channel);
  if (buckets.length === 0) return [];

  const rel = cleanPath(raw);
  const list: string[] = [];

  for (const b of buckets) {
    const a = publicUrl(b, rel);
    if (a) list.push(a);

    const esc = b.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const rx = new RegExp(`^${esc}/`, "i");
    if (rx.test(rel)) {
      const stripped = rel.replace(rx, "");
      const b2 = publicUrl(b, stripped);
      if (b2 && b2 !== a) list.push(b2);
    }
  }

  return Array.from(new Set(list));
}

function resolveStandbyUrl(channel: Channel | null): string | undefined {
  const buckets = bucketCandidates(channel);
  for (const b of buckets) {
    for (const name of STANDBY_NAMES) {
      const u = publicUrl(b, name);
      if (u) return u;
    }
  }
  return undefined;
}

/* ---------- page ---------- */
export default function WatchPage() {
  const { channelId } = useParams<{ channelId: string }>();
  const router = useRouter();
  const search = useSearchParams();

  const channelIdNum = useMemo(() => Number(channelId), [channelId]);
  const debugOn = (search?.get("debug") ?? "0") === "1";
  const forcedSrc = search?.get("src") || undefined;
  const forceAutoplay = (search?.get("autoplay") ?? "0") === "1";
  const forceMuted = (search?.get("muted") ?? "0") === "1";
  const poll = (search?.get("poll") ?? "0") === "1";

  const [channel, setChannel] = useState<Channel | null>(null);
  const [activeProgram, setActiveProgram] = useState<Program | null>(null);
  const [nextProgram, setNextProgram] = useState<Program | null>(null);

  const [playingSrc, setPlayingSrc] = useState<string | undefined>(undefined);
  const [srcQueue, setSrcQueue] = useState<string[]>([]);
  const [usingStandby, setUsingStandby] = useState(false);

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

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

  // Choose active/next; set candidates; set player
  const pickAndResolve = useCallback(async () => {
    if (!channel) return;

    // CH 21: YouTube Live
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
      setSrcQueue([]);
      setUsingStandby(false);
      scheduleRefreshAt(null);
      return;
    }

    setLoading(true); setErr(null);

    try {
      const now = new Date();
      const nowIso = now.toISOString();

      const { data: started } = await supabase
        .from("programs")
        .select("id, channel_id, title, mp4_url, start_time, duration")
        .eq("channel_id", channel.id)
        .lte("start_time", nowIso)
        .order("start_time", { ascending: false })
        .limit(24);

      // strict active window
      let active: Program | null = null;
      if (started && started.length) {
        for (const p of started as Program[]) {
          const dur = Number((p as any).duration);
          if (!p.start_time || !Number.isFinite(dur) || dur <= 0) continue;
          const st = toUtcDate(p.start_time); if (!st) continue;
          const en = addSeconds(st, dur);
          if (now >= st && now < en) { active = { ...p, duration: dur }; break; }
        }
      }

      // next up strictly after now
      const { data: up } = await supabase
        .from("programs")
        .select("id, channel_id, title, mp4_url, start_time, duration")
        .eq("channel_id", channel.id)
        .gt("start_time", nowIso)
        .order("start_time", { ascending: true })
        .limit(1);
      const next = (up && up[0] as Program) || null;
      setNextProgram(next);

      if (active) {
        const candidates = candidateUrlsForProgram(active, channel);
        if (candidates.length > 0) {
          setActiveProgram(active);
          setPlayingSrc(candidates[0]);
          setSrcQueue(candidates.slice(1));
          setUsingStandby(false);
          playerKeyRef.current += 1;
        } else {
          const sb = resolveStandbyUrl(channel);
          setActiveProgram(active);
          setPlayingSrc(sb);
          setSrcQueue([]);
          setUsingStandby(true);
          playerKeyRef.current += 1;
        }

        const endAt = addSeconds(toUtcDate(active.start_time)!, active.duration);
        const nextStart = next ? toUtcDate(next.start_time)! : null;
        scheduleRefreshAt(nextStart && nextStart < endAt ? nextStart : endAt);
        setLoading(false);
        return;
      }

      // no active → standby until next
      const sb = resolveStandbyUrl(channel);
      setActiveProgram(null);
      setPlayingSrc(sb);
      setSrcQueue([]);
      setUsingStandby(true);
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

  // optional polling while tab is visible
  useEffect(() => {
    if (!poll || !channel) return;
    const id = setInterval(() => {
      if (document.visibilityState === "visible") void pickAndResolve();
    }, 60_000);
    return () => clearInterval(id);
  }, [poll, channel, pickAndResolve]);

  /* ---------- render ---------- */
  const isYouTube = !!activeProgram?.mp4_url?.toString().startsWith("youtube_channel:");
  const ytId = isYouTube ? String(activeProgram!.mp4_url).split(":")[1] : null;

  const srcToPlay = forcedSrc || playingSrc;

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
        ) : isYouTube && ytId && !forcedSrc ? (
          <YouTubeEmbed channelId={ytId} title={activeProgram?.title || "Live"} muted />
        ) : srcToPlay ? (
          <VideoPlayer
            key={playerKeyRef.current}
            src={srcToPlay}
            poster={poster}
            programTitle={
              forcedSrc
                ? "Forced playback (?src=)"
                : activeProgram
                  ? (usingStandby ? `${activeProgram.title || "Program"} (Standby playback)` : activeProgram.title || undefined)
                  : "Standby (waiting for next program)"
            }
            onVideoEnded={() => { if (!forcedSrc) void pickAndResolve(); }}
            onError={() => {
              if (forcedSrc) return; // don't auto-switch when forcing a URL
              if (srcQueue.length > 0) {
                const [nextSrc, ...rest] = srcQueue;
                setPlayingSrc(nextSrc);
                setSrcQueue(rest);
                setUsingStandby(false);
                playerKeyRef.current += 1;
              } else if (!usingStandby) {
                const sb = resolveStandbyUrl(channel);
                if (sb) {
                  setPlayingSrc(sb);
                  setUsingStandby(true);
                  playerKeyRef.current += 1;
                }
              }
            }}
            autoPlay={forceAutoplay}
            muted={forceMuted}
            playsInline
            preload="metadata"
          />
        ) : (
          <div className="text-gray-300 text-sm p-4">
            Standby not available publicly. Waiting for next program…
          </div>
        )}
      </div>

      {/* Details / Next up / Debug */}
      <div className="p-4 space-y-4">
        {activeProgram && channelIdNum !== CH21_ID && (
          <>
            <h2 className="text-2xl font-bold">{activeProgram.title || "Now Playing"}</h2>
            <p className="text-sm text-gray-400">
              Start: {(() => { const d = toUtcDate(activeProgram.start_time); return d ? d.toLocaleString() : "—"; })()}
              {" • "}Duration: {activeProgram.duration}s
              {usingStandby && !forcedSrc && <span className="text-yellow-400"> • Fallback: Standby asset</span>}
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
            <div><b>Bucket candidates:</b> {bucketCandidates(channel).join(", ") || "—"}</div>
            <div><b>Active Program:</b> {activeProgram ? `${String(activeProgram.id)} • ${activeProgram.title || "—"}` : "— (none)"}</div>
            <div className="truncate"><b>Playing Src:</b> {srcToPlay || "—"}</div>
            <div><b>Using Standby:</b> {usingStandby ? "yes" : "no"}</div>
            <div><b>Poster (logo_url):</b> {poster || "—"}</div>
            {srcQueue.length > 0 && <div className="truncate"><b>Queued Candidates:</b> {srcQueue.join("  |  ")}</div>}
            {forcedSrc && <div className="truncate"><b>Forced Src (?src=):</b> {forcedSrc}</div>}
          </div>
        )}
      </div>
    </div>
  );
}
