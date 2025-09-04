// app/page.tsx
import Link from "next/link";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Channel = {
  id: string;                 // can be numeric string or a slug
  name: string | null;
  description?: string | null;
  logo_url?: string | null;   // <-- your schema
};

type Program = {
  id: string;
  channel_id: string | number;   // can be text or number; we coerce to string to match Channel.id
  title: string | null;
  start_time: string | null;      // ISO
  duration?: number | null;       // seconds (optional)
  end_time?: string | null;       // ISO (optional)
};

// --------- UI bits ----------
function ChannelCard({ ch }: { ch: Channel }) {
  return (
    <Link
      href={`/watch/${ch.id}`}
      className="group rounded-xl overflow-hidden border border-gray-800 hover:border-gray-600 transition-colors bg-gray-900"
    >
      <div className="aspect-video bg-black overflow-hidden">
        {ch.logo_url ? (
          <img
            src={ch.logo_url}
            alt={ch.name ?? `Channel ${ch.id}`}
            className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-300"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-500 text-sm">
            No artwork
          </div>
        )}
      </div>
      <div className="p-3">
        <div className="text-base font-semibold truncate">
          {ch.name ?? `Channel ${ch.id}`}
        </div>
        {ch.description ? (
          <div className="text-xs text-gray-400 line-clamp-2 mt-1">
            {ch.description}
          </div>
        ) : null}
      </div>
    </Link>
  );
}

function fmtTime(d: Date) {
  try {
    return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  } catch {
    return d.toISOString().slice(11,16);
  }
}

function GuideItem({
  channel,
  nowTitle,
  nowRange,
  nextTitle,
  href,
}: {
  channel: Channel;
  nowTitle: string;
  nowRange: string;
  nextTitle?: string | null;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="min-w-[260px] max-w-[320px] rounded-xl border border-gray-800 bg-gray-900 hover:border-gray-700 transition-colors overflow-hidden"
    >
      <div className="flex items-center gap-3 p-3 border-b border-gray-800">
        <div className="w-12 h-12 bg-black rounded overflow-hidden flex items-center justify-center">
          {channel.logo_url ? (
            <img src={channel.logo_url} alt={channel.name ?? ''} className="w-full h-full object-cover" />
          ) : (
            <span className="text-xs text-gray-500">No logo</span>
          )}
        </div>
        <div className="flex-1">
          <div className="text-sm font-semibold truncate">{channel.name ?? `Channel ${channel.id}`}</div>
          <div className="text-[11px] text-gray-400 truncate">{channel.description ?? ''}</div>
        </div>
      </div>

      <div className="p-3">
        <div className="text-[10px] uppercase tracking-wide text-gray-400 mb-1">Now</div>
        <div className="text-sm font-medium truncate">{nowTitle}</div>
        <div className="text-xs text-gray-400">{nowRange}</div>

        <div className="mt-3 text-[10px] uppercase tracking-wide text-gray-400 mb-1">Up Next</div>
        <div className="text-sm truncate">{nextTitle ?? "—"}</div>
      </div>
    </Link>
  );
}
// --------------------------------

export default async function HomePage() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  if (!url || !anon) {
    return (
      <div className="pt-14 min-h-screen px-4 md:px-10 flex items-center justify-center">
        <div className="max-w-xl w-full bg-gray-900 border border-gray-800 rounded-lg p-6 text-center">
          <h1 className="text-2xl font-bold mb-2">Configuration error</h1>
          <p className="text-gray-300">
            Missing <code className="text-gray-200">NEXT_PUBLIC_SUPABASE_URL</code> or{" "}
            <code className="text-gray-200">NEXT_PUBLIC_SUPABASE_ANON_KEY</code>.
          </p>
        </div>
      </div>
    );
  }

  const supabase = createClient(url, anon);

  // 1) Channels (uses your exact columns; no schema changes)
  const { data: chRows, error: chErr } = await supabase
    .from("channels")
    .select("id, name, description, logo_url")
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  if (chErr) {
    return (
      <div className="pt-14 min-h-screen px-4 md:px-10 flex items-center justify-center">
        <div className="max-w-xl w-full bg-gray-900 border border-gray-800 rounded-lg p-6 text-center">
          <h1 className="text-2xl font-bold mb-2">Couldn’t load channels</h1>
          <p className="text-gray-300">{chErr.message}</p>
        </div>
      </div>
    );
  }

  const channels: Channel[] = (chRows ?? []).map((r: any) => ({
    id: String(r.id),
    name: r.name ?? null,
    description: r.description ?? null,
    logo_url: r.logo_url ?? null, // <-- logo_url only
  }));

  // 2) Programs for the guide (current + near future). Read-only.
  //    We fetch a window that safely includes “now” and near future.
  const now = new Date();
  const windowStart = new Date(now.getTime() - 2 * 3600_000).toISOString(); // 2 hours back
  const windowEnd   = new Date(now.getTime() + 6 * 3600_000).toISOString(); // 6 hours forward

  const { data: progRows, error: progErr } = await supabase
    .from("programs")
    .select("id, channel_id, title, start_time, duration, end_time")
    .gte("start_time", windowStart)
    .lte("start_time", windowEnd)
    .order("start_time", { ascending: true })
    .limit(1000);

  // If your current program started before windowStart, it won’t show up.
  // To cover that, we can also fetch the last item before windowStart per channel (cheap fallback).
  let programs: Program[] = (progRows ?? []) as any;

  if (!progErr) {
    // Build a map channel_id -> latest program before windowStart (optional)
    const { data: prevRows } = await supabase
      .from("programs")
      .select("id, channel_id, title, start_time, duration, end_time")
      .lt("start_time", windowStart)
      .order("start_time", { ascending: false })
      .limit(200);
    if (prevRows?.length) programs = [...programs, ...(prevRows as any)];
  }

  // Helper to compute end time from duration or end_time
  const calcEnd = (p: Program) => {
    const start = p.start_time ? new Date(p.start_time) : null;
    if (!start) return null;
    if (p.duration && p.duration > 0) return new Date(start.getTime() + p.duration * 1000);
    if (p.end_time) return new Date(p.end_time);
    return null;
  };

  // Build a quick lookup per channel
  const byChannel = new Map<string, Program[]>();
  for (const p of programs) {
    const key = String(p.channel_id);
    if (!byChannel.has(key)) byChannel.set(key, []);
    byChannel.get(key)!.push(p);
  }
  // Sort each channel’s programs by start_time asc
  for (const [k, list] of byChannel.entries()) {
    list.sort((a, b) => {
      const sa = a.start_time ? new Date(a.start_time).getTime() : 0;
      const sb = b.start_time ? new Date(b.start_time).getTime() : 0;
      return sa - sb;
    });
  }

  // For each channel, pick “Now” (where now is between start and end), and “Next”
  const guide = channels.map((ch) => {
    const list = byChannel.get(String(ch.id)) ?? [];
    const nowProg =
      list.find((p) => {
        const s = p.start_time ? new Date(p.start_time) : null;
        const e = calcEnd(p);
        return s && e && now >= s && now < e;
      }) ||
      // If nothing matches, fall back to the latest program that started before now
      [...list].reverse().find((p) => (p.start_time ? new Date(p.start_time) <= now : false)) ||
      null;

    const nextProg =
      nowProg
        ? list.find((p) => p.start_time && new Date(p.start_time) > new Date(nowProg.start_time!))
        : list.find((p) => p.start_time && new Date(p.start_time) >= now);

    const titleNow = nowProg?.title ?? "Standby Programming";
    const sNow = nowProg?.start_time ? new Date(nowProg.start_time) : null;
    const eNow = nowProg ? calcEnd(nowProg) : null;
    const rangeNow =
      sNow && eNow ? `${fmtTime(sNow)} – ${fmtTime(eNow)}` : sNow ? `${fmtTime(sNow)} – …` : "—";

    return {
      channel: ch,
      nowTitle: titleNow,
      nowRange: rangeNow,
      nextTitle: nextProg?.title ?? null,
    };
  });

  return (
    <div className="pt-14 min-h-screen">
      {/* Header */}
      <section className="px-4 md:px-10 py-8 md:py-10 border-b border-gray-800 bg-[radial-gradient(ellipse_at_top,rgba(239,68,68,0.15),rgba(0,0,0,0))]">
        <h1 className="text-3xl md:text-4xl font-extrabold">Black Truth TV</h1>
        <p className="text-gray-300 mt-2 max-w-2xl">
          Streaming live and on-demand. Choose a channel to start watching.
        </p>
      </section>

      {/* Horizontal TV Guide */}
      <section className="px-4 md:px-10 py-4 border-b border-gray-800">
        <h2 className="text-lg font-semibold mb-3">On Now</h2>
        <div className="overflow-x-auto">
          <div className="flex gap-3 pr-3">
            {guide.map(({ channel, nowTitle, nowRange, nextTitle }) => (
              <GuideItem
                key={channel.id}
                channel={channel}
                nowTitle={nowTitle}
                nowRange={nowRange}
                nextTitle={nextTitle}
                href={`/watch/${channel.id}`}
              />
            ))}
          </div>
        </div>
      </section>

      {/* Channels grid */}
      <section className="px-4 md:px-10 py-6">
        {channels.length === 0 ? (
          <div className="text-gray-400">No channels available.</div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {channels.map((ch) => (
              <ChannelCard key={ch.id} ch={ch} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
