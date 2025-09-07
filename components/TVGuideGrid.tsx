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
  id?: number;
  channel_id: number;        // FK to channels.id
  title: string | null;
  start_time: string;        // UTC string or DB text
  duration: number | string; // seconds
};

/* ---------- time helpers (STRICT UTC) ---------- */
const addSeconds = (d: Date, secs: number) => new Date(d.getTime() + secs * 1000);

function toUtcDate(val?: string | Date | null): Date | null {
  if (!val) return null;
  if (val instanceof Date) return Number.isNaN(val.getTime()) ? null : val;
  const s = String(val).trim();

  // If already has timezone (Z or ±HH[:MM]) → normalize and use native.
  if (/[zZ]$/.test(s) || /[+\-]\d{2}:?\d{2}$/.test(s)) {
    const norm = s
      .replace(" ", "T")
      .replace(/([+\-]\d{2})(\d{2})$/, "$1:$2") // +0500 -> +05:00
      .replace(/[zZ]$/, "Z");
    const d = new Date(norm);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  // NAIVE timestamp (no TZ) → interpret as **UTC** explicitly.
  const m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/.exec(s);
  if (m) {
    const [, yy, MM, dd, hh, mm, ss] = m;
    const d = new Date(Date.UTC(+yy, +MM - 1, +dd, +hh, +mm, +ss));
    return Number.isNaN(d.getTime()) ? null : d;
  }

  return null;
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
  const [byChannel, setByChannel] = useState<Map<number, ProgramRow[]>>(new Map());
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  // Window bounds (UTC ISO)
  const windowStartISO = useMemo(() => {
    const d = new Date();
    d.setUTCMinutes(0, 0, 0);
    d.setUTCHours(d.getUTCHours() - lookBackHours);
    return d.toISOString();
  }, [lookBackHours]);

  const windowEndISO = useMemo(() => {
    const d = new Date();
    d.setUTCMinutes(0, 0, 0);
    d.setUTCHours(d.getUTCHours() + lookAheadHours);
    return d.toISOString();
  }, [lookAheadHours]);

  // Fallback DB-text bounds ("YYYY-MM-DD HH:mm:ss") for text columns
  const toDbText = (d: Date) => {
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`;
  };
  const windowStartDB = useMemo(() => toDbText(new Date(windowStartISO)), [windowStartISO]);
  const windowEndDB   = useMemo(() => toDbText(new Date(windowEndISO)),   [windowEndISO]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setErr(null);
        setLoading(true);

        // 1) channels (numeric sort)
        const { data: chRows, error: chErr } = await supabase
          .from("channels")
          .select("id, name, slug, description, logo_url, youtube_is_live")
          .order("id", { ascending: true });
        if (chErr) throw chErr;

        const sorted = [...(chRows || [])].sort((a, b) => a.id - b.id) as ChannelRow[];
        if (cancelled) return;
        setChannels(sorted);

        // 2) programs per channel (RLS-safe, strict UTC parsing)
        const map = new Map<number, ProgramRow[]>();
        for (const ch of sorted) {
          // try direct window
          let rows: ProgramRow[] = [];
          const q1 = await supabase
            .from("programs")
            .select("channel_id, title, start_time, duration")
            .eq("channel_id", ch.id)
            .gte("start_time", windowStartISO)
            .lte("start_time", windowEndISO)
            .order("start_time", { ascending: true });

          if (!q1.error && q1.data && q1.data.length) {
            rows = q1.data as ProgramRow[];
          } else {
            // fallback: DB-text comparison (if column is text)
            const q2 = await supabase
              .from("programs")
              .select("channel_id, title, start_time, duration")
              .eq("channel_id", ch.id)
              .gte("start_time", windowStartDB)
              .lte("start_time", windowEndDB)
              .order("start_time", { ascending: true });

            if (!q2.error && q2.data && q2.data.length) {
              rows = q2.data as ProgramRow[];
            } else {
              // last resort: pull a slice for that channel and filter client-side
              const q3 = await supabase
                .from("programs")
                .select("channel_id, title, start_time, duration")
                .eq("channel_id", ch.id)
                .order("start_time", { ascending: true })
                .limit(1000);

              if (!q3.error && q3.data) {
                const all = q3.data as ProgramRow[];
                const ws = new Date(windowStartISO).getTime();
                const we = new Date(windowEndISO).getTime();
                rows = all.filter((p) => {
                  const t = toUtcDate(p.start_time)?.getTime() ?? 0;
                  return t >= ws && t <= we;
                });
              }
            }
          }

          // ensure sorted by actual time
          rows.sort((a, b) => {
            const da = toUtcDate(a.start_time)?.getTime() ?? 0;
            const db = toUtcDate(b.start_time)?.getTime() ?? 0;
            return da - db;
          });

          map.set(ch.id, rows);
        }

        if (cancelled) return;
        setByChannel(map);
      } catch (e: any) {
        if (!cancelled) setErr(e?.message ?? "Failed to load guide.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [supabase, windowStartISO, windowEndISO, windowStartDB, windowEndDB]);

  const now = new Date();

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
            {channels.map((ch) => {
              const list = byChannel.get(ch.id) || [];

              // find current & upcoming strictly
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
                          <div className="text-sm text-slate-400">
                            Standby / no program right now.
                          </div>
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

                      {/* Later (up to 2 more) */}
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
                          <div className="text-xs text-slate-400">
                            Starts {fmtTimeLocal(p.start_time)}
                          </div>
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
