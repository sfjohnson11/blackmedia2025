// app/watch/[channelId]/page.tsx
"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import YouTubeEmbed from "@/components/youtube-embed";
import VideoPlayer from "@/components/video-player";
import {
  toUtcDate,
  addSeconds,
  parseDurationSec,
  getVideoUrlForProgram,
  STANDBY_PLACEHOLDER_ID,
  fetchChannelDetails,
  type Channel as ChannelT,
  type Program as ProgramT,
} from "@/lib/supabase";

type Channel = ChannelT & { youtube_channel_id?: string | null };
type Program = ProgramT & { start_time: string; duration: number | string };

const CH21 = 21;
const STANDBY_FILE = "standby_blacktruthtv.mp4"; // this file is inside EACH channelN bucket

const nowUtc = () => new Date();
const MIN_RECHECK_MS = 15_000;
const POLL_MS = 30_000;

function channelStandbyProgram(channelId: number): Program {
  // Creates a fake "program" pointing to that channel's standby file
  return {
    id: STANDBY_PLACEHOLDER_ID,
    channel_id: channelId,
    title: "Standby",
    mp4_url: STANDBY_FILE,
    start_time: nowUtc().toISOString(),
    duration: 24 * 3600, // long duration; we stay on it until we switch away
  } as any;
}

export default function WatchPage() {
  const { channelId } = useParams<{ channelId: string }>();
  const search = useSearchParams();
  const debug = (search?.get("debug") ?? "0") === "1";

  const param = useMemo(() => String(channelId), [channelId]);
  const paramNum = useMemo(() => Number(param), [param]);

  const supabase = useMemo(
    () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!),
    []
  );

  const [channel, setChannel]           = useState<Channel | null>(null);
  const [active, setActive]             = useState<Program | null>(null);
  const [nextUp, setNextUp]             = useState<Program | null>(null);
  const [videoSrc, setVideoSrc]         = useState<string | undefined>(undefined);
  const [usingStandby, setUsingStandby] = useState(false);
  const [loading, setLoading]           = useState(true);
  const [err, setErr]                   = useState<string | null>(null);

  const posterSrc   = channel?.logo_url || undefined;
  const videoRef    = useRef<HTMLVideoElement | null>(null);
  const lastSrcRef  = useRef<string | undefined>(undefined);
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollTimer    = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
      if (pollTimer.current) clearInterval(pollTimer.current);
    };
  }, []);

  const scheduleRefreshAt = useCallback((when: Date | null) => {
    if (refreshTimer.current) clearTimeout(refreshTimer.current);
    if (!when) return;
    const ms = when.getTime() - Date.now() + 1000;
    const delay = Math.max(ms, MIN_RECHECK_MS);
    refreshTimer.current = setTimeout(() => { void pickAndPlay(false); }, delay);
  }, []);

  const pickActive = (list: Program[], now: Date): Program | null => {
    for (const p of list) {
      const st = toUtcDate(p.start_time);
      if (!st) continue;
      const dur = Math.max(60, parseDurationSec(p.duration) || 0);
      const en  = addSeconds(st, dur);
      if (now >= st && now < en) return p;
    }
    return null;
  };

  const fetchProgramsForChannel = useCallback(async (chId: number): Promise<Program[]> => {
    const sel = "id, channel_id, title, mp4_url, start_time, duration";
    const { data, error } = await supabase
      .from("programs")
      .select(sel)
      .eq("channel_id", chId)
      .order("start_time", { ascending: true });

    if (error) return [];
    const rows = (data || []) as Program[];
    rows.sort((a, b) => {
      const as = toUtcDate(a.start_time)?.getTime() ?? 0;
      const bs = toUtcDate(b.start_time)?.getTime() ?? 0;
      return as - bs;
    });
    return rows;
  }, [supabase]);

  const resolveChannelNumericId = useCallback(async (): Promise<number> => {
    if (Number.isFinite(paramNum)) return paramNum;

    // 1) slug as-is
    const s1 = await supabase.from("channels").select("id").eq("slug", param).maybeSingle();
    if (!s1.error && s1.data?.id != null) return Number(s1.data.id);

    // 2) slug with _ instead of -
    if (param.includes("-")) {
      const alt = param.replace(/-/g, "_");
      const s2 = await supabase.from("channels").select("id").eq("slug", alt).maybeSingle();
      if (!s2.error && s2.data?.id != null) return Number(s2.data.id);
    }

    // 3) "channel7" -> 7
    if (/^channel\d+$/i.test(param)) {
      const n = Number(param.replace(/[^0-9]/g, ""));
      if (Number.isFinite(n)) return n;
    }

    throw new Error(`Channel not found for "${param}".`);
  }, [param, paramNum, supabase]);

  const pickAndPlay = useCallback(async (showLoading = true) => {
    try {
      if (showLoading) setLoading(true);
      setErr(null);

      // Resolve id (number or slug)
      const resolvedId = await resolveChannelNumericId();

      // Load channel
      const ch = await fetchChannelDetails(resolvedId);
      if (!ch) throw new Error("Channel not found.");
      setChannel(ch as Channel);

      // CH21 -> YouTube always if configured
      const ytId = (ch as any)?.youtube_channel_id ? String((ch as any).youtube_channel_id).trim() : "";
      if (resolvedId === CH21 && ytId) {
        setActive(null); setNextUp(null); setVideoSrc(undefined); setUsingStandby(false);
        if (showLoading) setLoading(false);
        return;
      }

      // Pull full schedule and determine current + next
      const programs = await fetchProgramsForChannel(resolvedId);
      const now = nowUtc();

      const current = pickActive(programs, now);
      const nxt = programs.find(p => {
        const st = toUtcDate(p.start_time);
        return !!st && st > now;
      }) || null;
      setNextUp(nxt);

      if (current) {
        // Play the active program
        const src = getVideoUrlForProgram(current) || current.mp4_url || undefined;
        setActive(current);
        setUsingStandby(false);

        if (src && src !== lastSrcRef.current) {
          setVideoSrc(src);
          lastSrcRef.current = src;
          setTimeout(() => { try { (videoRef.current as any)?.load?.(); } catch {} }, 0);
        }

        // When it ends (or when next starts sooner), refresh
        const st = toUtcDate(current.start_time)!;
        const en = addSeconds(st, Math.max(60, parseDurationSec(current.duration) || 0));
        const boundary = nxt && (toUtcDate(nxt.start_time) as Date) < en ? (toUtcDate(nxt.start_time) as Date) : en;
        if (boundary) scheduleRefreshAt(boundary);
      } else {
        // No active -> STAY on channel's standby file indefinitely
        const sb = channelStandbyProgram(resolvedId);
        const sbSrc = getVideoUrlForProgram(sb) || sb.mp4_url || undefined; // resolves to channelN/standby_blacktruthtv.mp4
        setActive(sb);
        setUsingStandby(true);

        if (sbSrc && sbSrc !== lastSrcRef.current) {
          setVideoSrc(sbSrc);
          lastSrcRef.current = sbSrc;
          setTimeout(() => { try { (videoRef.current as any)?.load?.(); } catch {} }, 0);
        }

        // If there is a future program, schedule a refresh at its start
        if (nxt) scheduleRefreshAt(toUtcDate(nxt.start_time) as Date);
        // If there is no next, we just keep playing standby; the POLL keeps checking anyway.
      }
    } catch (e: any) {
      setErr(e?.message || "Failed to load channel/programs.");
    } finally {
      if (showLoading) setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolveChannelNumericId, fetchProgramsForChannel]);

  useEffect(() => {
    void pickAndPlay(true);
    if (pollTimer.current) clearInterval(pollTimer.current);
    // Keep polling; if a program becomes active while on standby, we'll switch
    pollTimer.current = setInterval(() => {
      if (document.visibilityState === "visible") void pickAndPlay(false);
    }, POLL_MS);
    return () => { if (pollTimer.current) clearInterval(pollTimer.current); };
  }, [pickAndPlay]);

  const isYouTube = (channel?.id === CH21 || Number(channel?.id) === CH21) && !!(channel?.youtube_channel_id || "").trim();

  let content: ReactNode;
  if (err) {
    content = <p className="text-red-400 p-4 text-center">Error: {err}</p>;
  } else if (isYouTube) {
    content = (
      <YouTubeEmbed
        channelId={channel!.youtube_channel_id as string}
        title={channel?.name ? `${channel.name} Live` : "Live"}
      />
    );
  } else if (active && videoSrc) {
    content = (
      <VideoPlayer
        // @ts-expect-error: optional load via ref
        ref={videoRef}
        src={videoSrc}
        poster={posterSrc || undefined}
        isStandby={usingStandby}
        programTitle={active?.title || undefined}
        autoPlay={true}
        muted={true}
        playsInline={true}
        preload="auto"
        onVideoEnded={() => void pickAndPlay(false)}
        onError={() => {
          // Any error -> fall back to that channel's standby and STAY there
          if (!usingStandby) {
            const chNum = Number(channel?.id) || paramNum || 0;
            const sb = channelStandbyProgram(chNum);
            const sbSrc = getVideoUrlForProgram(sb) || sb.mp4_url || undefined;
            setActive(sb);
            setUsingStandby(true);
            if (sbSrc) {
              setVideoSrc(sbSrc);
              lastSrcRef.current = sbSrc;
              setTimeout(() => { try { (videoRef.current as any)?.load?.(); } catch {} }, 0);
            }
          }
        }}
      />
    );
  } else if (loading) {
    content = (
      <div className="flex flex-col items-center justify-center h-full">
        <svg className="animate-spin h-10 w-10 text-yellow-400 mb-2" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
        </svg>
        <p>Loading…</p>
      </div>
    );
  } else {
    content = <p className="text-gray-400 p-4 text-center">Standby…</p>;
  }

  return (
    <div className="bg-black min-h-screen text-white">
      <div className="w-full aspect-video bg-black flex items-center justify-center">
        {content}
      </div>

      <div className="p-4 space-y-3">
        {active && !isYouTube && (
          <>
            <h2 className="text-xl font-bold">{active.title || "Now Playing"}</h2>
            {usingStandby && <p className="text-amber-300 text-sm">Channel Standby</p>}
          </>
        )}

        {nextUp && !usingStandby && (
          <div className="text-sm text-gray-300">
            <span className="font-medium">Next:</span>{" "}
            {nextUp.title || "Upcoming program"}
          </div>
        )}

        {debug && (
          <div className="mt-3 text-[11px] bg-gray-900/70 border border-gray-700 rounded p-2 space-y-2">
            <div><b>Now (UTC):</b> {new Date().toISOString()}</div>
          </div>
        )}
      </div>
    </div>
  );
}
