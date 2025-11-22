// app/app/page.tsx
import Link from "next/link";

export default function AppPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-black via-slate-950 to-black text-white">
      <div className="mx-auto max-w-5xl px-4 py-10 space-y-8">
        {/* HEADER / HERO */}
        <header className="space-y-3">
          <p className="text-xs uppercase tracking-[0.2em] text-amber-400">
            Black Truth TV • Member Hub
          </p>
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight">
            Welcome to your Black Truth TV member area.
          </h1>
          <p className="max-w-2xl text-sm md:text-base text-slate-300">
            Jump straight into live channels, Freedom School lessons, or your on-demand
            library. Use this page as your shortcut into the network.
          </p>
        </header>

        {/* QUICK ACTIONS */}
        <section className="grid gap-5 md:grid-cols-3">
          {/* 🔁 CHANGE IS HERE: link to /watch instead of / */}
          <Link
            href="/watch"
            className="group rounded-2xl border border-slate-800 bg-slate-950/70 p-5 shadow-lg hover:border-amber-400 hover:bg-slate-900/80 transition-colors"
          >
            <div className="mb-3 inline-flex rounded-full bg-amber-500/10 px-3 py-1 text-[11px] font-semibold text-amber-300">
              Live Channels
            </div>
            <h2 className="text-lg font-semibold mb-1 group-hover:text-amber-300">
              Watch Live Black Truth TV
            </h2>
            <p className="text-sm text-slate-300">
              Go to the main network home to choose channels, see what&apos;s on now,
              and browse the guide.
            </p>
          </Link>

          {/* Freedom School */}
          <Link
            href="/freedom-school"
            className="group rounded-2xl border border-slate-800 bg-slate-950/70 p-5 shadow-lg hover:border-emerald-400 hover:bg-slate-900/80 transition-colors"
          >
            <div className="mb-3 inline-flex rounded-full bg-emerald-500/10 px-3 py-1 text-[11px] font-semibold text-emerald-300">
              Freedom School
            </div>
            <h2 className="text-lg font-semibold mb-1 group-hover:text-emerald-300">
              Open Freedom School
            </h2>
            <p className="text-sm text-slate-300">
              Enter the virtual classroom to watch lessons, listen to audio, and
              download study packets.
            </p>
          </Link>

          {/* On-Demand */}
          <Link
            href="/on-demand"
            className="group rounded-2xl border border-slate-800 bg-slate-950/70 p-5 shadow-lg hover:border-sky-400 hover:bg-slate-900/80 transition-colors"
          >
            <div className="mb-3 inline-flex rounded-full bg-sky-500/10 px-3 py-1 text-[11px] font-semibold text-sky-300">
              Library
            </div>
            <h2 className="text-lg font-semibold mb-1 group-hover:text-sky-300">
              On-Demand Library
            </h2>
            <p className="text-sm text-slate-300">
              Browse on-demand documentaries, specials, and series available to members
              anytime.
            </p>
          </Link>
        </section>

        {/* FOOTER HINT */}
        <section className="mt-4 rounded-2xl border border-slate-800 bg-slate-950/60 px-4 py-3 text-xs text-slate-400">
          <p>
            Tip: Use the site navigation bar to move around the network at any time.
            This member hub is your shortcut back to the main areas of Black Truth TV.
          </p>
        </section>
      </div>
    </div>
  );
}
