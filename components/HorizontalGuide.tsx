'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { getSupabaseClient } from '@/utils/supabase/client';
import { Button } from '@/components/ui/button';

type ChannelRow = {
  id: string | number;
  name?: string | null;
  title?: string | null;
  slug?: string | null;
  channel_number?: number | null;
  // we intentionally do NOT assume image_url exists
  [key: string]: any;
};

type ProgramRow = {
  id: string;
  title: string | null;
  channel_id: string | number;
  start_time: string;     // ISO
  duration: number | null; // seconds (null-safe)
  [key: string]: any;
};

function toStr(v: string | number | null | undefined) {
  return v == null ? '' : String(v);
}

function displayChannelName(ch: ChannelRow) {
  return ch.name || ch.title || `Channel ${toStr(ch.id)}`;
}

function fmtTime(iso?: string) {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

function isNow(p: ProgramRow, now: Date) {
  const start = new Date(p.start_time);
  const dur = (typeof p.duration === 'number' && p.duration > 0) ? p.duration : 1800; // default 30m
  const end = new Date(start.getTime() + dur * 1000);
  return now >= start && now < end;
}

function byStartAsc(a: ProgramRow, b: ProgramRow) {
  return new Date(a.start_time).getTime() - new Date(b.start_time).getTime();
}

export default function HorizontalGuide({ lookAheadHours = 6, lookBackHours = 6 }: { lookAheadHours?: number; lookBackHours?: number }) {
  const supabase = getSupabaseClient();

  const [channels, setChannels] = useState<ChannelRow[]>([]);
  const [programs, setPrograms] = useState<ProgramRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const windowStart = useMemo(() => {
    const d = new Date();
    d.setHours(d.getHours() - lookBackHours);
    return d.toISOString();
  }, [lookBackHours]);

  const windowEnd = useMemo(() => {
    const d = new Date();
    d.setHours(d.getHours() + lookAheadHours);
    return d.toISOString();
  }, [lookAheadHours]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setErr(null);
        setLoading(true);

        // 1) Channels — very permissive select to avoid “missing column” problems
        const { data: chRows, error: chErr } = await supabase
          .from('channels')
          .select('*')
          .order('id', { ascending: true });
        if (chErr) throw new Error(chErr.message);

        // 2) Programs window — one query, sorted ascending
        const { data: progRows, error: prErr } = await supabase
          .from('programs')
          .select('id, title, channel_id, start_time, duration')
          .gte('start_time', windowStart)
          .lte('start_time', windowEnd)
          .order('start_time', { ascending: true });

        if (prErr) throw new Error(prErr.message);

        if (cancelled) return;
        setChannels((chRows || []) as ChannelRow[]);
        setPrograms((progRows || []) as ProgramRow[]);
      } catch (e: any) {
        if (!cancelled) setErr(e?.message ?? 'Failed to load guide.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [supabase, windowStart, windowEnd]);

  // Group programs by channel_id (stringified to be robust)
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
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-xl font-semibold text-white">📺 What’s On (Now & Next)</h2>
        <div className="text-xs text-slate-400">Window: {lookBackHours}h back → {lookAheadHours}h ahead</div>
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
              // find current & next:
              let current: ProgramRow | undefined;
              let next: ProgramRow | undefined;

              for (let i = 0; i < list.length; i++) {
                const p = list[i];
                if (isNow(p, now)) {
                  current = p;
                  next = list[i + 1];
                  break;
                }
                if (new Date(p.start_time) > now) {
                  // we are between programs: no current, next is p
                  next = p;
                  break;
                }
              }

              // Fallback current: pick the last one that started before now
              if (!current && list.length > 0) {
                const before = list.filter(p => new Date(p.start_time) <= now);
                if (before.length) current = before[before.length - 1];
              }

              return (
                <div key={chKey} className="flex items-stretch">
                  {/* Channel cell */}
                  <div className="w-56 shrink-0 p-3 border-r border-slate-800">
                    <div className="text-sm text-slate-300">
                      <div className="font-semibold text-white truncate">{displayChannelName(ch)}</div>
                      <div className="text-xs text-slate-400">ID: {chKey}</div>
                    </div>
                    <div className="mt-2">
                      <Link href={`/watch/${encodeURIComponent(chKey)}`}>
                        <Button className="bg-yellow-500 text-black hover:bg-yellow-400 h-8 px-3 text-xs">
                          Watch
                        </Button>
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
                            <div className="text-sm font-semibold text-white truncate">{current.title || 'Untitled'}</div>
                            <div className="text-xs text-slate-400">
                              {fmtTime(current.start_time)}
                              {typeof current.duration === 'number' && current.duration > 0
                                ? ` – ${fmtTime(new Date(new Date(current.start_time).getTime() + current.duration * 1000).toISOString())}`
                                : ''}
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
                            <div className="text-sm font-semibold text-white truncate">{next.title || 'Upcoming program'}</div>
                            <div className="text-xs text-slate-400">
                              Starts {fmtTime(next.start_time)}
                            </div>
                          </>
                        ) : (
                          <div className="text-sm text-slate-400">No upcoming program in window.</div>
                        )}
                      </div>

                      {/* Optional: show one more upcoming in window */}
                      {list
                        .filter(p => new Date(p.start_time) > (next ? new Date(next.start_time) : now))
                        .slice(0, 1)
                        .map((p) => (
                          <div key={p.id} className="min-w-[240px] rounded-lg border border-slate-700 bg-slate-800 p-3">
                            <div className="text-xs uppercase tracking-wide text-slate-300 mb-1">Later</div>
                            <div className="text-sm font-semibold text-white truncate">{p.title || 'Program'}</div>
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
