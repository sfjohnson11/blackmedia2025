// components/TVGuideGrid.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@supabase/supabase-js";

/* ---------- types (match YOUR schema) ---------- */
type ChannelRow = {
  id: number; // channels.id (1..30)
  name: string | null;
  slug?: string | null;
  description?: string | null;
  logo_url: string | null;
  youtube_is_live?: boolean | null;
};

type ProgramRow = {
  id?: number;               // if exists; not required for guide logic
  channel_id: number;        // FK to channels.id
  title: string | null;
  start_time: string;        // UTC string (or DB text)
  duration: number | string; // seconds
};

/* ---------- UTC helpers ---------- */
const addSeconds = (d: Date, secs: number) => new Date(d.getTime() + secs * 1000);

function toUtcDate(val?: string | Date | null): Date | null {
  if (!val) return null;
  if (val instanceof Date) return Number.isNaN(val.getTime()) ? null : val;
  let s = String(val).trim();

  // normalize common shapes → UTC
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(?:\.\d+)?[zZ]$/.test(s))
    s = s.replace(" ", "T").replace(/[zZ]$/, "Z");
  else if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(?:\.\d+)?[+\-]\d{2}:?\d{2}$/.test(s))
    s = s.replace(" ", "T").replace(/([+\-]\d{2})(\d{2})$/, "$1:$2");
  else if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?$/.test(s))
    s += "Z";
  else if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(?:\.\d+)?$/.test(s))
    s = s.replace(" ", "T") + "Z";

  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

function parseDurationSec(v: number | string | null | undefined): number {
  if (typeof v === "number") return Number.isFinite(v) && v > 0 ? v : 0;
  if (v == null) return 0;
  const m = String(v).match(/^\s*(\d+)/);
  if (!m) return 0;
  const n = Number(m[1]);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function fmtTimeLocal(isoish?: string) {
  const d = toUtcDate(isoish);
  if (!d) return "";
  try {
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch { return ""; }
}

/* ---------- component ---------- */
export default function TVGuideGrid({
  lookAheadHours = 6,
  lookBackHours = 6,
}: {
  lookAheadHours?: number;
  lookBackHours?: number;
}) {
  const supabase = useMemo(
    () => createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    ),
    []
  );

  const [channels, setChannels] = useState<ChannelRow[]>([]);
  const [programs, setPrograms] = useState<ProgramRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  // Window bounds (UTC ISO)
  const windowStart = useMemo(() => {
    const d = new Date();
    d.setUTCHours(d.getUTCHours() - lookBackHours, d.getUTCMinutes(), 0, 0);
    return d.toISOString();
  }, [lookBackHours]);

  const windowEnd = useMemo(() => {
    const d = new Date();
    d.setUTCHours(d.getUTCHours() + lookAheadHours, d.getUTCMinutes(), 0, 0);
    return d.toISOString();
  }, [lookAheadHours]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setErr(null); setLoading(true);

        // Channels
        const { data: chRows, error: chErr } = await supabase
          .from("channels")
          .select("id, name, slug, description, logo_url, youtube_is_live")
          .order("id", { ascending: true });
        if (chErr) throw chErr;
        const sortedChannels = [...(chRows || [])].sort((a, b) => a.id - b.id) as ChannelRow[];
        if (cancelled) return;
        setChannels(sortedChannels);

        // Programs — robust 3-step fetch:
        // 1) try ISO window (works if start_time is timestamptz)
        let progRows: ProgramRow[] = [];
        const q1 = await supabase
          .from("programs")
          .select("channel_id, title, start_time, duration")
          .gte("start_time", windowStart)
          .lte("start_time", windowEnd)
          .order("start_time", { ascending: true });

        if (!q1.error && q1.data && q1.data.length) {
          progRows = q1.data as ProgramRow[];
        } else {
          // 2) fallback: pull a modest recent slice and filter client-side
          const q2 = await supabase
            .from("programs")
            .select("channel_id, title, start_time, duration")
            .order("start_time", { ascending: true })
            .limit(2000); // your dataset is small; adjust if needed

          if (!q2.error && q2.data) {
            const all = q2.data as ProgramRow[];
            const ws = new Date(windowStart).getTime();
            const we = new Date(windowEnd).getTime();
            progRows = all.filter((p) => {
              const t = toUtcDate(p.start_time)?.getTime() ?? 0;
              return t >= ws && t <= we;
            });
          }
        }

        if (cancelled) return;
        setPrograms(progRows);
      } catch (e: any) {
        if (!cancelled) setErr(e?.message ?? "Failed to load guide.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [supabase, windowStart, windowEnd]);

  // Group programs per channel, determine Now/Next/Later strictly (no fake fallbacks)
  const now = new Date();
  const rows = useMemo(() => {
    const byCh = new Map<number, ProgramRow[]>();
    for (const p of programs) {
      const list = byCh.get(p.channel_id) ?? [];
      list.push(p);
      byCh.set(p.channel_id, list);
    }
    // Ensure each channel’s list sorted by real time
    for (const [k, list] of byCh.entries()) {
      list.sort((a, b) => {
        const da = toUtcDate(a.start_time)?.getTime() ?? 0;
        const db = toUtcDate(b.start_time)?.getTime() ?? 0;
        return da - db;
      });
      byCh.set(k, list);
    }

    return channels.map((ch) => {
      const list = byCh.get(ch.id) ?? [];
      let current: ProgramRow | undefined;
      const upcoming: ProgramRow[] = [];

      for (const p of list) {
        const st = toUtcDate(p.start_time);
        if (!st) continue;
        const dur = parseDurationSec(p.duration) || 1800;
        const en = addSeconds(st, dur);
        if (!current && now >= st && now < en) current = p;
        if (st > now) upcoming.push(p);
      }

      return { ch, current, upcoming };
    });
  }, [channels, programs, now]);

  return (
    <section className="mb-6">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-xl font-semibold text-white">📺 What’s On (Now &amp; Next)</h2>
        <div className="text-xs text-slate-400">
          Window: {lookBackHours}h back → {lookAheadHours}h ahead
        </div>
      </div>

      {loading ? (
        <div className="text-slate-300">Loading guide…</div>
      ) : err ? (
        <div className="rounded border border-red-500 bg-red-900/30 p-3 text-red-200">{err}</div>
      ) : channels.length === 0 ? (
        <div className="text-slate-400">No channels found.</div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900">
          <div className="min-w-[720px] divide-y divide-slate-800">
            {rows.map(({ ch, current, upcoming }) => {
              return (
                <div key={ch.id} className="flex items-stretch">
                  {/* Channel cell */}
                  <div className="w-56 shrink-0 p-3 border-r border-slate-800">
                    <div className="text-sm text-slate-300">
                      <div className="font-semibold text-white truncate">
                        {ch.name || `Channel ${ch.id}`}
                      </div>
                      <div className="text-xs text-slate-400">ID: {ch.id}</div>
                    </div>
                    <div className="mt-2">
                      <Link
                        href={`/watch/${encodeURIComponent(String(ch.id))}`}
                        className="inline-flex items-center rounded bg-amber-300 text-black hover:bg-amber-200 h-8 px-3 text-xs font-semibold"
                      >
                        Watch
                      </Link>
                    </div>
                  </div>

                  {/* Programs cell */}
                  <div className="flex-1 p-3">
                    <div className="flex gap-3 overflow-x-auto">
                      {/* Now */}
                      <div className="min-w-[260px] rounded-lg border border-slate-700 bg-slate-800 p-3">
                        <div className="text-xs uppercase tracking-wide text-sky-300 mb-1">Now</div>
                        {current ? (
                          <>
                            <div className="text-sm font-semibold text-white truncate">
                              {current.title || "Untitled"}
                            </div>
                            <div className="text-xs text-slate-400">
                              {fmtTimeLocal(current.start_time)}
                              {(() => {
                                const st = toUtcDate(current.start_time);
                                const dur = parseDurationSec(current.duration) || 1800;
                                if (!st) return "";
                                const en = addSeconds(st, dur);
                                return ` – ${en.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
                              })()}
                            </div>
                          </>
                        ) : (
                          <div className="text-sm text-slate-400">Standby / no program right now.</div>
                        )}
                      </div>

                      {/* Next */}
                      <div className="min-w-[260px] rounded-lg border border-slate-700 bg-slate-800 p-3">
                        <div className="text-xs uppercase tracking-wide text-amber-300 mb-1">Next</div>
                        {upcoming[0] ? (
                          <>
                            <div className="text-sm font-semibold text-white truncate">
                              {upcoming[0].title || "Upcoming program"}
                            </div>
                            <div className="text-xs text-slate-400">
                              Starts {fmtTimeLocal(upcoming[0].start_time)}
                            </div>
                          </>
                        ) : (
                          <div className="text-sm text-slate-400">No upcoming program in window.</div>
                        )}
                      </div>

                      {/* Later (show up to 2 more) */}
                      {upcoming.slice(1, 3).map((p) => (
                        <div
                          key={`${p.channel_id}-${p.start_time}`}
                          className="min-w-[240px] rounded-lg border border-slate-700 bg-slate-800 p-3"
                        >
                          <div className="text-xs uppercase tracking-wide text-slate-300 mb-1">
                            Later
                          </div>
                          <div className="text-sm font-semibold text-white truncate">
                            {p.title || "Program"}
                          </div>
                          <div className="text-xs text-slate-400">Starts {fmtTimeLocal(p.start_time)}</div>
                        </div>
                      ))}
                    </div>
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
