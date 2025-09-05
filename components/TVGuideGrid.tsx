// components/TVGuideGrid.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@supabase/supabase-js";

/* ---------- types (your columns) ---------- */
type ChannelRow = {
  id: number | string;
  name: string | null;
  slug?: string | null;
  description?: string | null;
  logo_url: string | null;
  youtube_is_live?: boolean | null;
  is_active?: boolean | null;
};

type ProgramRow = {
  id: string | number;
  title: string | null;
  channel_id: number | string;
  start_time: string;         // ISO Z or "YYYY-MM-DD HH:mm:ss[Z|±HH:MM]"
  duration: number | string;  // seconds (e.g., 7620 or "7620s")
};

/* ---------- UTC time helpers (strict) ---------- */
const nowUtc = () => new Date(new Date().toISOString());
const addSeconds = (d: Date, secs: number) => new Date(d.getTime() + secs * 1000);

function toUtcDate(val?: string | Date | null): Date | null {
  if (!val) return null;
  if (val instanceof Date) return Number.isNaN(val.getTime()) ? null : val;

  let s = String(val).trim();

  // "YYYY-MM-DD HH:mm:ssZ" → T + Z
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(?:\.\d+)?[zZ]$/.test(s)) {
    s = s.replace(" ", "T").replace(/[zZ]$/, "Z");
  }
  // "YYYY-MM-DD HH:mm:ss±HH:MM" (or ±HHMM) → T + normalized offset
  else if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(?:\.\d+)?[+\-]\d{2}:?\d{2}$/.test(s)) {
    s = s.replace(" ", "T").replace(/([+\-]\d{2})(\d{2})$/, "$1:$2");
  }
  // ISO without tz → force Z
  else if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?$/.test(s)) {
    s += "Z";
  }
  // "YYYY-MM-DD HH:mm:ss" naive → treat as UTC
  else if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(?:\.\d+)?$/.test(s)) {
    s = s.replace(" ", "T") + "Z";
  }

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

function toDbTimestampStringUTC(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}` +
    ` ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`
  );
}

function toStr(v: string | number | null | undefined) {
  return v == null ? "" : String(v);
}

function fmtTimeLocal(isoish?: string) {
  const d = toUtcDate(isoish);
  if (!d) return "";
  try {
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch { return ""; }
}

/* ---------- component (old “Now / Next (+Later)” guide) ---------- */
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

  // Window (UTC)
  const windowStartISO = useMemo(() => {
    const d = nowUtc();
    d.setUTCHours(d.getUTCHours() - lookBackHours);
    return d.toISOString();
  }, [lookBackHours]);

  const windowEndISO = useMemo(() => {
    const d = nowUtc();
    d.setUTCHours(d.getUTCHours() + lookAheadHours);
    return d.toISOString();
  }, [lookAheadHours]);

  const windowStartDB = useMemo(() => toDbTimestampStringUTC(new Date(windowStartISO)), [windowStartISO]);
  const windowEndDB   = useMemo(() => toDbTimestampStringUTC(new Date(windowEndISO)),   [windowEndISO]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setErr(null);
        setLoading(true);

        // Channels — minimal columns, ordered numerically by id
        const { data: chRows, error: chErr } = await supabase
          .from("channels")
          .select("id, name, slug, description, logo_url, youtube_is_live, is_active")
          .order("id", { ascending: true });
        if (chErr) throw new Error(chErr.message);

        // Programs in window (ISO first)
        let progRows: ProgramRow[] = [];
        const { data: prA, error: prErrA } = await supabase
          .from("programs")
          .select("id, title, channel_id, start_time, duration")
          .gte("start_time", windowStartISO)
          .lte("start_time", windowEndISO)
          .order("start_time", { ascending: true });
        if (prErrA) throw new Error(prErrA.message);
        progRows = (prA || []) as ProgramRow[];

        // Fallback to TEXT-window if needed
        if (progRows.length === 0) {
          const { data: prB, error: prErrB } = await supabase
            .from("programs")
            .select("id, title, channel_id, start_time, duration")
            .gte("start_time", windowStartDB)
            .lte("start_time", windowEndDB)
            .order("start_time", { ascending: true });
          if (prErrB) throw new Error(prErrB.message);
          progRows = (prB || []) as ProgramRow[];
        }

        if (cancelled) return;

        // Numeric sort for channels: 1,2,3,…10,11…
        const sortedChannels = [...(chRows || [])].sort((a, b) => {
          const na = Number(a.id), nb = Number(b.id);
          const fa = Number.isFinite(na), fb = Number.isFinite(nb);
          if (fa && fb) return na - nb;
          return String(a.id).localeCompare(String(b.id), undefined, { numeric: true });
        });

        setChannels(sortedChannels as ChannelRow[]);
        setPrograms(progRows);
      } catch (e: any) {
        if (!cancelled) setErr(e?.message ?? "Failed to load guide.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [supabase, windowStartISO, windowEndISO, windowStartDB, windowEndDB]);

  // Group programs by channel_id
  const progsByChannel = useMemo(() => {
    const map = new Map<string, ProgramRow[]>();
    const sorted = [...programs].sort((a, b) => {
      const da = toUtcDate(a.start_time)?.getTime() ?? 0;
      const db = toUtcDate(b.start_time)?.getTime() ?? 0;
      return da - db;
    });
    for (const p of sorted) {
      const key = toStr(p.channel_id);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(p);
    }
    return map;
  }, [programs]);

  const now = nowUtc();

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
              const chKey = toStr(ch.id);
              const list = progsByChannel.get(chKey) || [];

              // find current & next
              let current: ProgramRow | undefined;
              let next: ProgramRow | undefined;

              for (let i = 0; i < list.length; i++) {
                const p = list[i];
                const st = toUtcDate(p.start_time);
                const dur = parseDurationSec(p.duration) || 1800;
                if (!st) continue;
                const en = addSeconds(st, dur);

                if (now >= st && now < en) {
                  current = p;
                  next = list[i + 1];
                  break;
                }
                if (st > now) {
                  next = p; // between shows
                  break;
                }
              }

              // fallback current: last one that started before now
              if (!current && list.length > 0) {
                const before = list.filter(p => {
                  const d = toUtcDate(p.start_time);
                  return d ? d <= now : false;
                });
                if (before.length) current = before[before.length - 1];
              }

              return (
                <div key={chKey} className="flex items-stretch">
                  {/* Channel cell */}
                  <div className="w-56 shrink-0 p-3 border-r border-slate-800">
                    <div className="text-sm text-slate-300">
                      <div className="font-semibold text-white truncate">
                        {ch.name || `Channel ${chKey}`}
                      </div>
                      <div className="text-xs text-slate-400">ID: {chKey}</div>
                    </div>
                    <div className="mt-2">
                      <Link
                        href={`/watch/${encodeURIComponent(chKey)}`}
                        className="inline-flex items-center rounded bg-amber-300 text-black hover:bg-amber-200 h-8 px-3 text-xs font-semibold"
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
                              {fmtTimeLocal(current.start_time)}
                              {(() => {
                                const st = toUtcDate(current!.start_time);
                                const dur = parseDurationSec(current!.duration) || 1800;
                                if (!st) return "";
                                const en = addSeconds(st, dur);
                                return ` – ${en.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
                              })()}
                            </div>
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
                              Starts {fmtTimeLocal(next.start_time)}
                            </div>
                          </>
                        ) : (
                          <div className="text-sm text-slate-400">No upcoming program in window.</div>
                        )}
                      </div>

                      {/* Optional: show one more upcoming */}
                      {list
                        .filter((p) => {
                          const ds = toUtcDate(p.start_time);
                          const dn = next ? toUtcDate(next.start_time) : null;
                          return ds && (!dn ? ds > now : ds > dn);
                        })
                        .slice(0, 1)
                        .map((p) => (
                          <div
                            key={String(p.id)}
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
