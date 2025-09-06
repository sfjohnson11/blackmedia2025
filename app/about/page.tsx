// app/about/page.tsx
import Link from "next/link";

export const metadata = {
  title: "About | Black Truth TV",
  description:
    "Learn how Black Truth TV works: 30+ scheduled channels, per-channel standby, and one YouTube Live channel.",
};

export default function AboutPage() {
  const exampleChannels = [
    { channel_id: 1, name: "Channel 1" },
    { channel_id: 2, name: "Channel 2" },
    { channel_id: 3, name: "Channel 3" },
    { channel_id: 4, name: "Channel 4" },
    { channel_id: 21, name: "Channel 21 (YouTube Live)" },
    { channel_id: 30, name: "Freedom School" }, // if your slug maps to 30
  ];

  return (
    <main className="min-h-screen bg-black text-white">
      {/* Hero */}
      <section className="px-6 md:px-10 py-12 md:py-16 border-b border-white/10 bg-gradient-to-b from-black to-zinc-900">
        <h1 className="text-3xl md:text-5xl font-bold tracking-tight">
          About Black Truth TV
        </h1>
        <p className="mt-3 text-white/70 max-w-3xl">
          Black Truth TV is a scheduled, multi-channel streaming network. We
          program shows into time slots in UTC. If a channel has no show at the
          current time, it stays on that channel’s standby video until the next
          program starts. Channel 21 is reserved for our YouTube Live feed.
        </p>

        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/"
            className="inline-flex items-center rounded-lg border border-white/20 px-3 py-2 text-sm hover:bg-white/10"
          >
            ← Back Home
          </Link>
          <Link
            href="/watch/3"
            className="inline-flex items-center rounded-lg bg-white text-black px-3 py-2 text-sm font-medium hover:bg-white/90"
          >
            Watch Channel 3
          </Link>
        </div>
      </section>

      {/* How it works */}
      <section className="px-6 md:px-10 py-10 border-b border-white/10">
        <h2 className="text-xl md:text-2xl font-semibold">How it works</h2>
        <ul className="mt-4 space-y-3 text-white/80">
          <li>
            <span className="font-medium text-white">Channels:</span> We offer
            ~30 numbered channels (<code className="text-white/90">1..30</code>)
            plus a special “Freedom School” channel.
          </li>
          <li>
            <span className="font-medium text-white">Scheduling (UTC):</span>{" "}
            Each program has a <code>start_time</code> (UTC) and{" "}
            <code>duration</code> in seconds. If “now” falls inside that window,
            the program plays automatically.
          </li>
          <li>
            <span className="font-medium text-white">Standby per channel:</span>{" "}
            Every channel has its own standby MP4 in its storage bucket (e.g.,{" "}
            <code>channel4/standby_blacktruthtv.mp4</code>). If no program is
            active or a video errors, we fall back to that channel’s standby.
          </li>
          <li>
            <span className="font-medium text-white">Channel 21 (Live):</span>{" "}
            When configured with a YouTube channel ID, Channel 21 embeds our
            YouTube Live feed.
          </li>
        </ul>
      </section>

      {/* Quick links */}
      <section className="px-6 md:px-10 py-10 border-b border-white/10">
        <h2 className="text-xl md:text-2xl font-semibold">Jump to a channel</h2>
        <p className="mt-2 text-white/70">
          These are examples. You can replace or extend them with your full
          lineup.
        </p>
        <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {exampleChannels.map((c) => (
            <Link
              key={c.id}
              href={`/watch/${c.id}`}
              className="rounded-xl border border-white/15 bg-zinc-950/80 hover:bg-zinc-900/80 p-4 transition"
            >
              <div className="text-sm text-white/60">/watch/{c.id}</div>
              <div className="mt-1 text-lg font-medium">{c.name}</div>
              <div className="mt-2 text-xs text-white/60">
                Plays the active program by UTC time; otherwise shows this
                channel’s standby video.
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Viewer tips / Troubleshooting */}
      <section className="px-6 md:px-10 py-10 border-b border-white/10">
        <h2 className="text-xl md:text-2xl font-semibold">Viewer tips</h2>
        <ul className="mt-4 space-y-3 text-white/80">
          <li>
            <span className="font-medium text-white">Autoplay & sound:</span>{" "}
            Browsers only autoplay muted. Click <em>Tap to unmute</em> or unmute
            the player to hear audio.
          </li>
          <li>
            <span className="font-medium text-white">Schedule timing:</span>{" "}
            Times are in UTC. A program will appear when its UTC window begins.
          </li>
          <li>
            <span className="font-medium text-white">If you see Standby:</span>{" "}
            It means no program is active right now or the file is loading.
            Standby plays until the next program starts.
          </li>
        </ul>
      </section>

      {/* Tech summary for admins (keep it brief, non-sensitive) */}
      <section className="px-6 md:px-10 py-10">
        <h2 className="text-xl md:text-2xl font-semibold">Under the hood</h2>
        <div className="mt-4 text-white/80 space-y-3">
          <p>
            This app is built with Next.js and Supabase. Each channel maps to a
            numeric ID; programs are read from the{" "}
            <code>programs</code> table and resolved to public storage URLs.
            Standby assets live per channel bucket. Channel 21 optionally embeds
            YouTube Live.
          </p>
          <p className="text-white/60 text-sm">
            For support or takedown requests, contact{" "}
            <a
              href="mailto:support@blacktruthtv.example"
              className="underline"
            >
              support@blacktruthtv.example
            </a>
            .
          </p>
        </div>
      </section>
    </main>
  );
}
