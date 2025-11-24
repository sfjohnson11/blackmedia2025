// app/breaking-news/page.tsx
"use client";

import Link from "next/link";

export default function BreakingNewsPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-black via-slate-950 to-black text-white">
      <main className="max-w-6xl mx-auto px-4 pt-20 pb-16 space-y-10">
        {/* HEADER */}
        <section className="space-y-3">
          <p className="text-xs font-semibold tracking-[0.25em] uppercase text-red-400">
            Channel 21 • Black Truth TV Report
          </p>
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight flex items-center gap-2">
            <span className="inline-flex h-3 w-3 rounded-full bg-red-500 animate-pulse" />
            Breaking News Hub
          </h1>
          <p className="text-sm md:text-base text-slate-300 max-w-2xl">
            Live coverage on Channel 21 plus a quick snapshot of today&apos;s top
            stories, topics, and segments. Use this hub as your control room for
            the Black Truth TV news stream.
          </p>
        </section>

        {/* LAYOUT: LIVE PLAYER + STORY CARDS */}
        <section className="grid gap-8 lg:grid-cols-[minmax(0,2fr)_minmax(0,1.4fr)] items-start">
          {/* LEFT: LIVE PLAYER */}
          <div className="space-y-4">
            <div className="rounded-2xl border border-red-600/60 bg-gradient-to-br from-red-900/40 via-slate-950 to-black p-4 shadow-lg">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="inline-flex h-2.5 w-2.5 rounded-full bg-red-500 animate-pulse" />
                  <span className="text-xs font-semibold uppercase tracking-wide text-red-200">
                    Live Now • Channel 21
                  </span>
                </div>
                <span className="text-[11px] uppercase tracking-wide text-slate-300">
                  Democracy • Justice • Culture
                </span>
              </div>

              {/* EMBED WATCH/21 IN AN IFRAME */}
              <div className="relative w-full overflow-hidden rounded-xl border border-slate-800 bg-black shadow-md">
                <div className="relative w-full" style={{ paddingTop: "56.25%" }}>
                  <iframe
                    src="/watch/21"
                    title="Channel 21 Live"
                    className="absolute inset-0 h-full w-full border-0"
                    allow="autoplay; fullscreen; picture-in-picture"
                  />
                </div>
              </div>

              <p className="mt-3 text-xs text-slate-300">
                This is the same live feed as{" "}
                <span className="font-mono text-amber-300">/watch/21</span>, wrapped
                inside a news dashboard so you can send viewers here during special
                coverage.
              </p>
            </div>

            {/* NOTE AREA */}
            <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4 text-sm text-slate-200 space-y-2">
              <p className="font-semibold text-slate-100">
                How to tell viewers to find this:
              </p>
              <ul className="list-disc pl-4 space-y-1 text-xs md:text-sm">
                <li>
                  &quot;Log into the Member Hub and click the{' '}
                  <span className="font-semibold">Daily News &amp; Updates</span> card.&quot;
                </li>
                <li>Use this page as your control room while Channel 21 runs live.</li>
              </ul>
            </div>
          </div>

          {/* RIGHT: STORY / SEGMENT CARDS (EDIT TEXT AS YOU LIKE) */}
          <div className="space-y-4">
            {/* Lead Story */}
            <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4 shadow">
              <h2 className="text-lg font-bold mb-1">Today&apos;s Lead Story</h2>
              <p className="text-xs uppercase tracking-wide text-slate-400 mb-2">
                A-Block • Open of the Show
              </p>
              <p className="text-sm text-slate-200">
                Edit this text in the code for tonight&apos;s main headline. Example:
                <span className="italic">
                  {" "}
                  &quot;Democracy on Trial: The criminal cases, the courts, and the
                  consequences for our communities.&quot;
                </span>
              </p>
            </div>

            {/* Second Story */}
            <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4 shadow">
              <h2 className="text-lg font-bold mb-1">Second Story / Deep Dive</h2>
              <p className="text-xs uppercase tracking-wide text-slate-400 mb-2">
                B-Block • Historical Context
              </p>
              <p className="text-sm text-slate-200">
                Use this for your history segment. Tie today&apos;s news back to COINTELPRO,
                civil rights struggles, voting rights, or past administrations.
              </p>
            </div>

            {/* Call to Action */}
            <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4 shadow">
              <h2 className="text-lg font-bold mb-1">Closing Notes &amp; Call to Action</h2>
              <p className="text-xs uppercase tracking-wide text-slate-400 mb-2">
                C-Block • What Viewers Can Do
              </p>
              <p className="text-sm text-slate-200">
                Drop your action steps here: register, follow the Black Political
                Podcast, support legal defense funds, share the stream, etc.
              </p>
            </div>

            {/* Back button */}
            <Link href="/app" className="block">
              <button className="w-full mt-2 rounded-full border border-slate-600 bg-slate-900/80 px-4 py-2 text-xs font-semibold text-slate-100 hover:bg-slate-800 hover:border-slate-400 transition">
                ⬅ Back to Member Hub
              </button>
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}
