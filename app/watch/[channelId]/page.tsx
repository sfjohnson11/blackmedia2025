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
  parseDurationSec,       // strict seconds-only now
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

const num = (v: unknown): number | null => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

const coerceChanLoose = (v: string | number | null | undefined): number | null => {
  if (v == null) return null;
  if (typeof v === "number") return num(v);
  const m = String(v).trim().match(/-?\d+/);
  if (!m) return null;
  const n = Number(m[0]);
  return Number.isFinite(n) ? n : null;
};

const belongsToChannel = (p: Program, channelNum: number, rawId: string | number): boolean => {
  const cid = coerceChanLoose(p.channel_id);
  if (cid === channelNum) return true;
  if (String(p.channel_id).trim() === String(rawId).trim()) return true;

  const u = (p.mp4_url || "").toLowerCase().trim();
  const needle = `channel${channelNum}`;
  return (
    u.startsWith(`${needle}/`) ||
    u.startsWith(`${needle}:`) ||
    u.includes(`/${needle}/`) ||
    u.startsWith(`storage://${needle}/`)
  );
};

function standbyProgram(channelId: number): Program {
  return {
    id: STANDBY_PLACEHOLDER_ID,
    channel_id: channelId,
    title: "Standby Programming",
    mp4_url: `channel${channelId}/${STANDBY_FILE}`,
    start_time: nowUtc().toISOString(),
    duration: 300,
  } as any;
}

export default function WatchPage() {
  const { channelId } = useParams<{ channelId: string }>();
  const search = useSearchParams();
  const debug = (search?.get("debug") ?? "0") === "1";

  const param = useMemo(() => String(channelId), [channelId]);
  const supabase = useMemo(
    () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!),
    []
  );

  const [channel, setChannel]           = useState<Channel | null>(null);
  const [channelNum, setChannelNum]     = useState<number | null>(null);
  const [active, setActive]             = useState<Program | null>(null);
  const [nextUp, setNextUp]             = useState<Program | null>(null);
  const [videoSrc, setVideoSrc]         = useState<string | undefined>(undefined);
  const [usingStandby, setUsingStandby] = useState(false);
  const [loading, setLoading]           = useState(true);
  const [err, setErr]                   = useState<string | null>(null);

  const posterSrc = channel?.logo_url || undefined;
  const videoRef  = useRef<HTMLVideoElement | null>(null);
  const lastSrcRef = useRef<string | undefined>(undefined);
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const [dbgRows, setDbgRows] = useState<
    { id: string | number; title: string | null; raw: string; startIso?: string; endIso?: string; duration: number; isNow: boolean; resolved?: string }[]
  >([]);
  const [dbgMeta, setDbgMeta] = useState<{ primaryCount: number; fallbackCount: number; window: string } | null>(null);

  useEffect(() => () => {
    if (refreshTimer.current) clearTimeout(refreshTimer.current);
    if (pollTimer.current) clearInterval(pollTimer.current);
  }, []);

  const scheduleRefreshAt = useCallback((when: Date | null) => {
    if (refreshTimer.current) clearTimeout(refreshTimer.current);
    if (!when) return;
    const ms = when.getTime() - Date.now() + 1000;
    const delay = Math.max(ms, MIN_RECHECK_MS);
    refreshTimer.current = setTimeout(() => { void pickAndPlay(false); }, delay);
  }, []);

  const pickActive = (list: Program[], now: Date): Program | null => {
    let candidate: Program | null = null;
    for (const p of list) {
      const st = toUtcDate(p.start_time); if (!st) continue;
      // STRICT seconds
      const durSec = Math.max(60, parseDurationSec(p.duration) || 0); // min 60s for safety
      const en = addSeconds(st, durSec);
      if (now >= st && now < en) candidate = p;
    }
    return candidate;
  };

  const fetchProgramsForChannel = useCallback(async (chNum: number, rawId: string | number): Promise<Program[]> => {
    const sel = "id, channel_id, title, mp4_url, start_time, duration";

    // Try precise keys first (INT/TEXT/slug safety)
    const keys = Array.from(new Set([ chNum, String(chNum), rawId, String(rawId) ]));

    const results = await Promise.all(
      keys.map((k) => supabase.from("programs").select(sel).eq("channel_id", k).order("start_time", { ascending: true }))
    );

    let combined: Program[] = [];
    for (const r of results) if (r.data) combined.push(...(r.data as any));

    // de-dup and sort
    const seen = new Set<string>();
    combined = combined.filter((r) => {
      const key = `${String(r.id)}|${r.start_time}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }).sort((a, b) => {
      const as = toUtcDate(a.start_time)?.getTime() ?? 0;
      const bs = toUtcDate(b.start_time)?.getTime() ?? 0;
      return as - bs;
    });

    if (combined.length > 0) {
      setDbgMeta({ primaryCount: combined.length, fallbackCount: 0, window: "primary-only" });
      return combined;
    }

    // Fallback: 48h window then filter by channel number or mp4_url bucket hints
    const start = new Date(Date.now() - 24 * 3600 * 1000);
    const end   = new Date(Date.now() + 24 * 3600 * 1000);
    const { data: win, error: winErr } = await supabase
      .from("programs")
      .select(sel)
      .gte("start_time", start.toISOString())
      .lte("start_time", end.toISOString())
      .order("start_time", { ascending: true });

    if (winErr) throw new Error(winErr.message);

    const filtered = (win || []).filter((r: any) => belongsToChannel(r as Program, chNum, rawId)) as Program[];

    filtered.sort((a, b) => {
      const as = toUtcDate(a.start_time)?.getTime() ?? 0;
      const bs = toUtcDate(b.start_time)?.getTime() ?? 0;
      return as - bs;
    });

    setDbgMeta({ primaryCount: 0, fallbackCount: filtered.length, window: `${start.toISOString()} .. ${end.toISOString()}` });
    return filtered;
  }, [supabase]);

  const pickAndPlay = useCallback(async (showLoading = true) => {
    try {
      if (showLoading) setLoading(true);
      setErr(null);

      // Resolve channel by id OR slug
      const ch = await fetchChannelDetails(param);
      if (!ch) throw new Error("Channel not found.");
      setChannel(ch as Channel);

      const chNum = num((ch as any).id);
      setChannelNum(chNum);

      // CH21 → YouTube embed
      if (chNum === CH21 && (ch as any)?.youtube_channel_id && String((ch as any).youtube_channel_id).trim()) {
        setActive(null); setNextUp(null); setVideoSrc(undefined); setUsingStandby(false);
        setDbgRows([]);
        if (showLoading) setLoading(false);
        return;
      }

      const programs = await fetchProgramsForChannel(chNum ?? -1, (ch as any).id);
      const now = nowUtc();

      const rows = programs.map(pr => {
        const st = toUtcDate(pr.start_time);
        const dur = Math.max(60, parseDurationSec(pr.duration) || 0); // strict seconds
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
        const boundary = nxt && (toUtcDate(nxt.start_time) as Date) < en
          ? (toUtcDate(nxt.start_time) as Date)
          : en;
        if (boundary) scheduleRefreshAt(boundary);
      } else {
        const sb = standbyProgram(chNum ?? 0);
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
  }, [param, fetchProgramsForChannel]);

  // initial + soft polling (visible tab only)
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
          if (!usingStandby && channelNum != null) {
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
            {dbgMeta && (
              <div>
                <b>Primary rows:</b> {dbgMeta.primaryCount} • <b>Fallback rows:</b> {dbgMeta.fallbackCount} • <b>Window:</b> {dbgMeta.window}
              </div>
            )}
            <div className="pt-2 border-t border-gray-800">
              <div className="font-semibold mb-1">Programs (parsed):</div>
              {dbgRows.slice(0, 24).map(r => (
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
