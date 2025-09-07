"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useParams, useRouter } from "next/navigation";
import VideoPlayer from "@/components/video-player";
import {
  getSupabase,
  toUtcDate,
  addSeconds,
  parseDurationSec,
  getVideoUrlForProgram,
  fetchChannelById,
  fetchProgramsForChannel,
  type Program,
  type Channel,
} from "@/lib/supabase";
import { ChevronLeft, Loader2 } from "lucide-react";

const CH21_ID = 21;
const STANDBY_PLACEHOLDER_ID = "__standby__";

// helper: UTC "now"
const nowUtc = () => new Date(new Date().toISOString());

export default function WatchPage() {
  const router = useRouter();
  const params = useParams();
  const supabase = useMemo(() => getSupabase(), []);

  const channelIdStr = String(params.channelId || "");
  const [channelId, setChannelId] = useState<number | null>(null);

  const [channel, setChannel] = useState<Channel | null>(null);
  const [current, setCurrent] = useState<Program | null>(null);
  const [upcoming, setUpcoming] = useState<Program[]>([]);

  const [videoSrc, setVideoSrc] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  // normalize numeric channel id
  useEffect(() => {
    const s = channelIdStr.trim();
    if (!/^\d+$/.test(s)) {
      setErr(`Channel id must be numeric (got "${s}")`);
      setChannelId(null);
      return;
    }
    const n = Number(s.replace(/^0+/, "") || "0");
    setChannelId(Number.isFinite(n) ? n : null);
  }, [channelIdStr]);

  // load channel + decide what to play
  const refresh = useCallback(async (cid: number) => {
    setLoading(true);
    setErr(null);
    try {
      // channel row
      const ch = await fetchChannelById(supabase, cid);
      if (!ch) throw new Error(`Channel not found (id=${cid})`);
      setChannel(ch);

      // programs list
      const list = await fetchProgramsForChannel(supabase, cid);
      const now = nowUtc();

      // pick current by strict UTC window
      let cur: Program | null = null;
      for (const p of list) {
        const st = toUtcDate(p.start_time);
        if (!st) continue;
        const dur = Math.max(60, parseDurationSec(p.duration));
        const en = addSeconds(st, dur);
        if (now >= st && now < en) {
          cur = p;
          break;
        }
      }

      // compute next
      const nxt =
        list.find((p) => {
          const st = toUtcDate(p.start_time);
          return !!st && st > now;
        }) || null;

      setCurrent(cur ?? null);
      setUpcoming(nxt ? [nxt, ...list.filter((p) => toUtcDate(p.start_time)! > toUtcDate(nxt.start_time)! ).slice(0, 2)] : []);

      // resolve src:
      // CH21 -> YouTube embed if youtube_channel_id present
      const ytId = (ch.youtube_channel_id || "").trim();
      if (cid === CH21_ID && ytId) {
        const url = `https://www.youtube.com/embed/live_stream?channel=${encodeURIComponent(
          ytId
        )}&autoplay=1&mute=1`;
        setVideoSrc(url);
        return;
      }

      // current program url
      let src: string | undefined = undefined;
      if (cur) {
        src = getVideoUrlForProgram(cur);
      }

      // standby URL (per-channel)
      if (!src) {
        const standbyLikeProgram: Program = {
          channel_id: cid,
          mp4_url: `standby_blacktruthtv.mp4`,
          title: "Standby",
          duration: 300,
          start_time: now.toISOString(),
        };
        src = getVideoUrlForProgram(standbyLikeProgram);
      }

      if (!src) throw new Error("No playable URL for program/standby");
      setVideoSrc(src);
    } catch (e: any) {
      setErr(e?.message || "Failed to load channel.");
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    if (channelId == null) return;
    refresh(channelId);
  }, [channelId, refresh]);

  // auto refresh each minute (and when tab visible)
  useEffect(() => {
    if (channelId == null) return;
    const t = setInterval(() => {
      if (document.visibilityState === "visible") refresh(channelId);
    }, 60000);
    return () => clearInterval(t);
  }, [channelId, refresh]);

  const onEnded = useCallback(() => {
    if (channelId != null) refresh(channelId);
  }, [channelId, refresh]);

  const onVideoError = useCallback(() => {
    if (channelId == null) return;
    // swap to per-channel standby if not already
    const standbyLikeProgram: Program = {
      channel_id: channelId,
      mp4_url: `standby_blacktruthtv.mp4`,
      title: "Standby",
      duration: 300,
      start_time: nowUtc().toISOString(),
    };
    const s = getVideoUrlForProgram(standbyLikeProgram);
    if (s && s !== videoSrc) setVideoSrc(s);
  }, [channelId, videoSrc]);

  const isYouTube = (videoSrc || "").includes("youtube.com/embed");
  const poster = channel?.logo_url || undefined;

  let content: ReactNode;
  if (err) {
    content = <p className="text-red-400 p-4 text-center">Error: {err}</p>;
  } else if (loading && !videoSrc) {
    content = (
      <div className="flex flex-col items-center justify-center h-full">
        <Loader2 className="h-10 w-10 animate-spin text-red-500 mb-2" />
        <p>Loading Channel...</p>
      </div>
    );
  } else if (isYouTube && videoSrc) {
    content = (
      <iframe
        title="YouTube Live"
        className="w-full h-full"
        allow="autoplay; encrypted-media; picture-in-picture"
        src={videoSrc}
      />
    );
  } else if (videoSrc) {
    content = (
      <VideoPlayer
        src={videoSrc}
        poster={poster}
        isStandby={current == null}
        programTitle={current?.title || "Standby Programming"}
        onVideoEnded={onEnded}
        onError={onVideoError}
      />
    );
  } else {
    content = <p className="text-gray-400 p-4 text-center">Initializing channel...</p>;
  }

  // compute Now & Next display
  const nowLabel = useMemo(() => {
    if (!current) return null;
    const st = toUtcDate(current.start_time);
    if (!st) return null;
    const en = addSeconds(st, Math.max(60, parseDurationSec(current.duration)));
    try {
      return `${st.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", timeZoneName: "short" })} – ${en.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", timeZoneName: "short" })}`;
    } catch {
      return null;
    }
  }, [current]);

  return (
    <div className="bg-black min-h-screen flex flex-col text-white">
      {/* top bar */}
      <div className="p-4 flex items-center justify-between bg-gray-900/50 sticky top-0 z-10">
        <button
          onClick={() => router.back()}
          className="p-2 rounded-full hover:bg-gray-700"
          aria-label="Go back"
        >
          <ChevronLeft className="h-6 w-6" />
        </button>
        <h1 className="text-xl font-semibold truncate px-2">
          {channel?.name || (channelId != null ? `Channel ${channelId}` : "Channel")}
        </h1>
        <div className="w-10 h-10" />
      </div>

      {/* player */}
      <div className="w-full aspect-video bg-black flex items-center justify-center">{content}</div>

      {/* now & next */}
      <div className="p-4 flex-grow space-y-2">
        {current && (
          <>
            <h2 className="text-2xl font-bold">{current.title || "Now Playing"}</h2>
            {nowLabel && (
              <p className="text-sm text-gray-400">
                {nowLabel}
              </p>
            )}
          </>
        )}

        {upcoming.length > 0 && (
          <div className="mt-4">
            <h3 className="text-lg font-semibold text-white mb-2">Upcoming Programs</h3>
            <ul className="text-sm text-gray-300 space-y-1">
              {upcoming.slice(0, 4).map((p, i) => {
                const st = toUtcDate(p.start_time);
                return (
                  <li key={`${p.channel_id}-${p.start_time}-${i}`}>
                    <span className="font-medium">{p.title || "Program"}</span>{" "}
                    <span className="text-gray-400">
                      — {st ? st.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", timeZoneName: "short" }) : ""}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
