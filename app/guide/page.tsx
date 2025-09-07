"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { supabase } from "@/lib/supabase";
import type { Program } from "@/lib/supabase";

// If you keep a separate type file, ensure youtube_is_live is in Channel
type Channel = {
  id: number | string;
  name?: string | null;
  logo_url?: string | null;
  youtube_is_live?: boolean | null; // <- IMPORTANT
};

const CH21_ID_NUMERIC = 21;
const GRACE_MS = 120_000; // 2 minutes grace around start/end

/* ---------- Time helpers (same behavior as the Watch page) ---------- */
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

/* ---------- Small UI bits ---------- */
function Badge({ children, tone = "default" }: { children: React.ReactNode; tone?: "live" | "now" | "default" }) {
  const cls =
    tone === "live"
      ? "bg-red-600 text-white"
      : tone === "now"
      ? "bg-emerald-600 text-white"
      : "bg-gray-700 text-gray-100";
  return <span className={`px-2 py-0.5 text-xs rounded-full ${cls}`}>{children}</span>;
}

/* ---------- Page ---------- */
type GuideRow = {
  channel: Channel;
  status: "live" | "on" | "upcoming" | "idle";
  label: string;           // “LIVE NOW”, “On now”, “Upcoming at 07:30 AM PDT”, “Standby”
  current?: Program | null;
  next?: Program | null;
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
        // 1) Channels: need youtube_is_live + display bits
        const { data: ch, error: chErr } = await supabase
          .from("channels")
          .select("id, name, logo_url, youtube_is_live")
          .order("id", { ascending: true });
        if (chErr) throw chErr;

        // 2) Programs for TODAY (UTC day). We’ll group client-side.
        const now = new Date();
        const startUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0));
        const endUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 0));

        const { data: progs, error: pErr } = await supabase
          .from("programs")
          .select("channel_id, title, mp4_url, start_time, duration")
          .gte("start_time", startUtc.toISOString())
          .lt("start_time", endUtc.toISOString())
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

  const rows: GuideRow[] = useMemo(() => {
    const nowMs = Date.now();
    const byChannel = new Map<number | string, Program[]>();
    for (const p of programs) {
      const key = p.channel_id;
      if (!byChannel.has(key)) byChannel.set(key, []);
      byChannel.get(key)!.push(p);
    }

    const result: GuideRow[] = [];
    for (const ch of channels) {
      // Sort that channel’s programs by start
      const list = (byChannel.get(ch.id) || []).slice().sort((a, b) => {
        const sa = parseUtcishMs(a.start_time);
        const sb = parseUtcishMs(b.start_time);
        return (isNaN(sa) ? 0 : sa) - (isNaN(sb) ? 0 : sb);
      });

      // Special case: Channel 21 live flag wins
      if (Number(ch.id) === CH21_ID_NUMERIC && ch.youtube_is_live) {
        result.push({
          channel: ch,
          status: "live",
          label: "LIVE NOW",
          current: null,
          next: list[0] || null,
        });
        continue;
      }

      // Find active + next
      let active: Program | undefined;
      let next: Program | undefined;
      for (const p of list) {
        if (!active && isActiveProgram(p, nowMs)) active = p;
        if (!next && parseUtcishMs(p.start_time) > nowMs) next = p;
        if (active && next) break;
      }

      if (active) {
        result.push({
          channel: ch,
          status: "on",
          label: "On now",
          current: active,
          next: next || null,
        });
      } else if (next) {
        const when = new Date(parseUtcishMs(next.start_time)).toLocaleTimeString("en-US", {
          hour: "2-digit",
          minute: "2-digit",
          timeZoneName: "short",
        });
        result.push({
          channel: ch,
          status: "upcoming",
          label: `Upcoming at ${when}`,
          current: null,
          next,
        });
      } else {
        result.push({
          channel: ch,
          status: "idle",
          label: "Standby",
          current: null,
          next: null,
        });
      }
    }
    return result;
  }, [channels, programs]);

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="sticky top-0 z-10 px-4 py-3 bg-gray-900/60 backdrop-blur">
        <h1 className="text-xl font-semibold">Guide</h1>
      </div>

      {err && (
        <div className="p-4 text-red-400">
          Error: {err}
        </div>
      )}

      {loading ? (
        <div className="p-6 text-center text-gray-300">Loading guide…</div>
      ) : (
        <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {rows.map((row) => {
            const href = `/watch/${row.channel.id}`;
            const tone = row.status === "live" ? "live" : row.status === "on" ? "now" : "default";
            return (
              <Link
                key={row.channel.id}
                href={href}
                className="group rounded-2xl overflow-hidden bg-gray-900/60 ring-1 ring-gray-800 hover:ring-gray-600 transition"
              >
                <div className="flex items-center gap-3 p-3">
                  <div className="relative w-12 h-12 rounded-lg overflow-hidden bg-black/50 shrink-0">
                    {row.channel.logo_url ? (
                      <Image
                        src={row.channel.logo_url}
                        alt={`${row.channel.name ?? "Channel"} logo`}
                        fill
                        className="object-contain"
                        sizes="48px"
                        priority={false}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-xs text-gray-400">
                        {String(row.channel.id)}
                      </div>
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h2 className="truncate font-semibold">
                        {row.channel.name || `Channel ${row.channel.id}`}
                      </h2>
                      <Badge tone={tone}>
                        {row.label}
                      </Badge>
                    </div>
                    <div className="text-xs text-gray-300 truncate">
                      {row.status === "live" && "YouTube Live"}
                      {row.status !== "live" && row.current?.title
                        ? row.current.title
                        : row.next?.title
                        ? row.next.title
                        : "Standby Programming"}
                    </div>
                  </div>
                </div>
                <div className="px-3 pb-3">
                  <div className="text-[11px] text-gray-400">
                    Go to <span className="underline group-hover:no-underline">Watch</span>
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
