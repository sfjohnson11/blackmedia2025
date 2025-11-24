// app/breaking-news/page.tsx

export const dynamic = "force-dynamic";

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
            stories, topics, and segments. Use this hub as your control room for the
            Black Truth TV news stream.
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

              {/* RESPONSIVE EMBED OF /watch/21 */}
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
                This is the same live feed you see at <span className="font-mono text-amber-300">/watch/21</span>,
                but wrapped in a news dashboard so you can send viewers here during
                special coverage.
              </p>
            </div>

            {/* QUICK NOTE AREA – you can customize this text */}
            <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4 text-sm text-slate-200 space-y-2">
              <p className="font-semibold text-slate-100">
                How to use this page in your show:
              </p>
              <ul className="list-disc pl-4 space-y-1 text-xs md:text-sm">
                <li>
                  Tell viewers:{" "}
                  <span className="font-mono text-amber-300">
                    &quot;Go to the Member Hub and click the Daily News &amp; Updates
                    card to watch along.&quot;
                  </span>
                </li>
                <li>Use the right-hand cards to track your A-block, B-block, and final commentary.</li>
                <li>Update this page text as your series evolves through the election cycle.</li>
              </ul>
            </div>
          </div>

          {/* RIGHT: STORY / SEGMENT CARDS (YOU FILL THESE IN) */}
          <div className="space-y-4">
            {/* Today’s Lead Story */}
            <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4 shadow">
              <h2 className="text-lg font-bold mb-1">Today&apos;s Lead Story</h2>
              <p className="text-xs uppercase tracking-wide text-slate-400 mb-2">
                A-Block • Open of the Show
              </p>
              <p className="text-sm text-slate-200">
                {/* ✏️ EDIT THIS TEXT IN CODE */}
                Use this block for your main headline. Example:{" "}
                <span className="italic">
                  &quot;Democracy on Trial: How the courts, Congress, and the White House
                  are reshaping 2025.&quot;
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
                {/* ✏️ EDIT THIS TEXT IN CODE */}
                Tie today&apos;s headline back to history for Black people. Example:
                connecting current voter suppression and surveillance debates to COINTELPRO,
                civil rights, and past court decisions.
              </p>
            </div>

            {/* Third Story / Call to Action */}
            <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4 shadow">
              <h2 className="text-lg font-bold mb-1">Closing Notes &amp; Call to Action</h2>
              <p className="text-xs uppercase tracking-wide text-slate-400 mb-2">
                C-Block • What Viewers Can Do
              </p>
              <p className="text-sm text-slate-200">
                {/* ✏️ EDIT THIS TEXT IN CODE */}
                Use this for action items: registering to vote, supporting legal defense
                funds, sharing Black Truth TV, or joining your newsletter for political
                updates.
              </p>
            </div>

            {/* Back button */}
            <button
              onClick={() => {
                if (typeof window !== "undefined") {
                  window.location.href = "/app";
                }
              }}
              className="w-full mt-2 rounded-full border border-slate-600 bg-slate-900/80 px-4 py-2 text-xs font-semibold text-slate-100 hover:bg-slate-800 hover:border-slate-400 transition"
            >
              ⬅ Back to Member Hub
            </button>
          </div>
        </section>
      </main>
    </div>
  );
}
