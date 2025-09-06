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
const STANDBY_FILE = "standby_blacktruthtv.mp4";

const nowUtc = () => new Date();
const MIN_RECHECK_MS = 15_000;
const POLL_MS = 30_000;

function standbyProgram(channelId: number): Program {
  return {
    id: STANDBY_PLACEHOLDER_ID,
    channel_id: channelId,
    title: "Standby Programming",
    mp4_url: STANDBY_FILE,
    start_time: nowUtc().toISOString(),
    duration: 300,
  } as any;
}

export default function WatchPage() {
  const { channelId } = useParams<{ channelId: string }>();
  const search = useSearchParams();
  const debug = (search?.get("debug") ?? "0") === "1";

  // NUMERIC-ONLY: require /watch/<number>
  const param = useMemo(() => String(channelId), [channelId]);
  const channelNum = useMemo(() => Number(param), [param]);

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

  const [dbgRows, setDbgRows] = useState<
    { id: string | number; title: string | null; raw: string; startIso?: string; endIso?: string; duration: number; isNow: boolean; resolved?: string }[]
  >([]);
  const [dbgMeta, setDbgMeta] = useState<{ count: number } | null>(null);

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
      if (now >= st && now < en) return p; // first current program
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

    if (error) {
      console.warn("[WATCH] programs fetch error", error);
      setDbgMeta({ count: 0 });
      return [];
    }

    const rows = (data || []) as Program[];
    rows.sort((a, b) => {
      const as = toUtcDate(a.start_time)?.getTime() ?? 0;
      const bs = toUtcDate(b.start_time)?.getTime() ?? 0;
      return as - bs;
    });
    setDbgMeta({ count: rows.length });
    return rows;
  }, [supabase]);

  const pickAndPlay = useCallback(async (showLoading = true) => {
    try {
      if (showLoading) setLoading(true);
      setErr(null);

      if (!Number.isFinite(channelNum)) {
        throw new Error("Channel id must be numeric (e.g., /watch/1).");
      }

      const ch = await fetchChannelDetails(channelNum);
      if (!ch) throw new Error("Channel not found.");
      setChannel(ch as Channel);

      // CH21 → YouTube embed if configured
      const ytId = (ch as any)?.youtube_channel_id ? String((ch as any).youtube_channel_id).trim() : "";
      if (channelNum === CH21 && ytId) {
        setActive(null); setNextUp(null); setVideoSrc(undefined); setUsingStandby(false);
        setDbgRows([]);
        if (showLoading) setLoading(false);
        return;
      }

      const programs = await fetchProgramsForChannel(channelNum);
      const now = nowUtc();

      const rows = programs.map(pr => {
        const st = toUtcDate(pr.start_time);
        const dur = Math.max(60, parseDurationSec(pr.duration) || 0);
        const en  = st ? addSeconds(st, dur) : null;
        return {
          id: pr.id,
          title: pr.title ?? null,
          raw: pr.start_time,
          startIso: st ? st.toISOString() : undefined,
          endIso: en ? en.toISOString() : undefined,
          duration: dur,
          isNow: !!(st && en && now >= st && now < en),
          resolved: getVideoUrlForProgram(pr),
        };
      });
      setDbgRows(rows);

      const current = pickActive(programs, now);
      const nxt = programs.find(p => {
        const st = toUtcDate(p.start_time);
        return !!st && st > now;
      }) || null;
      setNextUp(nxt);

      if (current) {
        const nextSrc = getVideoUrlForProgram(current) || current.mp4_url || undefined;
        setActive(current);
        setUsingStandby(false);

        if (nextSrc && nextSrc !== lastSrcRef.current) {
          setVideoSrc(nextSrc);
          lastSrcRef.current = nextSrc;
          setTimeout(() => { try { (videoRef.current as any)?.load?.(); } catch {} }, 0);
        }

        const st = toUtcDate(current.start_time)!;
        const en = addSeconds(st, Math.max(60, parseDurationSec(current.duration) || 0));
        const boundary = nxt ? (toUtcDate(nxt.start_time) as Date) : en;
        if (boundary) scheduleRefreshAt(boundary);
      } else {
        const sb = standbyProgram(channelNum);
        const sbSrc = getVideoUrlForProgram(sb) || sb.mp4_url || undefined;
        setActive(sb);
        setUsingStandby(true);

        if (sbSrc && sbSrc !== lastSrcRef.current) {
          setVideoSrc(sbSrc);
          lastSrcRef.current = sbSrc;
          setTimeout(() => { try { (videoRef.current as any)?.load?.(); } catch {} }, 0);
        }

        if (nxt) scheduleRefreshAt(toUtcDate(nxt.start_time) as Date);
      }
    } catch (e: any) {
      setErr(e?.message || "Failed to load channel/programs.");
    } finally {
      if (showLoading) setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channelNum, fetchProgramsForChannel]);

  useEffect(() => {
    void pickAndPlay(true);
    if (pollTimer.current) clearInterval(pollTimer.current);
    pollTimer.current = setInterval(() => {
      if (document.visibilityState === "visible") void pickAndPlay(false);
    }, POLL_MS);
    return () => { if (pollTimer.current) clearInterval(pollTimer.current); };
  }, [pickAndPlay]);

  const isYouTube = channelNum === CH21 && !!(channel?.youtube_channel_id || "").trim();

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
          if (!usingStandby) {
            const sb = standbyProgram(channelNum);
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
        <svg className="animate-spin h-10 w-10 text-red-500 mb-2" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
        </svg>
        <p>Loading…</p>
      </div>
    );
  } else {
    content = <p className="text-gray-400 p-4 text-center">Standby… waiting for next program.</p>;
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
            {active.id !== STANDBY_PLACEHOLDER_ID && active.start_time && (
              <p className="text-sm text-gray-400">
                Start (local): {toUtcDate(active.start_time)?.toLocaleString()}
              </p>
            )}
            {usingStandby && <p className="text-amber-300 text-sm">Fallback: Standby asset</p>}
          </>
        )}

        {nextUp && (
          <div className="text-sm text-gray-300">
            <span className="font-medium">Next:</span>{" "}
            {nextUp.title || "Upcoming program"}{" "}
            <span className="text-gray-400">
              — {toUtcDate(nextUp.start_time)?.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", timeZoneName: "short" })}
            </span>
          </div>
        )}

        {debug && (
          <div className="mt-3 text-[11px] bg-gray-900/70 border border-gray-700 rounded p-2 space-y-2">
            <div><b>Now (UTC):</b> {nowUtc().toISOString()}</div>
            {dbgMeta && <div><b>Programs found:</b> {dbgMeta.count}</div>}
            <div className="pt-2 border-t border-gray-800">
              <div className="font-semibold mb-1">Programs (parsed):</div>
              {dbgRows.slice(0, 20).map(r => (
                <div key={String(r.id)} className="grid grid-cols-1 md:grid-cols-2 gap-1 mb-2">
                  <div><b>ID:</b> {String(r.id)} • <b>Title:</b> {r.title || "—"}</div>
                  <div className="truncate"><b>Src:</b> {r.resolved || "—"}</div>
                  <div><b>Raw:</b> {r.raw}</div>
                  <div><b>Start:</b> {r.startIso || "—"} • <b>End:</b> {r.endIso || "—"}</div>
                  <div><b>Dur(s):</b> {r.duration} • <b>Active now?</b> {r.isNow ? "YES" : "no"}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
