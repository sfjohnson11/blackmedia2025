// app/watch/[channelId]/page.tsx
"use client";

import React, { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  supabase,
  fetchChannelById,
  fetchProgramsForChannel,
  getCandidateUrlsForProgram,
  toUtcDate,
  addSeconds,
  parseDurationSec,
  type Channel,
  type Program,
} from "@/lib/supabase";

const CH21 = 21;

function standbyUrlForChannel(channelId: number) {
  const root = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/+$/, "");
  // your standby file name:
  return `${root}/storage/v1/object/public/channel${channelId}/standby_blacktruthtv.mp4`;
}

export default function WatchPage({ params }: { params: { channelId: string } }) {
  const search = useSearchParams();
  const srcOverride = search?.get("src") || null;
  const debug = search?.get("debug") === "1";

  const [channelId, setChannelId] = useState<number | null>(null);
  const [channel, setChannel] = useState<Channel | null>(null);
  const [currentProgram, setCurrentProgram] = useState<Program | null>(null);
  const [upcoming, setUpcoming] = useState<Program[]>([]);
  const [videoSrcs, setVideoSrcs] = useState<string[]>([]);
  const [title, setTitle] = useState<string>("Loading…");
  const [err, setErr] = useState<string | null>(null);
  const [dbg, setDbg] = useState<any>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // normalize channel id
  useEffect(() => {
    const s = String(params.channelId || "").trim();
    if (!/^\d+$/.test(s)) {
      setErr(`Channel id must be numeric (got "${s}")`);
      setChannelId(null);
      return;
    }
    const n = Number(s.replace(/^0+/, "") || "0");
    setChannelId(Number.isFinite(n) ? n : null);
  }, [params.channelId]);

  useEffect(() => {
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  const pickActive = (list: Program[]) => {
    const now = new Date();
    let active: Program | null = null;
    for (const p of list) {
      const st = toUtcDate(p.start_time);
      if (!st) continue;
      const dur = Math.max(60, parseDurationSec(p.duration));
      const en = addSeconds(st, dur);
      if (now >= st && now < en) { active = p; break; }
    }
    const nexts = list
      .filter(p => {
        const st = toUtcDate(p.start_time);
        return !!st && st > now;
      })
      .slice(0, 4);
    return { active, nexts };
  };

  async function load(chId: number) {
    try {
      setErr(null);
      setDbg(null);

      const ch = await fetchChannelById(supabase, chId);
      if (!ch) throw new Error(`Channel not found (id=${chId})`);
      setChannel(ch);

      const programs = await fetchProgramsForChannel(supabase, chId);
      const { active, nexts } = pickActive(programs);

      // CH21 special: YouTube live if configured and no override
      if (!srcOverride && chId === CH21 && (ch.youtube_channel_id || "").trim()) {
        const yt = `https://www.youtube.com/embed/live_stream?channel=${encodeURIComponent(
          (ch.youtube_channel_id || "").trim()
        )}&autoplay=1`;
        setCurrentProgram(null);
        setUpcoming(nexts);
        setVideoSrcs([yt]);
        setTitle("YouTube Live");
        setDbg({ mode: "youtube", yt, nexts: nexts.map(n => ({ t: n.title, st: n.start_time })) });
        return;
      }

      if (active) {
        const candidates = getCandidateUrlsForProgram(active);
        const finalList = srcOverride ? [srcOverride] : (candidates.length ? candidates : [standbyUrlForChannel(chId)]);
        setCurrentProgram(active);
        setUpcoming(nexts);
        setVideoSrcs(finalList);
        setTitle(active.title || "Now Playing");
        setDbg({
          mode: "program",
          now: new Date().toISOString(),
          current: {
            title: active.title,
            start_time: active.start_time,
            duration_raw: active.duration,
            duration_sec: parseDurationSec(active.duration),
            candidates: finalList,
          },
          nexts: nexts.map(n => ({ t: n.title, st: n.start_time })),
        });
      } else {
        // standby
        const standby = standbyUrlForChannel(chId);
        const finalList = srcOverride ? [srcOverride] : [standby];
        setCurrentProgram(null);
        setUpcoming(nexts);
        setVideoSrcs(finalList);
        setTitle("Standby Programming");
        setDbg({
          mode: "standby",
          now: new Date().toISOString(),
          standby: finalList[0],
          nexts: nexts.map(n => ({ t: n.title, st: n.start_time })),
        });
      }

      // Poll while on standby to switch when a program window opens
      if (!active) {
        if (pollRef.current) clearInterval(pollRef.current);
        pollRef.current = setInterval(async () => {
          try {
            const fresh = await fetchProgramsForChannel(supabase, chId);
            const { active: nowActive } = pickActive(fresh);
            if (nowActive) {
              if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
              await load(chId);
            }
          } catch {
            /* ignore */
          }
        }, 30000);
      }
    } catch (e: any) {
      setErr(e?.message || "Failed to load channel.");
    }
  }

  useEffect(() => {
    if (channelId == null) return;
    load(channelId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channelId, srcOverride]);

  const isYouTube = videoSrcs.length === 1 && videoSrcs[0].includes("youtube.com/embed");

  return (
    <div className="bg-black min-h-screen text-white">
      {debug && dbg ? (
        <pre className="text-[10px] leading-tight p-2 bg-black/60 text-green-300 overflow-x-auto">
{JSON.stringify(dbg, null, 2)}
        </pre>
      ) : null}

      <div className="w-full aspect-video bg-black grid place-items-center">
        {err ? (
          <p className="text-red-400 text-sm px-4 text-center">Error: {err}</p>
        ) : isYouTube ? (
          <iframe
            title="YouTube Live"
            className="w-full h-full"
            allow="autoplay; encrypted-media; picture-in-picture"
            src={videoSrcs[0]}
          />
        ) : videoSrcs.length > 0 ? (
          <video
            key={videoSrcs.join("|")}
            className="w-full h-full"
            poster={channel?.logo_url || undefined}
            autoPlay
            muted={false}      // SOUND ON so your standby music plays
            playsInline
            controls
            loop={/standby/i.test(title)}
            onEnded={() => {
              if (channelId != null) load(channelId);
            }}
            onError={() => {
              if (channelId != null) {
                const s = standbyUrlForChannel(channelId);
                if (videoSrcs[0] !== s) setVideoSrcs([s]);
              }
            }}
          >
            {/* Try multiple source candidates so the browser can pick a working one */}
            {videoSrcs.map((src, i) => (
              <source key={`${i}-${src}`} src={src} type="video/mp4" />
            ))}
          </video>
        ) : (
          <div className="text-white/70 text-sm">Loading…</div>
        )}
      </div>

      <div className="p-4 space-y-1 text-sm">
        <div className="font-semibold">{title}</div>
        {upcoming.length > 0 && (
          <div className="text-white/60">
            Next: {upcoming[0].title || "Upcoming"}{" "}
            {upcoming[0].start_time
              ? `— ${toUtcDate(upcoming[0].start_time)?.toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}`
              : ""}
          </div>
        )}
      </div>
    </div>
  );
}
