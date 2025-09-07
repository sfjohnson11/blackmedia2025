// components/TVGuideGrid.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@supabase/supabase-js";

/* ---------- types (match YOUR schema) ---------- */
type ChannelRow = {
  id: number;
  name: string | null;
  logo_url: string | null;
  youtube_channel_id?: string | null;
};

type ProgramRow = {
  channel_id: number;
  title: string | null;
  start_time: string;        // UTC-like string
  duration: number | string; // seconds
};

/* ---------- time helpers ---------- */
const nowUtc = () => new Date(new Date().toISOString());
const DRIFT_S = 5;
const addSeconds = (d: Date, s: number) => new Date(d.getTime() + s * 1000);

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
function fmtTimeLocal(isoish?: string) {
  const d = toUtcDate(isoish);
  if (!d) return "";
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", timeZoneName: "short" });
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
  const [diag, setDiag] = useState<{channels:number; slice:number; probe:number; note?:string}>({channels:0, slice:0, probe:0});

  // Window (UTC)
  const now = nowUtc();
  const winStart = new Date(now.getTime() - lookBackHours * 3600_000);
  const winEnd   = new Date(now.getTime() + lookAheadHours * 3600_000);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setErr(null);
        setLoading(true);

        // 1) Channels
        const chQ = await supabase
          .from("channels")
          .select("id, name, logo_url, youtube_channel_id");
        if (chQ.error) throw chQ.error;
        const chRows = (chQ.data || []) as ChannelRow[];
        chRows.sort((a, b) => Number(a.id) - Number(b.id)); // numeric order
        if (cancelled) return;
        setChannels(chRows);

        // 2) Programs: try server-slice first (wide), then fall back to unfiltered probe
        const sliceStartISO = new Date(winStart.getTime() - 48 * 3600_000).toISOString();
        const prA = await supabase
          .from("programs")
          .select("channel_id, title, start_time, duration")
          .gte("start_time", sliceStartISO)
          .lte("start_time", winEnd.toISOString())
          .order("start_time", { ascending: true });

        let raw: ProgramRow[] = [];
        let sliceLen = 0, probeLen = 0;

        if (!prA.error && prA.data && prA.data.length > 0) {
          sliceLen = prA.data.length;
          raw = prA.data as ProgramRow[];
        } else {
          const prProbe = await supabase
            .from("programs")
            .select("channel_id, title, start_time, duration")
            .order("start_time", { ascending: true })
            .limit(1000);
          if (prProbe.error) throw prProbe.error;
          probeLen = (prProbe.data || []).length;
          raw = (prProbe.data || []) as ProgramRow[];
        }

        if (cancelled) return;

        // 3) Overlap in JS (works regardless of TEXT/timestamptz)
        const overlapped: ProgramRow[] = [];
        for (const p of raw) {
          const st = toUtcDate(p.start_time);
          const dur = parseDurationSec(p.duration);
          if (!st || dur <= 0) continue;
          const en = addSeconds(st, dur);
          if (st < winEnd && en > winStart) overlapped.push(p);
        }

        setPrograms(overlapped);
        setDiag({ channels: chRows.length, slice: sliceLen, probe: probeLen, note: (!sliceLen && !probeLen) ? "No rows visible from browser (RLS/env)" : undefined });
        console.table({
          channels: chRows.length,
          programs_slice: sliceLen,
          programs_probe: probeLen,
          overlapped_kept: overlapped.length,
        });
      } catch (e: any) {
        if (!cancelled) {
          setErr(e?.message ?? "Failed to load guide.");
          setDiag((d) => ({...d, note: "Query error; check console"}));
          console.error("[GUIDE] error:", e);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [supabase, lookAheadHours, lookBackHours]);

  // Group programs by channel (sorted by start_time)
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

      {/* Inline diagnostics so you can see what's happening in Production */}
      <div className="mb-3 text-[11px] text-slate-400">
        <span>diag — channels:{diag.channels} slice:{diag.slice} probe:{diag.probe}</span>
        {diag.note ? <span className="ml-2 text-red-300">({diag.note})</span> : null}
      </div>

      {loading ? (
        <div className="text-slate-300">Loading guide…</div>
      ) : err ? (
        <div className="rounded border border-red-500 bg-red-900/30 p-3 text-red-200">{err}</div>
      ) : channels.length === 0 ? (
        <div className="text-slate-400">
          No channels found. Check env keys on Vercel:
          <code className="ml-1">NEXT_PUBLIC_SUPABASE_URL</code> &nbsp;
          <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900">
          <div className="min-w-[720px] divide-y divide-slate-800">
            {channels.map((ch) => {
              const list = progsByChannel.get(ch.id) || [];

              // Determine NOW/NEXT with overlap + small tolerance
              const localNow = nowUtc();
              let current: ProgramRow | undefined;
              let next: ProgramRow | undefined;

              for (let i = 0; i < list.length; i++) {
                const p = list[i];
                const st = toUtcDate(p.start_time);
                const dur = parseDurationSec(p.duration) || 1800;
                if (!st) continue;
                const startTol = addSeconds(st, -DRIFT_S);
                const endTol   = addSeconds(st, dur + DRIFT_S);

                if (localNow >= startTol && localNow < endTol) {
                  current = p;
                  next = list[i + 1];
                  break;
                }
                if (!current && st > localNow) {
                  next = p;
                  break;
                }
              }
              if (!current && list.length > 0) {
                const before = list.filter(p => {
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
