"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { ChevronRight } from "lucide-react";

/* ------- Types (match your schema) ------- */
type Channel = {
  id: number | string; // TEXT in DB, values "1".."30"
  name?: string | null;
  logo_url?: string | null;
  youtube_is_live?: boolean | null;
};

type Program = {
  channel_id: number | string; // INT8 in DB
  title?: string | null;
  mp4_url?: string | null;
  duration?: number | string | null; // seconds or "HH:MM:SS"
  start_time?: string | null; // timestamptz-ish
};

const CH21_ID_NUMERIC = 21;
const GRACE_MS = 120_000; // 2 min grace
const LOOKAHEAD_HOURS = 24; // show all upcoming within 24h
const LOOKBACK_HOURS = 6; // fetch a little earlier to correctly detect "Now"

/* ---------- Helpers ---------- */
function toId(v: number | string | null | undefined): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : NaN;
}

function asSeconds(v: unknown): number {
  if (v == null) return 0;
  if (typeof v === "number" && Number.isFinite(v)) return v;
  const s = String(v).trim();
  const m = /^(\d{1,3}):([0-5]?\d)(?::([0-5]?\d))?$/.exec(s);
  if (m) {
    const hh = m[3] ? Number(m[1]) : 0;
    const mm = Number(m[3] ? m[2] : m[1]);
    const ss = Number(m[3] ? m[3] : m[2]);
    return hh * 3600 + mm * 60 + ss;
  }
  const num = Number(s.replace(/[^\d.]+/g, ""));
  return Number.isFinite(num) && num > 0 ? Math.round(num) : 0;
}

function parseUtcishMs(val: unknown): number {
  if (val == null) return NaN;
  let s = String(val).trim();
  if (!s) return NaN;

  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/.test(s)) s = s.replace(" ", "T");
  if (/[zZ]$/.test(s)) s = s.replace(/[zZ]$/, "Z");
  else {
    const m = /([+\-]\d{2})(:?)(\d{2})?$/.exec(s);
    if (m) {
      const hh = m[1];
      const mm = m[3] ?? "00";
      s = s.replace(/([+\-]\d{2})(:?)(\d{2})?$/, `${hh}:${mm}`);
      if (/([+\-]00:00)$/.test(s)) s = s.replace(/([+\-]00:00)$/, "Z");
    } else if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?$/.test(s)) {
      s += "Z";
    } else if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(?:\.\d+)?$/.test(s)) {
      s = s.replace(" ", "T") + "Z";
    }
  }
  const t = Date.parse(s);
  return Number.isNaN(t) ? NaN : t;
}

function isActiveProgram(p: Program, nowMs: number): boolean {
  const startMs = parseUtcishMs(p.start_time);
  const durSec = asSeconds(p.duration);
  if (!Number.isFinite(startMs) || durSec <= 0) return false;
  const endMs = startMs + durSec * 1000;
  return startMs - GRACE_MS <= nowMs && nowMs < endMs + GRACE_MS;
}

function fmtTimeLocal(ms: number) {
  return new Date(ms).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short",
  });
}

/* ---------- Row shape ---------- */
type Row = {
  channel: Channel;
  now?: Program | null;
  next?: Program | null;
  later?: Program[]; // all upcoming beyond "next" within 24h
  status: "live" | "on" | "upcoming" | "idle";
  badge: string;
};

/* ================== PAGE ================== */
export default function GuidePage() {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setErr(null);
      try {
        // Channels (id is TEXT, but values are "1".."30")
        const { data: ch, error: chErr } = await supabase
          .from("channels")
          .select("id, name, logo_url, youtube_is_live")
          .order("id", { ascending: true });
        if (chErr) throw chErr;

        // Programs: small lookback to catch "now", and 24h lookahead
        const now = Date.now();
        const from = new Date(now - LOOKBACK_HOURS * 3600 * 1000).toISOString();
        const to = new Date(now + LOOKAHEAD_HOURS * 3600 * 1000).toISOString();

        const { data: progs, error: pErr } = await supabase
          .from("programs")
          .select("channel_id, title, mp4_url, start_time, duration")
          .gte("start_time", from)
          .lt("start_time", to)
          .order("start_time", { ascending: true });

        if (pErr) throw pErr;

        if (!cancelled) {
          setChannels((ch || []) as Channel[]);
          setPrograms((progs || []) as Program[]);
        }
      } catch (e: any) {
        if (!cancelled) setErr(e?.message || "Failed to load guide");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const rows: Row[] = useMemo(() => {
    const nowMs = Date.now();
    const cutoffNextMs = nowMs + LOOKAHEAD_HOURS * 3600 * 1000;

    // Group by numeric channel id (critical)
    const byChannel = new Map<number, Program[]>();
    for (const p of programs) {
      const key = toId(p.channel_id);
      if (!Number.isFinite(key)) continue;
      if (!byChannel.has(key)) byChannel.set(key, []);
      byChannel.get(key)!.push(p);
    }
    // Sort each channel's programs by start
    for (const arr of byChannel.values()) {
      arr.sort(
        (a, b) =>
          (parseUtcishMs(a.start_time) || 0) -
          (parseUtcishMs(b.start_time) || 0),
      );
    }

    // Channels sorted 1..30
    const chans = channels
      .slice()
      .sort((a, b) => toId(a.id) - toId(b.id));

    const list: Row[] = [];
    for (const ch of chans) {
      const cid = toId(ch.id);
      const listForChannel = byChannel.get(cid) || [];

      // CH21 Live override
      if (cid === CH21_ID_NUMERIC && ch.youtube_is_live) {
        const upcoming = listForChannel.filter((p) => {
          const t = parseUtcishMs(p.start_time);
          return t > nowMs && t <= cutoffNextMs;
        });
        const next = upcoming[0] || null;
        const later = upcoming.slice(1);
        list.push({
          channel: ch,
          now: null,
          next,
          later,
          status: "live",
          badge: "LIVE NOW",
        });
        continue;
      }

      let nowProg: Program | undefined;
      // gather all upcoming within window
      const upcoming: Program[] = [];
      for (const p of listForChannel) {
        const t = parseUtcishMs(p.start_time);
        if (!nowProg && isActiveProgram(p, nowMs)) nowProg = p;
        if (t > nowMs && t <= cutoffNextMs) upcoming.push(p);
      }
      const next = upcoming[0] || null;
      const later = upcoming.slice(1);

      if (nowProg) {
        list.push({
          channel: ch,
          now: nowProg,
          next,
          later,
          status: "on",
          badge: "On Now",
        });
      } else if (next) {
        const at = fmtTimeLocal(parseUtcishMs(next.start_time));
        list.push({
          channel: ch,
          now: null,
          next,
          later: upcoming.slice(1),
          status: "upcoming",
          badge: `Upcoming · ${at}`,
        });
      } else {
        list.push({
          channel: ch,
          now: null,
          next: null,
          later: [],
          status: "idle",
          badge: "Standby",
        });
      }
    }
    return list;
  }, [channels, programs]);

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <div className="sticky top-0 z-10 border-b border-gray-800 bg-gray-900/80 px-4 py-3 backdrop-blur">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold sm:text-xl">
              Black Truth TV Guide
            </h1>
            <p className="text-xs text-gray-300 sm:text-sm">
              Next 24 hours · Tap a row to jump to that channel
            </p>
          </div>
          <span className="rounded-full bg-red-700 px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-white">
            Live Lineup
          </span>
        </div>
      </div>

      {err && (
        <div className="p-4 text-center text-sm text-red-400">Error: {err}</div>
      )}
      {loading && (
        <div className="p-6 text-center text-sm text-gray-300">
          Loading guide…
        </div>
      )}

      {!loading && !err && (
        <div className="divide-y divide-gray-900">
          {rows.map((row) => {
            const idNum = toId(row.channel.id);
            const href = `/watch/${row.channel.id}`;
            const tone =
              row.status === "live"
                ? "bg-red-900/40 border-red-500/60 text-red-300"
                : row.status === "on"
                  ? "bg-emerald-900/30 border-emerald-500/60 text-emerald-200"
                  : row.status === "upcoming"
                    ? "bg-slate-800/60 border-slate-500/60 text-slate-100"
                    : "bg-slate-900/80 border-slate-600/60 text-slate-200";

            const nowStart = row.now ? parseUtcishMs(row.now.start_time) : NaN;
            const nowEnd =
              row.now && Number.isFinite(nowStart)
                ? nowStart + asSeconds(row.now.duration) * 1000
                : NaN;

            return (
              <Link
                key={row.channel.id}
                href={href}
                className="block px-3 py-3 text-sm transition hover:bg-gray-900/70 sm:px-4"
              >
                <div className="flex items-center gap-3 sm:gap-4">
                  {/* Channel number */}
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-gray-700 bg-gray-900/80 text-sm font-semibold sm:h-11 sm:w-11">
                    {idNum}
                  </div>

                  {/* Logo */}
                  <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-md bg-black/50 sm:h-12 sm:w-12">
                    {row.channel.logo_url ? (
                      <Image
                        src={row.channel.logo_url}
                        alt={`${row.channel.name ?? "Channel"} logo`}
                        fill
                        className="object-contain"
                        sizes="48px"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-[10px] text-gray-500">
                        Logo
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <div className="truncate text-sm font-semibold sm:text-base">
                        {row.channel.name || `Channel ${idNum}`}
                      </div>
                      <div
                        className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${tone}`}
                      >
                        {row.badge}
                      </div>
                    </div>

                    {/* Now */}
                    <div className="text-xs text-gray-200 sm:text-sm">
                      {row.status === "live" && (
                        <span className="font-medium text-red-300">
                          YouTube Live Stream
                        </span>
                      )}
                      {row.status !== "live" && row.now?.title && (
                        <>
                          <span className="text-gray-400">Now:</span>{" "}
                          <span className="font-semibold text-white">
                            {row.now.title}
                          </span>
                          {Number.isFinite(nowEnd) && (
                            <>
                              {" "}
                              <span className="text-gray-500">· ends</span>{" "}
                              <span className="text-gray-300">
                                {fmtTimeLocal(nowEnd)}
                              </span>
                            </>
                          )}
                        </>
                      )}
                      {row.status === "idle" && !row.now && !row.next && (
                        <span className="text-gray-400">
                          Standby programming
                        </span>
                      )}
                    </div>

                    {/* Next */}
                    {row.next?.title && (
                      <div className="text-[11px] text-gray-300">
                        <span className="text-gray-500">Next:</span>{" "}
                        <span className="font-medium text-gray-100">
                          {row.next.title}
                        </span>{" "}
                        <span className="text-gray-400">
                          · {fmtTimeLocal(parseUtcishMs(row.next.start_time))}
                        </span>
                      </div>
                    )}

                    {/* Later list (compact) */}
                    {row.later && row.later.length > 0 && (
                      <div className="text-[11px] text-gray-400">
                        <span className="text-gray-600">Later:</span>{" "}
                        {row.later.map((p, i) => {
                          const t = fmtTimeLocal(parseUtcishMs(p.start_time));
                          return (
                            <span
                              key={`${p.start_time}-${i}`}
                              className="whitespace-nowrap"
                            >
                              {t} {p.title}
                              {i < row.later!.length - 1 ? " · " : ""}
                            </span>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Watch pill (instead of a naked arrow) */}
                  <div className="hidden flex-col items-end gap-1 text-[11px] text-gray-400 sm:flex">
                    <span>Go to channel</span>
                    <div className="inline-flex items-center gap-1 rounded-full bg-red-700 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide">
                      <span>Watch</span>
                      <ChevronRight className="h-3 w-3" />
                    </div>
                  </div>
                  {/* On very small screens just show a simple chevron */}
                  <div className="flex items-center text-gray-500 sm:hidden">
                    <ChevronRight className="h-4 w-4" />
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
