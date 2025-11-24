// app/breaking-news/page.tsx

import Link from "next/link";

type BreakingStory = {
  id: string;
  tag?: "BREAKING" | "DEVELOPING" | "UPDATE";
  title: string;
  summary: string;
  note?: string;
  watchUrl?: string;   // optional YouTube or /watch/21 timestamp link
  sourceUrl?: string;  // optional external article / doc link
};

const breakingStories: BreakingStory[] = [
  {
    id: "democracy-on-trial",
    tag: "BREAKING",
    title: "Democracy on Trial: Fallout from the Trump Cases",
    summary:
      "Live breakdown of how the criminal cases and appeals are reshaping the 2024 race, and what it means for Black voters.",
    note: "Streaming tonight on Channel 21 and YouTube.",
    watchUrl: "/watch/21",
  },
  {
    id: "funding-hostage",
    tag: "DEVELOPING",
    title: "41 Days of Hostage Politics over Federal Funding",
    summary:
      "House leadership playing games with people’s paychecks, housing, and food while pretending to fight ‘waste’.",
  },
];

const recentStories: BreakingStory[] = [
  {
    id: "wiretap-immunity",
    title: "Wiretaps, Immunity & Who the Law Really Protects",
    summary:
      "Debate over whether members of Congress can sue over their own surveillance while communities get no protection.",
  },
  {
    id: "voting-rights-rollback",
    title: "Modern Voter Suppression 2.0",
    summary:
      "Comparing today’s laws to Jim Crow tactics — purges, ID laws, and quiet rollbacks of Black political power.",
  },
];

export default function BreakingNewsHub() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-black via-slate-950 to-black text-white">
      <main className="max-w-6xl mx-auto px-4 pt-20 pb-16 space-y-10">
        {/* HEADER / HERO */}
        <section className="space-y-4">
          <div className="space-y-2">
            <p className="text-xs font-semibold tracking-[0.18em] uppercase text-red-400">
              Channel 21 · Live News
            </p>
            <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight">
              Black Truth TV — Breaking News Hub
            </h1>
            <p className="text-sm md:text-base text-slate-300 max-w-2xl">
              Central hub for Channel 21: live coverage, key receipts, and
              context on the stories shaping Black life in America right now.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link href="/watch/21">
              <button
                className="inline-flex items-center gap-2 rounded-full border border-red-500/70 
                           bg-red-600/90 px-4 py-1.5 text-xs md:text-sm font-semibold 
                           shadow hover:bg-red-700 transition"
              >
                <span className="inline-flex h-2 w-2 rounded-full bg-white animate-pulse" />
                🔴 Watch Channel 21 Live
              </button>
            </Link>

            <Link href="/app">
              <button
                className="inline-flex items-center gap-2 rounded-full border border-slate-600 
                           bg-slate-800/80 px-4 py-1.5 text-xs md:text-sm font-semibold 
                           text-slate-100 hover:bg-slate-700 transition"
              >
                ⬅ Back to Member Hub
              </button>
            </Link>
          </div>
        </section>

        {/* BREAKING BOARD */}
        <section className="grid gap-6 md:grid-cols-3">
          {/* Left: big breaking stack */}
          <div className="md:col-span-2 space-y-4">
            <h2 className="text-lg font-semibold tracking-tight flex items-center gap-2">
              <span className="inline-flex h-2 w-2 rounded-full bg-red-500 animate-pulse" />
              Breaking Right Now
            </h2>

            <div className="space-y-3">
              {breakingStories.map((story) => (
                <article
                  key={story.id}
                  className="rounded-xl border border-red-700/60 bg-red-950/40 
                             px-4 py-3 shadow-md"
                >
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <div className="flex items-center gap-2">
                      {story.tag && (
                        <span className="inline-flex items-center rounded-full 
                                         border border-red-400/70 bg-red-700/70 
                                         px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide">
                          {story.tag}
                        </span>
                      )}
                      <span className="text-[11px] text-red-200/80 uppercase tracking-wide">
                        Channel 21 · Black Political Desk
                      </span>
                    </div>
                  </div>

                  <h3 className="text-base md:text-lg font-bold mb-1">
                    {story.title}
                  </h3>
                  <p className="text-xs md:text-sm text-red-50/90 mb-2">
                    {story.summary}
                  </p>

                  {story.note && (
                    <p className="text-[11px] text-red-200/90 mb-2">
                      {story.note}
                    </p>
                  )}

                  <div className="flex flex-wrap gap-2 text-[11px]">
                    {story.watchUrl && (
                      <Link href={story.watchUrl}>
                        <span className="inline-flex items-center gap-1 rounded-full 
                                         bg-black/60 px-3 py-1 font-semibold text-amber-300 
                                         hover:bg-black/80 cursor-pointer">
                          ▶ Watch segment
                        </span>
                      </Link>
                    )}
                    {story.sourceUrl && (
                      <a
                        href={story.sourceUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 rounded-full 
                                   border border-slate-500/70 px-3 py-1 text-slate-200 
                                   hover:bg-slate-800/80"
                      >
                        🔗 Source / Receipts
                      </a>
                    )}
                  </div>
                </article>
              ))}
            </div>
          </div>

          {/* Right: “What’s playing” + quick notes */}
          <aside className="space-y-4">
            <div className="rounded-xl border border-slate-700 bg-slate-900/70 p-4">
              <h3 className="text-sm font-semibold mb-1.5">
                What’s Playing on Channel 21
              </h3>
              <p className="text-xs text-slate-300 mb-2">
                Channel 21 mirrors your live YouTube streams plus special
                news blocks produced for Black Truth TV.
              </p>
              <ul className="text-xs text-slate-200 space-y-1.5">
                <li>• Live breakdowns of national politics</li>
                <li>• Historic receipts from archives & docs</li>
                <li>• Commentary focused on Black communities</li>
              </ul>
            </div>

            <div className="rounded-xl border border-slate-700 bg-slate-900/70 p-4">
              <h3 className="text-sm font-semibold mb-1.5">
                How to Use This Page
              </h3>
              <p className="text-xs text-slate-300">
                Use this hub as the show notes for your lives: add key
                talking points, links, and follow-up actions after each
                Channel 21 broadcast.
              </p>
            </div>
          </aside>
        </section>

        {/* RECENTLY COVERED */}
        <section className="space-y-3">
          <h2 className="text-lg font-semibold tracking-tight">
            Recently Covered on Channel 21
          </h2>
          <div className="space-y-2">
            {recentStories.map((story) => (
              <article
                key={story.id}
                className="rounded-lg border border-slate-700 bg-slate-900/60 
                           px-4 py-3 text-sm"
              >
                <h3 className="font-semibold mb-1">{story.title}</h3>
                <p className="text-xs text-slate-300">{story.summary}</p>
              </article>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
