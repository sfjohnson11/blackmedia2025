// components/TVGuideGrid.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { getSupabaseClient } from "@/utils/supabase/client";
import { Button } from "@/components/ui/button";

/** ==== Types (aligned to your schema) ==== */
type ChannelRow = {
  id: number | string;
  name?: string | null;
  title?: string | null;
  channel_number?: number | null;
  logo_url?: string | null;
};

type ProgramRow = {
  id: number;
  channel_id: string;           // your schema: text
  title: string | null;
  mp4_url: string | null;
  start_time: string;           // timestamptz (ISO)
  duration: number;             // seconds
};

/** ==== Time window helpers ==== */
// 24h window: today’s midnight -> next midnight (local time)
function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}
function addHours(d: Date, hours: number): Date {
  return new Date(d.getTime() + hours * 3600_000);
}

const PX_PER_MINUTE = 2;     // timeline scale (24h ≈ 2880px wide)
const ROW_HEIGHT = 64;       // px per channel row
const CHANNEL_COL_WIDTH = 220; // px sticky channel column
const NOW_LINE_COLOR = "rgba(255,99,99,0.9)";

/** Compute left/width (px) for a program within the day window */
function computeBlockStyle(
  prog: ProgramRow,
  dayStart: Date,
  dayEnd: Date
): { left: number; width: number } | null {
  const start = new Date(prog.start_time).getTime();
  const dur = prog.duration > 0 ? prog.duration : 1800; // default 30m
  const end = start + dur * 1000;

  const ws = dayStart.getTime();
  const we = dayEnd.getTime();

  // Clip to window
  const clippedStart = Math.max(start, ws);
  const clippedEnd = Math.min(end, we);
  if (clippedEnd <= ws || clippedStart >= we) return null;

  const minutesFromStart = (clippedStart - ws) / 60000;
  const minutesDuration = Math.max(0.5, (clippedEnd - clippedStart) / 60000); // min width

  const left = minutesFromStart * PX_PER_MINUTE;
  const width = minutesDuration * PX_PER_MINUTE;
  return { left, width };
}

function fmtTimeShort(d: Date) {
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function displayChannelName(ch: ChannelRow) {
  return ch.name || ch.title || `Channel ${String(ch.id)}`;
}

export default function TVGuideGrid() {
  const supabase = getSupabaseClient();

  const [channels, setChannels] = useState<ChannelRow[]>([]);
  const [programs, setPrograms] = useState<ProgramRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const dayStart = useMemo(() => startOfToday(), []);
  const dayEnd = useMemo(() => addHours(dayStart, 24), [dayStart]);

  // Build hour ticks for header
  const hourTicks = useMemo(() => {
    const ticks: { t: Date; left: number }[] = [];
    for (let h = 0; h <= 24; h++) {
      const t = addHours(dayStart, h);
      const left = (h * 60) * PX_PER_MINUTE; // minutes from start
      ticks.push({ t, left });
    }
    return ticks;
  }, [dayStart]);

  // Fetch channels + today's programs (single day window)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setErr(null);

        const { data: chRows, error: chErr } = await supabase
          .from("channels")
          .select("*")
          .order("id", { ascending: true });
        if (chErr) throw new Error(chErr.message);

        const { data: progRows, error: prErr } = await supabase
          .from("programs")
          .select("id, channel_id, title, mp4_url, start_time, duration")
          .gte("start_time", dayStart.toISOString())
          .lt("start_time", dayEnd.toISOString())
          .order("start_time", { ascending: true });
        if (prErr) throw new Error(prErr.message);

        if (cancelled) return;
        setChannels(chRows || []);
        setPrograms(progRows || []);
      } catch (e: any) {
        if (!cancelled) setErr(e?.message ?? "Failed to load guide.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [supabase, dayStart, dayEnd]);

  // Auto-scroll to "now"
  const scrollRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const now = Date.now();
    const ws = dayStart.getTime();
    const minutes = (now - ws) / 60000;
    const x = Math.max(0, minutes * PX_PER_MINUTE - 200);
    el.scrollLeft = x;
  }, [loading, dayStart]);

  const timelineWidth = (24 * 60) * PX_PER_MINUTE;

  const nowLeft = useMemo(() => {
    const t = Date.now();
    const ws = dayStart.getTime();
    return Math.max(0, Math.min(timelineWidth, ((t - ws) / 60000) * PX_PER_MINUTE));
  }, [dayStart, timelineWidth]);

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-white">📺 Today’s Guide</h1>
        <div className="text-xs text-slate-400">
          {fmtTimeShort(dayStart)} – {fmtTimeShort(dayEnd)}
        </div>
      </div>

      {loading ? (
        <div className="text-slate-300">Loading…</div>
      ) : err ? (
        <div className="rounded border border-red-500 bg-red-900/30 p-3 text-red-200">{err}</div>
      ) : channels.length === 0 ? (
        <div className="text-slate-400">No channels found.</div>
      ) : (
        <div
          className="relative overflow-x-auto overflow-y-hidden rounded-xl border border-slate-800 bg-slate-900"
          ref={scrollRef}
          style={{ height: ROW_HEIGHT * (channels.length + 1) + 56 }} // + header
        >
          {/* Header: sticky channel column + time ticks */}
          <div className="sticky left-0 top-0 z-30 bg-slate-900/95 backdrop-blur border-b border-slate-800 flex">
            {/* Channel header cell */}
            <div
              className="shrink-0 border-r border-slate-800 flex items-center justify-center text-xs text-slate-300"
              style={{ width: CHANNEL_COL_WIDTH, height: 56 }}
            >
              Channel
            </div>
            {/* Time scale */}
            <div className="relative" style={{ width: timelineWidth, height: 56 }}>
              {hourTicks.map(({ t, left }, i) => (
                <div key={i}>
                  <div
                    className="absolute top-0 h-full border-l border-slate-800/60"
                    style={{ left }}
                  />
                  <div
                    className="absolute top-1 text-[11px] text-slate-300"
                    style={{ left: left + 4 }}
                  >
                    {t.toLocaleTimeString([], { hour: "2-digit" })}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Now line */}
          <div
            className="absolute top-0 z-20"
            style={{
              left: CHANNEL_COL_WIDTH + nowLeft,
              width: 2,
              height: ROW_HEIGHT * (channels.length + 1) + 56,
              background: NOW_LINE_COLOR,
            }}
          />

          {/* Rows */}
          <div className="relative">
            {channels.map((ch, rowIdx) => {
              const top = 56 + rowIdx * ROW_HEIGHT;
              const chPrograms = programs.filter(p => p.channel_id === String(ch.id));

              return (
                <div key={String(ch.id)} className="absolute left-0 right-0" style={{ top, height: ROW_HEIGHT }}>
                  {/* Sticky left channel cell */}
                  <div
                    className="sticky left-0 z-10 h-full border-r border-slate-800 bg-slate-900/95 backdrop-blur px-3 flex items-center gap-3"
                    style={{ width: CHANNEL_COL_WIDTH }}
                  >
                    {ch.logo_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={ch.logo_url}
                        alt={displayChannelName(ch)}
                        className="h-8 w-8 rounded object-cover"
                      />
                    ) : (
                      <div className="h-8 w-8 rounded bg-slate-700" />
                    )}
                    <div className="min-w-0">
                      <div className="text-white text-sm truncate">{displayChannelName(ch)}</div>
                      <div className="text-[11px] text-slate-400 truncate">ID: {String(ch.id)}</div>
                    </div>
                    <Link href={`/watch/${encodeURIComponent(String(ch.id))}`} className="ml-auto">
                      <Button className="h-7 px-2 text-xs bg-yellow-500 text-black hover:bg-yellow-400">
                        Watch
                      </Button>
                    </Link>
                  </div>

                  {/* Timeline lane */}
                  <div
                    className="absolute"
                    style={{ left: CHANNEL_COL_WIDTH, width: timelineWidth, height: ROW_HEIGHT }}
                  >
                    {/* Background hour guides */}
                    {hourTicks.map(({ left }, i) => (
                      <div
                        key={i}
                        className="absolute top-0 h-full border-l border-slate-800/40"
                        style={{ left }}
                      />
                    ))}

                    {/* Program blocks */}
                    {chPrograms.map((p) => {
                      const pos = computeBlockStyle(p, dayStart, dayEnd);
                      if (!pos) return null;
                      const endIso = new Date(
                        new Date(p.start_time).getTime() + (p.duration > 0 ? p.duration : 1800) * 1000
                      ).toISOString();

                      return (
                        <div
                          key={p.id}
                          className="absolute rounded-lg border border-slate-700 bg-slate-800/90 hover:bg-slate-700/90 transition-colors"
                          style={{ left: pos.left, width: pos.width, top: 8, height: ROW_HEIGHT - 16 }}
                          title={`${p.title ?? "Program"}\n${fmtTimeShort(new Date(p.start_time))} – ${fmtTimeShort(new Date(endIso))}`}
                        >
                          <div className="px-3 py-2 h-full flex flex-col justify-center">
                            <div className="text-sm font-semibold text-white truncate">
                              {p.title ?? "Untitled"}
                            </div>
                            <div className="text-[11px] text-slate-300">
                              {fmtTimeShort(new Date(p.start_time))} – {fmtTimeShort(new Date(endIso))}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}
