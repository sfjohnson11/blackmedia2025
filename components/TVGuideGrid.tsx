// components/TVGuideGrid.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";

type ChannelRow = {
  id: number;
  name?: string | null;
  slug?: string | null;
  description?: string | null;
  logo_url?: string | null;
  image_url?: string | null;
  youtube_channel_id?: string | null;
  youtube_is_live?: boolean | null;
  is_active?: boolean | null;
};

type ProgramRow = {
  id: number;
  channel_id: number;     // INTEGER
  title: string | null;
  mp4_url: string | null;
  start_time: string;     // ISO
  duration: number;       // SECONDS
};

const PX_PER_MINUTE = 2;
const ROW_HEIGHT = 64;
const CHANNEL_COL_WIDTH = 220;
const NOW_LINE_COLOR = "rgba(255,99,99,0.9)";

const hoursFromNow = (h: number) => new Date(Date.now() + h * 3600_000);
const fmtHM = (d: Date) => d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
const nameOf = (ch: ChannelRow) => ch.name || `Channel ${ch.id}`;
const artOf  = (ch: ChannelRow) => ch.logo_url || ch.image_url || null;

function computeBlockStyle(p: ProgramRow, winStart: Date, winEnd: Date) {
  const start = new Date(p.start_time).getTime();
  const end   = start + Math.max(1, p.duration) * 1000;
  const ws = winStart.getTime(), we = winEnd.getTime();
  const cs = Math.max(start, ws), ce = Math.min(end, we);
  if (ce <= ws || cs >= we) return null;
  const left  = ((cs - ws) / 60000) * PX_PER_MINUTE;
  const width = Math.max(0.5, ((ce - cs) / 60000) * PX_PER_MINUTE);
  return { left, width };
}

export default function TVGuideGrid() {
  const [channels, setChannels] = useState<ChannelRow[]>([]);
  const [programs, setPrograms] = useState<ProgramRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  // Rolling window: 6h back → 72h ahead
  const windowStart = useMemo(() => hoursFromNow(-6), []);
  const windowEnd   = useMemo(() => hoursFromNow(+72), []);

  // Hour ticks across the rolling window
  const ticks = useMemo(() => {
    const hours = Math.ceil((windowEnd.getTime() - windowStart.getTime()) / 3600_000);
    return Array.from({ length: hours + 1 }, (_, h) => ({
      left: (h * 60) * PX_PER_MINUTE,
      label: new Date(windowStart.getTime() + h * 3600_000).toLocaleTimeString([], { hour: "2-digit" }),
    }));
  }, [windowStart, windowEnd]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true); setErr(null);

        // Channels: exact schema, active only
        const { data: chRows, error: chErr } = await supabase
          .from("channels")
          .select("id, name, slug, description, logo_url, image_url, youtube_channel_id, youtube_is_live, is_active")
          .eq("is_active", true);
        if (chErr) throw new Error(chErr.message);

        // Programs within rolling window
        const { data: progRows, error: prErr } = await supabase
          .from("programs")
          .select("id, channel_id, title, mp4_url, start_time, duration")
          .gte("start_time", windowStart.toISOString())
          .lt("start_time", windowEnd.toISOString())
          .order("start_time", { ascending: true });
        if (prErr) throw new Error(prErr.message);

        if (cancelled) return;

        // Stable order: Name A→Z, then ID
        const ordered = (chRows ?? [])
          .slice()
          .sort((a: any, b: any) => {
            const an = (a.name || "").localeCompare(b.name || "");
            if (an !== 0) return an;
            return a.id - b.id;
          });

        setChannels(ordered as ChannelRow[]);
        setPrograms((progRows ?? []) as ProgramRow[]);
      } catch (e: any) {
        if (!cancelled) setErr(e.message ?? "Failed to load guide.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [windowStart, windowEnd]);

  // group by channel
  const byChannel = useMemo(() => {
    const map = new Map<number, ProgramRow[]>();
    for (const p of programs) {
      if (!map.has(p.channel_id)) map.set(p.channel_id, []);
      map.get(p.channel_id)!.push(p);
    }
    return map;
  }, [programs]);

  // auto-scroll to "now" (6 hours into the window)
  const scrollRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!scrollRef.current) return;
    const x = Math.max(0, (6 * 60) * PX_PER_MINUTE - 200);
    scrollRef.current.scrollLeft = x;
  }, [loading]);

  const totalWidth = useMemo(
    () => Math.ceil((windowEnd.getTime() - windowStart.getTime()) / 60000) * PX_PER_MINUTE,
    [windowStart, windowEnd]
  );
  const nowLeft = useMemo(() => {
    const ms = Date.now() - windowStart.getTime();
    return Math.max(0, Math.min(totalWidth, (ms / 60000) * PX_PER_MINUTE));
  }, [windowStart, totalWidth]);

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-white">📺 Schedule (Last 6h → Next 72h)</h1>
        <div className="text-xs text-slate-400">
          Window: {windowStart.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} –{" "}
          {windowEnd.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
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
          ref={scrollRef}
          className="relative overflow-x-auto overflow-y-hidden rounded-xl border border-slate-800 bg-slate-900"
          style={{ height: ROW_HEIGHT * (channels.length + 1) + 56 }}
        >
          {/* header */}
          <div className="sticky left-0 top-0 z-30 bg-slate-900/95 backdrop-blur border-b border-slate-800 flex">
            <div
              className="shrink-0 border-r border-slate-800 flex items-center justify-center text-xs text-slate-300"
              style={{ width: CHANNEL_COL_WIDTH, height: 56 }}
            >
              Channel
            </div>
            <div className="relative" style={{ width: totalWidth, height: 56 }}>
              {ticks.map((t, i) => (
                <div key={i}>
                  <div className="absolute top-0 h-full border-l border-slate-800/60" style={{ left: t.left }} />
                  <div className="absolute top-1 text-[11px] text-slate-300" style={{ left: t.left + 4 }}>
                    {t.label}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* now line */}
          <div
            className="absolute top-0 z-20"
            style={{
              left: CHANNEL_COL_WIDTH + nowLeft,
              width: 2,
              height: ROW_HEIGHT * (channels.length + 1) + 56,
              background: NOW_LINE_COLOR,
            }}
          />

          {/* rows */}
          <div className="relative">
            {channels.map((ch, row) => {
              const top = 56 + row * ROW_HEIGHT;
              const progs = byChannel.get(ch.id) ?? [];
              return (
                <div key={ch.id} className="absolute left-0 right-0" style={{ top, height: ROW_HEIGHT }}>
                  {/* sticky channel cell */}
                  <div
                    className="sticky left-0 z-10 h-full border-r border-slate-800 bg-slate-900/95 backdrop-blur px-3 flex items-center gap-3"
                    style={{ width: CHANNEL_COL_WIDTH }}
                  >
                    {artOf(ch) ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={artOf(ch)!} alt={nameOf(ch)} className="h-8 w-8 rounded object-cover" />
                    ) : (
                      <div className="h-8 w-8 rounded bg-slate-700" />
                    )}
                    <div className="min-w-0">
                      <div className="text-white text-sm truncate">{nameOf(ch)}</div>
                      <div className="text-[11px] text-slate-400 truncate">ID: {ch.id}</div>
                    </div>
                    <Link href={`/watch/${encodeURIComponent(String(ch.id))}`} className="ml-auto">
                      <Button className="h-7 px-2 text-xs bg-yellow-500 text-black hover:bg-yellow-400">Watch</Button>
                    </Link>
                  </div>

                  {/* timeline lane */}
                  <div className="absolute" style={{ left: CHANNEL_COL_WIDTH, width: totalWidth, height: ROW_HEIGHT }}>
                    {ticks.map((t, i) => (
                      <div key={i} className="absolute top-0 h-full border-l border-slate-800/40" style={{ left: t.left }} />
                    ))}
                    {progs.map((p) => {
                      const pos = computeBlockStyle(p, windowStart, windowEnd);
                      if (!pos) return null;
                      const endMs = new Date(p.start_time).getTime() + Math.max(1, p.duration) * 1000;
                      return (
                        <div
                          key={p.id}
                          className="absolute rounded-lg border border-slate-700 bg-slate-800/90 hover:bg-slate-700/90 transition-colors"
                          style={{ left: pos.left, width: pos.width, top: 8, height: ROW_HEIGHT - 16 }}
                          title={`${p.title ?? "Program"}\n${fmtHM(new Date(p.start_time))} – ${fmtHM(new Date(endMs))}`}
                        >
                          <div className="px-3 py-2 h-full flex flex-col justify-center">
                            <div className="text-sm font-semibold text-white truncate">{p.title ?? "Untitled"}</div>
                            <div className="text-[11px] text-slate-300">
                              {fmtHM(new Date(p.start_time))} – {fmtHM(new Date(endMs))}
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
