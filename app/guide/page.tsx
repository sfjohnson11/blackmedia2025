"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

// Keep in sync with your types
type Channel = {
  id: number | string;         // channels.id (text in DB, but numeric ids 1..30)
  name?: string | null;
  logo_url?: string | null;
  youtube_is_live?: boolean | null;
};

type Program = {
  channel_id: number | string;
  title?: string | null;
  mp4_url?: string | null;
  duration?: number | string | null; // seconds or "HH:MM:SS"
  start_time?: string | null;        // timestamptz-ish
};

const CH21_ID_NUMERIC = 21;
const GRACE_MS = 120_000; // 2 minutes grace around start/end

/* ---------- Time helpers (match Watch page behavior) ---------- */
function asSeconds(v: unknown): number {
  if (v == null) return 0;
  if (typeof v === "number" && Number.isFinite(v)) return v;
  const s = String(v).trim();
  const m = /^(\d{1,3}):([0-5]?\d)(?::([0-5]?\d))?$/.exec(s); // HH:MM:SS or MM:SS
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

  // "YYYY-MM-DD HH:mm:ss" -> "YYYY-MM-DDTHH:mm:ss"
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

/* ---------- Guide row shape ---------- */
type Row = {
  channel: Channel;
  now?: Program | null;
  next?: Program | null;
  status: "live" | "on" | "upcoming" | "idle";
  badge: string; // LIVE NOW / On now / Upcoming at ... / Standby
};

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
        // Channels
        const { data: ch, error: chErr } = await supabase
          .from("channels")
          .select("id, name, logo_url, youtube_is_live")
          .order("id", { ascending: true });
        if (chErr) throw chErr;

        // Programs: from 6 hours ago to +24 hours ahead → captures "now" + "next"
        const now = Date.now();
        const from = new Date(now - 6 * 3600 * 1000).toISOString();
        const to = new Date(now + 24 * 3600 * 1000).toISOString();

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
    const byChannel = new Map<number | string, Program[]>();
    for (const p of programs) {
      const key = p.channel_id;
      if (!byChannel.has(key)) byChannel.set(key, []);
      byChannel.get(key)!.push(p);
    }
    // Sort channel programs by start_time
    for (const arr of byChannel.values()) {
      arr.sort((a, b) => (parseUtcishMs(a.start_time) || 0) - (parseUtcishMs(b.start_time) || 0));
    }

    // Sort channels numerically by id (even if DB type is text)
    const chans = channels.slice().sort((a, b) => Number(a.id) - Number(b.id));

    const list: Row[] = [];
    for (const ch of chans) {
      const cid = ch.id;
      const listForChannel = byChannel.get(cid) || [];

      // CH21 hard LIVE override
      if (Number(cid) === CH21_ID_NUMERIC && ch.youtube_is_live) {
        const next = listForChannel.find(p => parseUtcishMs(p.start_time) > nowMs) || null;
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
        if (!nowProg && isActiveProgram(p, nowMs)) nowProg = p;
        if (!nextProg && parseUtcishMs(p.start_time) > nowMs) nextProg = p;
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
        <h1 className="text-xl font-semibold">Guide</h1>
      </div>

      {err && <div className="p-4 text-red-400">Error: {err}</div>}
      {loading && <div className="p-6 text-center text-gray-300">Loading guide…</div>}

      {!loading && !err && (
        <div className="divide-y divide-gray-800">
          {rows.map((row) => {
            const idNum = Number(row.channel.id);
            const href = `/watch/${row.channel.id}`;
            const tone =
              row.status === "live" ? "text-red-400"
              : row.status === "on" ? "text-emerald-400"
              : row.status === "upcoming" ? "text-gray-300"
              : "text-gray-400";

            return (
              <Link
                key={row.channel.id}
                href={href}
                className="block px-4 py-3 hover:bg-gray-900/50 transition"
              >
                <div className="flex items-center gap-3">
                  {/* Channel number badge */}
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

                    {/* Now / Next lines */}
                    <div className="mt-1 text-xs text-gray-300 truncate">
                      {row.status === "live" && "YouTube Live"}
                      {row.status !== "live" && row.now?.title && (
                        <>
                          <span className="text-gray-400">Now:</span>{" "}
                          <strong className="text-white">{row.now.title}</strong>
                          {" · "}
                          <span className="text-gray-400">
                            until {fmtTimeLocal(parseUtcishMs(row.now.start_time) + asSeconds(row.now.duration) * 1000)}
                          </span>
                        </>
                      )}
                      {row.status !== "live" && !row.now?.title && row.next?.title && (
                        <>
                          <span className="text-gray-400">Next:</span>{" "}
                          <strong className="text-white">{row.next.title}</strong>
                          {" · "}
                          <span className="text-gray-400">
                            {fmtTimeLocal(parseUtcishMs(row.next.start_time))}
                          </span>
                        </>
                      )}
                      {row.status === "idle" && "Standby Programming"}
                    </div>
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
