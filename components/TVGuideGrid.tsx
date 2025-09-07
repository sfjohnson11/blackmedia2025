// components/TVGuideGrid.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@supabase/supabase-js";

/* ---------- types (match YOUR schema) ---------- */
type ChannelRow = {
  id: number;
  name: string | null;
  slug?: string | null;
  description?: string | null;
  logo_url: string | null;
  youtube_is_live?: boolean | null;
  youtube_channel_id?: string | null;
};

type ProgramRow = {
  channel_id: number;
  title: string | null;
  start_time: string;        // UTC-like string
  duration: number | string; // seconds
};

/* ---------- time helpers (UTC parse + seconds) ---------- */
const nowUtc = () => new Date(new Date().toISOString());
const DRIFT_S = 5; // tiny tolerance for clock drift

function toUtcDate(val?: string | Date | null): Date | null {
  if (!val) return null;
  if (val instanceof Date) return Number.isNaN(val.getTime()) ? null : val;
  let s = String(val).trim();
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(?:\.\d+)?[zZ]$/.test(s)) s = s.replace(" ", "T").replace(/[zZ]$/, "Z");
  else if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(?:\.\d+)?[+\-]\d{2}:?\d{2}$/.test(s)) s = s.replace(" ", "T").replace(/([+\-]\d{2})(\d{2})$/, "$1:$2");
  else if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?$/.test(s)) s += "Z";
  else if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(?:\.\d+)?$/.test(s)) s = s.replace(" ", "T") + "Z";
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

function parseDurationSec(v: number | string | null | undefined): number {
  if (typeof v === "number") return Number.isFinite(v) && v > 0 ? Math.round(v) : 0;
  if (v == null) return 0;
  const m = String(v).match(/^\s*(\d+)/);
  if (!m) return 0;
  const n = Number(m[1]);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : 0;
}

function addSeconds(d: Date, secs: number) {
  return new Date(d.getTime() + secs * 1000);
}

function fmtTimeLocal(isoish?: string) {
  const d = toUtcDate(isoish);
  if (!d) return "";
  try {
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", timeZoneName: "short" });
  } catch {
    return "";
  }
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
    () =>
      createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      ),
    []
  );

  const [channels, setChannels] = useState<ChannelRow[]>([]);
  const [programs, setPrograms] = useState<ProgramRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  // Window (UTC)
  const now = nowUtc();
  const winStart = new Date(now.getTime() - lookBackHours * 3600_000);
  const winEnd = new Date(now.getTime() + lookAheadHours * 3600_000);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setErr(null);
        setLoading(true);

        // Channels
        const { data: chRows, error: chErr } = await supabase
          .from("channels")
          .select("id, name, slug, description, logo_url, youtube_is_live, youtube_channel_id")
          .order("id", { ascending: true });
        if (chErr) throw chErr;

        // DEBUG: confirm channels read
        console.log("[GUIDE] channels len =", (chRows || []).length);

        // Try to fetch server-filtered slice (wide back buffer to catch overlaps)
        const backBufferHours = 48;
        const sliceStartISO = new Date(winStart.getTime() - backBufferHours * 3600_000).toISOString();
        const { data: prA, error: prErrA } = await supabase
          .from("programs")
          .select("channel_id, title, start_time, duration")
          .gte("start_time", sliceStartISO)
          .lte("start_time", winEnd.toISOString())
          .order("start_time", { ascending: true });

        // DEBUG: show raw server-slice count
        if (prErrA) console.warn("[GUIDE] programs slice error:", prErrA.message);
        console.log("[GUIDE] programs len (slice) =", (prA || []).length);

        let rawPrograms: ProgramRow[] | null = prA as ProgramRow[] | null;

        // If slice empty or error, do a no-filter probe (RLS/env or TEXT column safety)
        if (!rawPrograms || rawPrograms.length === 0 || prErrA) {
          const probe = await supabase
            .from("programs")
            .select("channel_id, title, start_time, duration")
            .order("start_time", { ascending: true })
            .limit(1000);
          console.log(
            "[GUIDE] probe programs len =",
            (probe.data || []).length,
            "err:",
            probe.error?.message
          );
          if (probe.error) throw probe.error;
          rawPrograms = (probe.data || []) as ProgramRow[];
        }

        if (cancelled) return;

        // Overlap filter in JS (robust even if start_time is TEXT)
        const overlapped: ProgramRow[] = [];
        for (const p of rawPrograms) {
          const st = toUtcDate(p.start_time);
          const dur = parseDurationSec(p.duration);
          if (!st || dur <= 0) continue;
          const en = addSeconds(st, dur);
          if (st < winEnd && en > winStart) overlapped.push(p);
        }

        // Sort channels numeric
        const sortedChannels = [...(chRows || [])].sort((a, b) => a.id - b.id);
        setChannels(sortedChannels as ChannelRow[]);
        setPrograms(overlapped);
      } catch (e: any) {
        if (!cancelled) setErr(e?.message ?? "Failed to load guide.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [supabase, lookAheadHours, lookBackHours]); // window recomputes from these

  // Group by channel, sorted by start_time
  const progsByChannel = useMemo(() => {
    const map = new Map<number, ProgramRow[]>();
    const sorted = [...programs].sort((a, b) => {
      const da = toUtcDate(a.start_time)?.getTime() ?? 0;
      const db = toUtcDate(b.start_time)?.getTime() ?? 0;
      return da - db;
    });
    for (const p of sorted) {
      const key = Number(p.channel_id);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(p);
    }
    return map;
  }, [programs]);

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
              const list = progsByChannel.get(ch.id) || [];

              // Determine NOW/NEXT with tiny tolerance
              const localNow = nowUtc(); // recompute to keep fresh
              let current: ProgramRow | undefined;
              let next: ProgramRow | undefined;

              for (let i = 0; i < list.length; i++) {
                const p = list[i];
                const st = toUtcDate(p.start_time);
                const dur = parseDurationSec(p.duration) || 1800;
                if (!st) continue;
                const startTol = new Date(st.getTime() - DRIFT_S * 1000);
                const endTol = new Date(st.getTime() + dur * 1000 + DRIFT_S * 1000);

                if (localNow >= startTol && localNow < endTol) {
                  current = p;
                  next = list[i + 1];
                  break;
                }
                if (st > localNow) {
                  next = p;
                  break;
                }
              }

              // Fallback: show last before now as "current" (keeps 24/7 feel)
              if (!current && list.length > 0) {
                const before = list.filter((p) => {
                  const d = toUtcDate(p.start_time);
                  return d ? d <= localNow : false;
                });
                if (before.length) current = before[before.length - 1];
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
                                const st = toUtcDate(current!.start_time);
                                const dur = parseDurationSec(current!.duration) || 1800;
                                if (!st) return "";
                                const en = addSeconds(st, dur);
                                return ` – ${en.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", timeZoneName: "short" })}`;
                              })()}
                            </div>
                          </>
                        ) : (
                          <div className="text-sm text-slate-400">Standby Programming</div>
                        )}
                      </div>

                      {/* Next */}
                      <div className="min-w-[260px] rounded-lg border border-slate-700 bg-slate-800 p-3">
                        <div className="text-xs uppercase tracking-wide text-amber-300 mb-1">Next</div>
                        {next ? (
                          <>
                            <div className="text-sm font-semibold text-white truncate">
                              {next.title || "Upcoming program"}
                            </div>
                            <div className="text-xs text-slate-400">
                              Starts {fmtTimeLocal(next.start_time)}
                            </div>
                          </>
                        ) : (
                          <div className="text-sm text-slate-400">No upcoming program in window.</div>
                        )}
                      </div>

                      {/* Later (one after Next) */}
                      {list
                        .filter((p) => {
                          const ds = toUtcDate(p.start_time);
                          const dn = next ? toUtcDate(next.start_time) : null;
                          return ds && (!dn ? ds > localNow : ds > dn);
                        })
                        .slice(0, 1)
                        .map((p) => (
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
