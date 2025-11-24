// app/app/page.tsx
import Link from "next/link";
import { supabase } from "@/lib/supabase";

async function getSummary() {
  try {
    const [{ count: channelCount }, { count: programCount }] = await Promise.all([
      supabase.from("channels").select("id", { count: "exact", head: true }),
      supabase.from("programs").select("id", { count: "exact", head: true }),
    ]);

    return {
      channels: channelCount ?? 0,
      programs: programCount ?? 0,
    };
  } catch (e) {
    console.error("Summary load error:", e);
    return { channels: 0, programs: 0 };
  }
}

export default async function AppPage() {
  const summary = await getSummary();

  return (
    <div className="min-h-screen bg-gradient-to-b from-black via-slate-950 to-black text-white">
      <main className="max-w-6xl mx-auto px-4 pt-20 pb-16 space-y-10">
        {/* HEADER */}
        <section className="space-y-3">
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight">
            Black Truth TV — Member Hub
          </h1>
          <p className="text-sm md:text-base text-slate-300 max-w-2xl">
            Welcome inside the network. From here you can jump to live channels, Freedom
            School lessons, and on-demand specials.
          </p>
        </section>

        {/* TODAY SUMMARY BAR */}
        <section className="rounded-2xl border border-slate-800 bg-slate-900/80 px-4 py-3 md:px-6 md:py-4 shadow-lg flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Today on Black Truth TV
            </p>
            <p className="text-sm text-slate-200">
              {summary.channels > 0 || summary.programs > 0 ? (
                <>
                  <span className="font-semibold text-amber-300">
                    {summary.channels}
                  </span>{" "}
                  channels ·{" "}
                  <span className="font-semibold text-amber-300">
                    {summary.programs}
                  </span>{" "}
                  scheduled programs
                </>
              ) : (
                "Channel and schedule summary is loading…"
              )}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link href="/channels">
              <button className="rounded-full border border-red-500/70 bg-red-600/80 px-4 py-1.5 text-xs font-semibold shadow hover:bg-red-700/90 transition">
                🔴 Go to Live Network
              </button>
            </Link>
            <Link href="/freedom-school">
              <button className="rounded-full border border-amber-500/70 bg-amber-500/90 px-4 py-1.5 text-xs font-semibold text-black shadow hover:bg-amber-400 transition">
                📚 Freedom School
              </button>
            </Link>
          </div>
        </section>

        {/* MAIN GRID */}
        <section className="grid gap-6 md:grid-cols-2">
          {/* Live Channels */}
          <Link href="/channels" className="group">
            <div className="h-full rounded-2xl border border-slate-800 bg-gradient-to-br from-red-800/40 via-slate-950 to-black p-5 shadow-lg transition group-hover:border-red-400/80 group-hover:shadow-red-900/40">
              <div className="flex items-center justify-between gap-3 mb-3">
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <span className="inline-flex h-2 w-2 rounded-full bg-red-500 animate-pulse" />
                  Live Network
                </h2>
                <span className="text-[11px] uppercase tracking-wide text-slate-300">
                  24/7 Channels
                </span>
              </div>
              <p className="text-sm text-slate-200 mb-3">
                Flip through all Black Truth TV channels, including Resistance TV,
                Construction Queen TV, Freedom School, and more.
              </p>
              <p className="text-xs text-slate-400">
                Click to open the full channel grid and choose where to watch.
              </p>
            </div>
          </Link>

          {/* Freedom School */}
          <Link href="/freedom-school" className="group">
            <div className="h-full rounded-2xl border border-slate-800 bg-gradient-to-br from-emerald-800/30 via-slate-950 to-black p-5 shadow-lg transition group-hover:border-emerald-400/80 group-hover:shadow-emerald-900/40">
              <div className="flex items-center justify-between gap-3 mb-3">
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <span className="text-lg">📚</span>
                  Freedom School Library
                </h2>
                <span className="text-[11px] uppercase tracking-wide text-slate-300">
                  Lessons &amp; Study
                </span>
              </div>
              <p className="text-sm text-slate-200 mb-3">
                Watch lessons, listen to lectures, and download study packets from the
                Freedom School library.
              </p>
              <p className="text-xs text-slate-400">
                Video, audio, and PDF content all in one virtual classroom.
              </p>
            </div>
          </Link>

          {/* On-Demand */}
          <Link href="/on-demand" className="group">
            <div className="h-full rounded-2xl border border-slate-800 bg-gradient-to-br from-indigo-700/30 via-slate-950 to-black p-5 shadow-lg transition group-hover:border-indigo-400/80 group-hover:shadow-indigo-900/40">
              <div className="flex items-center justify-between gap-3 mb-3">
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <span className="text-lg">🎬</span>
                  On-Demand Collection
                </h2>
                <span className="text-[11px] uppercase tracking-wide text-slate-300">
                  Specials &amp; Series
                </span>
              </div>
              <p className="text-sm text-slate-200 mb-3">
                Binge full series, documentaries, and special features without waiting
                for the live schedule.
              </p>
              <p className="text-xs text-slate-400">
                Perfect when you want to go deep on one topic.
              </p>
            </div>
          </Link>

          {/* News / Live Channel 21 */}
          <Link href="/watch/21" className="group">
            <div className="h-full rounded-2xl border border-slate-800 bg-gradient-to-br from-slate-700/40 via-slate-950 to-black p-5 shadow-lg transition group-hover:border-slate-400/80 group-hover:shadow-slate-900/40">
              <div className="flex items-center justify-between gap-3 mb-3">
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <span className="text-lg">📰</span>
                  Daily News &amp; Live Channel 21
                </h2>
                <span className="text-[11px] uppercase tracking-wide text-slate-300">
                  Black Truth TV Report
                </span>
              </div>
              <p className="text-sm text-slate-200 mb-3">
                Jump straight into Channel 21 — your live stream that mirrors the YouTube
                news feed.
              </p>
              <p className="text-xs text-slate-400">
                Use this tile as your quick launch to the live news channel.
              </p>
            </div>
          </Link>
        </section>
      </main>
    </div>
  );
}
