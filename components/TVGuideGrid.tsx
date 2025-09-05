// components/TVGuideGrid.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

type ChannelRow = {
  id: number | string;
  name?: string | null;
  title?: string | null;
  slug?: string | null;
  channel_number?: number | null;
  logo_url?: string | null;
  youtube_channel_id?: string | null;
  [key: string]: any;
};

type ProgramRow = {
  id: string | number;
  title: string | null;
  channel_id: number | string;
  start_time: string;        // ISO or "YYYY-MM-DD HH:mm:ss"
  duration: number | null;   // seconds (nullable)
  mp4_url?: string | null;
  [key: string]: any;
};

/* ---------- time helpers (UTC-safe) ---------- */
function toUtcDate(val?: string | Date | null): Date | null {
  if (!val) return null;
  if (val instanceof Date) return Number.isNaN(val.getTime()) ? null : val;
  let s = String(val).trim();
  // "YYYY-MM-DD HH:mm:ss[.sss]" (no tz) → treat as UTC
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(\.\d+)?$/.test(s)) s = s.replace(" ", "T") + "Z";
  // If no explicit tz (+/- or Z), force UTC
  else if (!/[zZ]|[+\-]\d{2}:\d{2}$/.test(s)) s = s + "Z";
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}
const addSeconds = (d: Date, secs: number) => new Date(d.getTime() + secs * 1000);

function toDbTimestampStringUTC(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}` +
    ` ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`
  );
}

const SAFE_DEFAULT_SECS = 1800; // 30 min default if duration is null/invalid

function programIsNow(p: ProgramRow, now = new Date()) {
  const st = toUtcDate(p.start_time);
  const dur = Number.isFinite(Number(p.duration)) && Number(p.duration)! > 0
    ? Number(p.duration)!
    : SAFE_DEFAULT_SECS;
  if (!st) return false;
  const en = addSeconds(st, dur);
  // tiny tolerance for rounding/format jitter
  return now.getTime() >= st.getTime() - 2000 && now.getTime() < en.getTime() + 2000;
}

function fmtTime(isoish?: string) {
  const d = toUtcDate(isoish);
  if (!d) return "";
  try {
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

function byStartAsc(a: ProgramRow, b: ProgramRow) {
  const da = toUtcDate(a.start_time)?.getTime() ?? 0;
  const db = toUtcDate(b.start_time)?.getTime() ?? 0;
  return da - db;
}

function toStr(v: string | number | null | undefined) {
  return v == null ? "" : String(v);
}

function displayChannelName(ch: ChannelRow) {
  return ch.name || ch.title || `Channel ${toStr(ch.id)}`;
}

/* ---------- component ---------- */
export default function TVGuideGrid({
  lookAheadHours = 6,
  lookBackHours = 6,
}: {
  lookAheadHours?: number;
  lookBackHours?: number;
}) {
  const [channels, setChannels] = useState<ChannelRow[]>([]);
  const [programs, setPrograms] = useState<ProgramRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  // Compute window (UTC) — used for querying; UI still shows local time
  const windowStartISO = useMemo(() => {
    const d = new Date();
    d.setHours(d.getHours() - lookBackHours);
    return d.toISOString();
  }, [lookBackHours]);

  const windowEndISO = useMemo(() => {
    const d = new Date();
    d.setHours(d.getHours() + lookAheadHours);
    return d.toISOString();
  }, [lookAheadHours]);

  const windowStartDB = useMemo(() => toDbTimestampStringUTC(new Date(windowStartISO)), [windowStartISO]);
  const windowEndDB = useMemo(() => toDbTimestampStringUTC(new Date(windowEndISO)), [windowEndISO]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setErr(null);
        setLoading(true);

        // 1) Channels
        const { data: chRows, error: chErr } = await supabase
          .from("channels")
          .select("*")
          .order("id", { ascending: true });

        if (chErr) throw new Error(chErr.message);

        // 2) Programs — try ISO window first
        let progRows: ProgramRow[] = [];
        const { data: prA, error: prErrA } = await supabase
          .from("programs")
          .select("id, title, channel_id, start_time, duration, mp4_url")
          .gte("start_time", windowStartISO)
          .lte("start_time", windowEndISO)
          .order("start_time", { ascending: true });

        if (prErrA) throw new Error(prErrA.message);
        progRows = (prA || []) as ProgramRow[];

        // Fallback: if zero programs, try DB text window (works if start_time stored as TEXT)
        if (progRows.length === 0) {
          const { data: prB, error: prErrB } = await supabase
            .from("programs")
            .select("id, title, channel_id, start_time, duration, mp4_url")
            .gte("start_time", windowStartDB)
            .lte("start_time", windowEndDB)
            .order("start_time", { ascending: true });
          if (prErrB) throw new Error(prErrB.message);
          progRows = (prB || []) as ProgramRow[];
        }

        if (cancelled) return;
        setChannels((chRows || []) as ChannelRow[]);
        setPrograms(progRows);
      } catch (e: any) {
        if (!cancelled) setErr(e?.message ?? "Failed to load guide.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [windowStartISO, windowEndISO, windowStartDB, windowEndDB]);

  // Group programs by channel_id
  const progsByChannel = useMemo(() => {
    const map = new Map<string, ProgramRow[]>();
    const sorted = [...programs].sort(byStartAsc);
    for (const p of sorted) {
      const key = toStr(p.channel_id);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(p);
    }
    return map;
  }, [programs]);

  const now = new Date();

  return (
    <section className="mb-6">
      <div className="flex items-center justify-between mb-3">
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
              const chKey = toStr(ch.id);
              const list = progsByChannel.get(chKey) || [];

              // Determine current & next
              let current: ProgramRow | undefined;
              let next: ProgramRow | undefined;

              for (let i = 0; i < list.length; i++) {
                const p = list[i];
                if (programIsNow(p, now)) {
                  current = p;
                  next = list[i + 1];
                  break;
                }
                const pStart = toUtcDate(p.start_time);
                if (pStart && pStart > now) {
                  next = p;
                  break;
                }
              }

              // Fallback current: last one that started <= now (even if duration missing)
              if (!current && list.length > 0) {
                const before = list.filter((p) => {
                  const d = toUtcDate(p.start_time);
                  return d ? d <= now : false;
                });
                if (before.length) current = before[before.length - 1];
              }

              return (
                <div key={chKey} className="flex items-stretch">
                  {/* Channel cell */}
                  <div className="w-56 shrink-0 p-3 border-r border-slate-800">
                    <div className="flex items-center gap-2">
                      {ch.logo_url ? (
                        <img
                          src={ch.logo_url}
                          alt={displayChannelName(ch)}
                          className="h-8 w-8 object-contain bg-black/30 rounded"
                          onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                        />
                      ) : null}
                      <div className="text-sm text-slate-300">
                        <div className="font-semibold text-white truncate">
                          {displayChannelName(ch)}
                        </div>
                        <div className="text-xs text-slate-400">ID: {chKey}</div>
                      </div>
                    </div>
                    <div className="mt-2">
                      <Link
                        href={`/watch/${encodeURIComponent(chKey)}`}
                        className="inline-block bg-yellow-400 text-black hover:bg-yellow-300 h-8 px-3 text-xs rounded font-semibold"
                      >
                        Watch
                      </Link>
                    </div>
                  </div>

                  {/* Programs cell */}
                  <div className="flex-1 p-3">
                    <div className="flex gap-3 overflow-x-auto">
                      {/* Current */}
                      <div className="min-w-[260px] rounded-lg border border-slate-700 bg-slate-800 p-3">
                        <div className="text-xs uppercase tracking-wide text-sky-300 mb-1">Now</div>
                        {current ? (
                          <>
                            <div className="text-sm font-semibold text-white truncate">
                              {current.title || "Untitled"}
                            </div>
                            <div className="text-xs text-slate-400">
                              {fmtTime(current.start_time)}
                              {(() => {
                                const st = toUtcDate(current!.start_time);
                                const dur =
                                  typeof current!.duration === "number" && current!.duration > 0
                                    ? current!.duration
                                    : SAFE_DEFAULT_SECS;
                                if (!st) return "";
                                const en = addSeconds(st, dur);
                                return ` – ${en.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
                              })()}
                            </div>
                            {String(ch.id) === "21" && ch.youtube_channel_id && (
                              <div className="mt-1 text-[11px] text-emerald-300">YouTube Live</div>
                            )}
                          </>
                        ) : (
                          <div className="text-sm text-slate-400">No program right now.</div>
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
                              Starts {fmtTime(next.start_time)}
                            </div>
                          </>
                        ) : (
                          <div className="text-sm text-slate-400">No upcoming program in window.</div>
                        )}
                      </div>

                      {/* Later (optional one more) */}
                      {list
                        .filter((p) => {
                          const ds = toUtcDate(p.start_time);
                          const dn = next ? toUtcDate(next.start_time) : null;
                          return ds && (!dn ? ds > now : ds > dn);
                        })
                        .slice(0, 1)
                        .map((p) => (
                          <div
                            key={p.id}
                            className="min-w-[240px] rounded-lg border border-slate-700 bg-slate-800 p-3"
                          >
                            <div className="text-xs uppercase tracking-wide text-slate-300 mb-1">
                              Later
                            </div>
                            <div className="text-sm font-semibold text-white truncate">
                              {p.title || "Program"}
                            </div>
                            <div className="text-xs text-slate-400">Starts {fmtTime(p.start_time)}</div>
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
