"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

/* ------- Types (match your schema) ------- */
type Channel = {
  id: number | string;         // TEXT in DB, values "1".."30"
  name?: string | null;
  logo_url?: string | null;
  youtube_is_live?: boolean | null;
};

type Program = {
  channel_id: number | string; // INT8 in DB
  title?: string | null;
  mp4_url?: string | null;
  duration?: number | string | null; // seconds or "HH:MM:SS"
  start_time?: string | null;        // timestamptz-ish
};

const CH21_ID_NUMERIC = 21;
const GRACE_MS = 120_000;       // 2 min grace
const LOOKAHEAD_HOURS = 24;     // show NEXT within 24h
const LOOKBACK_HOURS = 6;       // fetch a little earlier to detect a running show

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
  return (startMs - GRACE_MS) <= nowMs && nowMs < (endMs + GRACE_MS);
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
  next?: Program | null; // within next 24h
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
    return () => { cancelled = true; };
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
      arr.sort((a, b) => (parseUtcishMs(a.start_time) || 0) - (parseUtcishMs(b.start_time) || 0));
    }

    // Channels sorted 1..30
    const chans = channels.slice().sort((a, b) => toId(a.id) - toId(b.id));

    const list: Row[] = [];
    for (const ch of chans) {
      const cid = toId(ch.id);
      const listForChannel = byChannel.get(cid) || [];

      // CH21 Live override
      if (cid === CH21_ID_NUMERIC && ch.youtube_is_live) {
        const next = listForChannel.find(p => {
          const t = parseUtcishMs(p.start_time);
          return t > nowMs && t <= cutoffNextMs;
        }) || null;

        list.push({
          channel: ch,
          now: null,
          next,
          status: "live",
          badge: "LIVE NOW",
        });
        continue;
      }

      let nowProg: Program | undefined;
      let nextProg: Program | undefined;

      for (const p of listForChannel) {
        const t = parseUtcishMs(p.start_time);
        if (!nowProg && isActiveProgram(p, nowMs)) nowProg = p;
        if (!nextProg && t > nowMs && t <= cutoffNextMs) nextProg = p;
        if (nowProg && nextProg) break;
      }

      if (nowProg) {
        list.push({
          channel: ch,
          now: nowProg,
          next: nextProg || null,
          status: "on",
          badge: "On now",
        });
      } else if (nextProg) {
        const at = fmtTimeLocal(parseUtcishMs(nextProg.start_time));
        list.push({
          channel: ch,
          now: null,
          next: nextProg,
          status: "upcoming",
          badge: `Upcoming at ${at}`,
        });
      } else {
        list.push({
          channel: ch,
          now: null,
          next: null,
          status: "idle",
          badge: "Standby",
        });
      }
    }
    return list;
  }, [channels, programs]);

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="sticky top-0 z-10 px-4 py-3 bg-gray-900/60 backdrop-blur">
        <h1 className="text-xl font-semibold">Guide — Next 24 Hours</h1>
      </div>

      {err && <div className="p-4 text-red-400">Error: {err}</div>}
      {loading && <div className="p-6 text-center text-gray-300">Loading guide…</div>}

      {!loading && !err && (
        <div className="divide-y divide-gray-800">
          {rows.map((row) => {
            const idNum = toId(row.channel.id);
            const href = `/watch/${row.channel.id}`;
            const tone =
              row.status === "live" ? "text-red-400"
              : row.status === "on" ? "text-emerald-400"
              : row.status === "upcoming" ? "text-gray-300"
              : "text-gray-400";

            const nowStart = row.now ? parseUtcishMs(row.now.start_time) : NaN;
            const nowEnd = row.now ? nowStart + asSeconds(row.now.duration) * 1000 : NaN;

            return (
              <Link
                key={row.channel.id}
                href={href}
                className="block px-4 py-3 hover:bg-gray-900/50 transition"
              >
                <div className="flex items-center gap-3">
                  {/* Channel number */}
                  <div className="w-10 h-10 flex items-center justify-center rounded-lg bg-gray-800 border border-gray-700 shrink-0">
                    <span className="font-semibold">{idNum}</span>
                  </div>

                  {/* Logo */}
                  <div className="relative w-12 h-12 rounded-lg overflow-hidden bg-black/40 shrink-0">
                    {row.channel.logo_url ? (
                      <Image
                        src={row.channel.logo_url}
                        alt={`${row.channel.name ?? "Channel"} logo`}
                        fill
                        className="object-contain"
                        sizes="48px"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-xs text-gray-500">
                        Logo
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <div className="truncate font-semibold">
                        {row.channel.name || `Channel ${idNum}`}
                      </div>
                      <div className={`text-xs px-2 py-0.5 rounded-full bg-gray-800 border border-gray-700 ${tone}`}>
                        {row.badge}
                      </div>
                    </div>

                    {/* Now */}
                    <div className="mt-1 text-xs text-gray-300 truncate">
                      {row.status === "live" && "YouTube Live"}
                      {row.status !== "live" && row.now?.title && (
                        <>
                          <span className="text-gray-400">Now:</span>{" "}
                          <strong className="text-white">{row.now.title}</strong>
                          {" · "}
                          <span className="text-gray-400">until {fmtTimeLocal(nowEnd)}</span>
                        </>
                      )}
                      {row.status === "idle" && "Standby Programming"}
                    </div>

                    {/* Next (within 24h) */}
                    {row.next?.title && (
                      <div className="mt-0.5 text-[11px] text-gray-400 truncate">
                        <span className="text-gray-500">Next:</span>{" "}
                        <span className="text-gray-200">{row.next.title}</span>
                        {" · "}
                        <span>{fmtTimeLocal(parseUtcishMs(row.next.start_time))}</span>
                      </div>
                    )}
                  </div>

                  {/* Chevron */}
                  <div className="text-gray-600">›</div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
