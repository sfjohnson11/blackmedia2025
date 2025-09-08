// app/about/page.tsx
import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "About | Black Truth TV",
  description:
    "Why Black Truth TV exists: a 24/7 home for truth, history, culture, independent voices, and community uplift.",
};

export default function AboutPage() {
  return (
    <main className="min-h-screen bg-black text-white">
      {/* ===== Hero ===== */}
      <section className="relative overflow-hidden">
        {/* subtle gradient glow */}
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(600px_300px_at_10%_-10%,rgba(180,83,9,0.25),transparent_60%),radial-gradient(500px_250px_at_90%_-10%,rgba(147,51,234,0.18),transparent_60%)]" />
        <div className="px-6 md:px-10 py-14 md:py-20 border-b border-white/10 bg-zinc-900/30 relative">
          <div className="max-w-6xl mx-auto grid md:grid-cols-[280px_1fr] gap-8 items-center">
            {/* Logo */}
            <div className="flex justify-center md:justify-start">
              <div className="relative w-[240px] h-[240px] md:w-[260px] md:h-[260px] rounded-2xl bg-black/50 ring-1 ring-white/10 overflow-hidden">
                <Image
                  src="/blacktruth1.jpeg" // <— place your image in /public
                  alt="Black Truth TV Network"
                  fill
                  className="object-contain p-4"
                  priority
                />
              </div>
            </div>

            {/* Title + intro */}
            <div>
              {/* Keep your old svg if you want it */}
              {/*
              <img src="/logo-bttv.svg" alt="Black Truth TV" className="h-12 md:h-14 mb-4 opacity-90" />
              */}
              <h1 className="text-3xl md:text-5xl font-extrabold leading-tight tracking-tight">
                Black Truth TV
              </h1>
              <p className="mt-4 text-white/85 max-w-3xl text-base md:text-lg">
                We created Black Truth TV to center our stories—unfiltered, unbought,
                and uninterrupted. 24/7 programming dedicated to truth, culture,
                history, and community uplift.
              </p>

              <div className="mt-7 flex flex-wrap gap-3">
                <Link
                  href="/guide"
                  className="inline-flex items-center rounded-lg bg-white text-black px-4 py-2 text-sm font-semibold hover:bg-white/90"
                >
                  See What’s On
                </Link>
                <Link
                  href="/"
                  className="inline-flex items-center rounded-lg border border-white/25 px-4 py-2 text-sm font-semibold hover:bg-white/10"
                >
                  ← Back Home
                </Link>
              </div>
            </div>
          </div>

          {/* Mission checklist band (matches your graphic) */}
          <div className="max-w-6xl mx-auto mt-10">
            <div className="grid md:grid-cols-2 gap-3">
              {[
                "Our truth is not silenced.",
                "Our children see their greatness.",
                "Our heroes are honored, not erased.",
                "Our global family is reconnected.",
              ].map((line) => (
                <div
                  key={line}
                  className="flex items-start gap-3 rounded-xl bg-zinc-950/60 ring-1 ring-white/10 px-4 py-3"
                >
                  <span
                    aria-hidden
                    className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/20 ring-1 ring-emerald-500/40"
                  >
                    <span className="text-emerald-400 text-xs">✔</span>
                  </span>
                  <p className="text-white/85">{line}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ===== Our Mission ===== */}
      <section className="px-6 md:px-10 py-12 border-b border-white/10">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-2xl md:text-3xl font-bold">Our Mission</h2>
          <p className="mt-4 text-white/80 leading-relaxed">
            Black Truth TV exists to amplify Black truth—past, present, and future.
            We curate documentaries, lectures, conversations, music, and live events
            that inform, inspire, and empower. Our goal is simple: give people a
            place to learn, connect, and grow with programming you can trust.
          </p>
        </div>
      </section>

      {/* ===== Why We Exist / What you’ll find ===== */}
      <section className="px-6 md:px-10 py-12 border-b border-white/10">
        <div className="max-w-6xl mx-auto grid md:grid-cols-2 gap-8">
          <div>
            <h3 className="text-xl md:text-2xl font-semibold">Why We Exist</h3>
            <ul className="mt-4 space-y-3 text-white/80">
              <li>
                <span className="text-white font-medium">Representation with depth:</span>{" "}
                we center voices, histories, and perspectives too often minimized or ignored.
              </li>
              <li>
                <span className="text-white font-medium">Education that travels:</span>{" "}
                from Freedom School content to classic archives, learning is accessible 24/7.
              </li>
              <li>
                <span className="text-white font-medium">Community over clicks:</span>{" "}
                we program with intention, not algorithms.
              </li>
              <li>
                <span className="text-white font-medium">Independent truth:</span>{" "}
                built to be resilient—our commitment is to truth, not trends.
              </li>
            </ul>
          </div>

          <div className="rounded-xl border border-white/10 bg-zinc-950/60 p-5">
            <h4 className="text-lg font-semibold">What you’ll find here</h4>
            <ul className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2 text-white/80 text-sm">
              <li>• Documentaries & archival series</li>
              <li>• Freedom School content</li>
              <li>• Music blocks & culture shows</li>
              <li>• Community conversations</li>
              <li>• History, politics, and analysis</li>
              <li>• Live broadcasts & specials</li>
            </ul>
          </div>
        </div>
      </section>

      {/* ===== What We Offer ===== */}
      <section className="px-6 md:px-10 py-12 border-b border-white/10">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-2xl md:text-3xl font-bold">What We Offer</h2>
          <div className="mt-6 grid md:grid-cols-3 gap-4">
            <OfferCard
              label="24/7 Lineup"
              desc="Scheduled channels that run around the clock. When a slot is open, a curated standby holds the space—so the stream never goes dark."
            />
            <OfferCard
              label="Independent Curation"
              desc="We choose for quality and impact, not virality. Blocks are built to teach, challenge, and heal."
            />
            <OfferCard
              label="Community Focus"
              desc="From elders to young creators, we uplift voices across generations—and make space for new ones."
            />
          </div>
        </div>
      </section>

      {/* ===== Our Promise ===== */}
      <section className="px-6 md:px-10 py-12 border-b border-white/10">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-2xl md:text-3xl font-bold">Our Promise</h2>
          <ul className="mt-4 space-y-3 text-white/80">
            <li>• Tell the truth, even when it’s uncomfortable.</li>
            <li>• Honor our elders, protect our youth, and grow our collective knowledge.</li>
            <li>• Keep the stream consistent—day and night.</li>
            <li>• Listen to the community and evolve with intention.</li>
          </ul>
        </div>
      </section>

      {/* ===== How to Watch ===== */}
      <section className="px-6 md:px-10 py-12 border-b border-white/10">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-2xl md:text-3xl font-bold">How to Watch</h2>
          <p className="mt-4 text-white/80">
            Head to the guide to see what’s live right now, or jump straight into a channel.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/guide"
              className="inline-flex items-center rounded-lg bg-white text-black px-4 py-2 text-sm font-semibold hover:bg-white/90"
            >
              Open the Guide
            </Link>
            <Link
              href="/watch/21"
              className="inline-flex items-center rounded-lg border border-white/25 px-4 py-2 text-sm font-semibold hover:bg-white/10"
            >
              Watch Channel 21 (Live)
            </Link>
            <Link
              href="/watch/4"
              className="inline-flex items-center rounded-lg border border-white/25 px-4 py-2 text-sm font-semibold hover:bg-white/10"
            >
              Watch Channel 4
            </Link>
          </div>
        </div>
      </section>

      {/* ===== Contact ===== */}
      <section className="px-6 md:px-10 py-12">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-2xl md:text-3xl font-bold">Get Involved</h2>
          <p className="mt-4 text-white/80">
            Questions, licensing, or content submissions? We’d love to hear from you.
          </p>
          <div className="mt-4 text-white/80">
            <a href="mailto:director@sfjfamilyservices.org" className="underline">
              director@sfjfamilyservices.org
            </a>
          </div>

          <div className="mt-8">
            <Link
              href="/"
              className="inline-flex items-center rounded-lg border border-white/25 px-4 py-2 text-sm font-semibold hover:bg-white/10"
            >
              ← Back Home
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}

/* ---------- small card ---------- */
function OfferCard({ label, desc }: { label: string; desc: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-zinc-950/60 p-5">
      <div className="text-amber-300 text-xs font-bold tracking-wide uppercase mb-2">
        {label}
      </div>
      <p className="text-white/80">{desc}</p>
    </div>
  );
}
