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

const isNumeric = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const asNum = (v: unknown): number | null => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

function standbyProgram(channelKey: number | string): Program {
  return {
    id: STANDBY_PLACEHOLDER_ID,
    channel_id: channelKey,
    title: "Standby Programming",
    mp4_url: STANDBY_FILE, // relative; resolver picks the right bucket
    start_time: nowUtc().toISOString(),
    duration: 300,
  } as any;
}

export default function WatchPage() {
  const { channelId } = useParams<{ channelId: string }>();
  const search = useSearchParams();
  const debug = (search?.get("debug") ?? "0") === "1";

  const paramRaw = useMemo(() => String(channelId), [channelId]);
  // normalize freedom-school → freedom_school just in case
  const param = useMemo(() => paramRaw.replace(/-/g, "_"), [paramRaw]);

  const supabase = useMemo(
    () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!),
    []
  );

  const [channel, setChannel] = useState<Channel | null>(null);
  const [channelNum, setChannelNum] = useState<number | null>(null);
  const [active, setActive] = useState<Program | null>(null);
  const [nextUp, setNextUp] = useState<Program | null>(null);
  const [videoSrc, setVideoSrc] = useState<string | undefined>(undefined);
  const [usingStandby, setUsingStandby] = useState(false);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const posterSrc = channel?.logo_url || undefined;
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const lastSrcRef = useRef<string | undefined>(undefined);
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null);

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
    refreshTimer.current = setTimeout(() => {
      void pickAndPlay(false);
    }, delay);
  }, []);

  // PATCH B — strict, early-returning active picker (UTC)
  const pickActive = (list: Program[], now: Date): Program | null => {
    for (const p of list) {
      const st = toUtcDate(p.start_time);
      if (!st) continue;
      const durSec = parseDurationSec(p.duration) ?? 0;
      const dur = Math.max(60, durSec); // minimum 60s to avoid flapping
      const en = addSeconds(st, dur);
      if (now >= st && now < en) return p; // first active is the winner
    }
    return null;
  };

  // PATCH A — bulletproof program fetch for numeric OR text channel_id
  const fetchProgramsForChannel = useCallback(
    async (chId: number | string): Promise<Program[]> => {
      const sel = "id, channel_id, title, mp4_url, start_time, duration";

      const chStr = String(chId).trim();
      const chNum = Number(chStr);
      const tryNumeric = Number.isFinite(chNum);

      let rows: Program[] = [];

      // 1) Try numeric equality
      if (tryNumeric) {
        const { data, error } = await supabase
          .from("programs")
          .select(sel)
          .eq("channel_id", chNum)
          .order("start_time", { ascending: true });

        if (error) console.warn("[WATCH] numeric channel_id eq error", error);
        if (data?.length) rows = data as Program[];
      }

      // 2) Fallback to text equality
      if (rows.length === 0) {
        const { data, error } = await supabase
          .from("programs")
          .select(sel)
          .eq("channel_id", chStr)
          .order("start_time", { ascending: true });

        if (error) console.warn("[WATCH] text channel_id eq error", error);
        if (data?.length) rows = data as Program[];
      }

      // Keep it clean: no cross-channel guessing based on mp4_url path

      rows.sort((a, b) => {
        const as = toUtcDate(a.start_time)?.getTime() ?? 0;
        const bs = toUtcDate(b.start_time)?.getTime() ?? 0;
        return as - bs;
      });

      setDbgMeta({ count: rows.length });
      return rows;
    },
    [supabase]
  );

  const pickAndPlay = useCallback(
    async (showLoading = true) => {
      try {
        if (showLoading) setLoading(true);
        setErr(null);

        const ch = await fetchChannelDetails(param);
        if (!ch) throw new Error("Channel not found.");
        setChannel(ch as Channel);

        const n = asNum((ch as any).id);
        setChannelNum(n);

        // CH21 → YouTube embed if youtube_channel_id present
        const ytId = (ch as any)?.youtube_channel_id ? String((ch as any).youtube_channel_id).trim() : "";
        if (n === CH21 && ytId) {
          setActive(null);
          setNextUp(null);
          setVideoSrc(undefined);
          setUsingStandby(false);
          setDbgRows([]);
          if (showLoading) setLoading(false);
          return;
        }

        const programs = await fetchProgramsForChannel((ch as any).id);
        const now = nowUtc();

        const rows = programs.map((pr) => {
          const st = toUtcDate(pr.start_time);
          const dur = Math.max(60, parseDurationSec(pr.duration) || 0);
          const en = st ? addSeconds(st, dur) : null;
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
        const nxt =
          programs.find((p) => {
            const st = toUtcDate(p.start_time);
            return !!st && st > now;
          }) || null;
        setNextUp(nxt);

        if (current) {
          const nextSrc = getVideoUrlForProgram(current) || (current as any).mp4_url || undefined;
          setActive(current);
          setUsingStandby(false);

          if (nextSrc && nextSrc !== lastSrcRef.current) {
            setVideoSrc(nextSrc);
            lastSrcRef.current = nextSrc;
            setTimeout(() => {
              try {
                (videoRef.current as any)?.load?.();
              } catch {}
            }, 0);
          }

          const st = toUtcDate(current.start_time)!;
          const dur = Math.max(60, parseDurationSec(current.duration) ?? 0);
          const en = addSeconds(st, dur);

          // PATCH C — resilient boundary (next start or end of current)
          const boundary = nxt ? (toUtcDate(nxt.start_time) as Date) : en;
          if (boundary) scheduleRefreshAt(boundary);
        } else {
          const sb = standbyProgram((ch as any).id);
          const sbSrc = getVideoUrlForProgram(sb) || (sb as any).mp4_url || undefined;
          setActive(sb);
          setUsingStandby(true);

          if (sbSrc && sbSrc !== lastSrcRef.current) {
            setVideoSrc(sbSrc);
            lastSrcRef.current = sbSrc;
            setTimeout(() => {
              try {
                (videoRef.current as any)?.load?.();
              } catch {}
            }, 0);
          }

          if (nxt) scheduleRefreshAt(toUtcDate(nxt.start_time) as Date);
        }
      } catch (e: any) {
        setErr(e?.message || "Failed to load channel/programs.");
      } finally {
        if (showLoading) setLoading(false);
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    },
    [param, fetchProgramsForChannel]
  );

  useEffect(() => {
    void pickAndPlay(true);
    if (pollTimer.current) clearInterval(pollTimer.current);
    pollTimer.current = setInterval(() => {
      if (document.visibilityState === "visible") void pickAndPlay(false);
    }, POLL_MS);
    return () => {
      if (pollTimer.current) clearInterval(pollTimer.current);
    };
  }, [pickAndPlay]);

  const isYouTube =
    channelNum === CH21 && !!(channel?.youtube_channel_id ? String(channel.youtube_channel_id).trim() : "");

  let content: ReactNode;
  if (err) {
    content = <p className="text-red-400 p-4 text-center">Error: {err}</p>;
  } else if (isYouTube) {
    content = (
      <YouTubeEmbed channelId={channel!.youtube_channel_id as string} title={channel?.name ? `${channel.name} Live` : "Live"} />
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
            const sb = standbyProgram((channel as any).id);
            const sbSrc = getVideoUrlForProgram(sb) || (sb as any).mp4_url || undefined;
            setActive(sb);
            setUsingStandby(true);
            if (sbSrc) {
              setVideoSrc(sbSrc);
              lastSrcRef.current = sbSrc;
              setTimeout(() => {
                try {
                  (videoRef.current as any)?.load?.();
                } catch {}
              }, 0);
            }
          }
        }}
      />
    );
  } else if (loading) {
    content = (
      <div className="flex flex-col items-center justify-center h-full">
        <svg className="animate-spin h-10 w-10 text-red-500 mb-2" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
        </svg>
        <p>Loading…</p>
      </div>
    );
  } else {
    content = <p className="text-gray-400 p-4 text-center">Standby… waiting for next program.</p>;
  }

  return (
    <div className="bg-black min-h-screen text-white">
      <div className="w-full aspect-video bg-black flex items-center justify-center">{content}</div>

      <div className="p-4 space-y-3">
        {active && !isYouTube && (
          <>
            <h2 className="text-xl font-bold">{active.title || "Now Playing"}</h2>
            {active.id !== STANDBY_PLACEHOLDER_ID && active.start_time && (
              <p className="text-sm text-gray-400">Start (local): {toUtcDate(active.start_time)?.toLocaleString()}</p>
            )}
            {usingStandby && <p className="text-amber-300 text-sm">Fallback: Standby asset</p>}
          </>
        )}

        {nextUp && (
          <div className="text-sm text-gray-300">
            <span className="font-medium">Next:</span>{" "}
            {nextUp.title || "Upcoming program"}{" "}
            <span className="text-gray-400">
              —{" "}
              {toUtcDate(nextUp.start_time)?.toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
                timeZoneName: "short",
              })}
            </span>
          </div>
        )}

        {debug && (
          <div className="mt-3 text-[11px] bg-gray-900/70 border border-gray-700 rounded p-2 space-y-2">
            <div>
              <b>Now (UTC):</b> {nowUtc().toISOString()}
            </div>
            {dbgMeta && (
              <div>
                <b>Programs found:</b> {dbgMeta.count}
              </div>
            )}
            <div className="pt-2 border-t border-gray-800">
              <div className="font-semibold mb-1">Programs (parsed):</div>
              {dbgRows.slice(0, 20).map((r) => (
                <div key={String(r.id)} className="grid grid-cols-1 md:grid-cols-2 gap-1 mb-2">
                  <div>
                    <b>ID:</b> {String(r.id)} • <b>Title:</b> {r.title || "—"}
                  </div>
                  <div className="truncate">
                    <b>Src:</b> {r.resolved || "—"}
                  </div>
                  <div>
                    <b>Raw:</b> {r.raw}
                  </div>
                  <div>
                    <b>Start:</b> {r.startIso || "—"} • <b>End:</b> {r.endIso || "—"}
                  </div>
                  <div>
                    <b>Dur(s):</b> {r.duration} • <b>Active now?</b> {r.isNow ? "YES" : "no"}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
