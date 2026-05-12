// app/about/page.tsx
import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "About | Black Truth TV",
  description:
    "Why Black Truth TV exists: a private members' network for truth, history, culture, independent voices, and community uplift — built to outlast the takedowns.",
};

const LOGO_URL =
  "https://msllqpnxwbugvkpnquwx.supabase.co/storage/v1/object/public/brand/blacktruth1.jpeg";

export default function AboutPage() {
  return (
    <main className="min-h-screen bg-black text-white">
      {/* ===== HERO (brand gradient + logo) ===== */}
      <section className="relative overflow-hidden">
        {/* brandy glow */}
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(900px_450px_at_15%_-10%,rgba(168,85,247,0.25),transparent_60%),radial-gradient(700px_350px_at_85%_-10%,rgba(234,179,8,0.22),transparent_60%)]" />
        {/* deep purple → black gradient band */}
        <div className="relative px-6 md:px-10 py-14 md:py-20 border-b border-white/10 bg-gradient-to-b from-[#2a0f3c] via-[#160a26] to-[#000]">
          <div className="max-w-6xl mx-auto grid md:grid-cols-[280px_1fr] gap-8 items-center">
            {/* Logo */}
            <div className="flex justify-center md:justify-start">
              <div className="relative w-[240px] h-[240px] md:w-[260px] md:h-[260px] rounded-2xl bg-black/40 ring-1 ring-white/10 overflow-hidden shadow-[0_0_80px_-20px_rgba(234,179,8,.35)]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={LOGO_URL}
                  alt="Black Truth TV Network"
                  className="object-contain w-full h-full p-4"
                />
              </div>
            </div>

            {/* Title + intro */}
            <div>
              {/* Private network pill */}
              <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/40 bg-amber-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-amber-200 mb-4">
                <span className="inline-flex h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />
                Private Members&apos; Network
              </div>

              <h1 className="text-3xl md:text-5xl font-extrabold leading-tight tracking-tight">
                <span className="bg-clip-text text-transparent bg-gradient-to-r from-[#facc15] via-[#fde68a] to-white">
                  Black Truth TV
                </span>
              </h1>
              <p className="mt-4 text-white/85 max-w-3xl text-base md:text-lg">
                Unfiltered, unbought, uninterrupted. 24/7 programming dedicated to
                truth, culture, history, and community uplift — protected by a
                private network so the content can&apos;t be taken down.
              </p>

              <div className="mt-7 flex flex-wrap gap-3">
                <Link
                  href="/request-access"
                  className="inline-flex items-center rounded-lg bg-[#facc15] text-black px-4 py-2 text-sm font-semibold hover:bg-[#f5c20a]"
                >
                  Join the Network — Free
                </Link>
                <Link
                  href="/guide"
                  className="inline-flex items-center rounded-lg border border-white/25 px-4 py-2 text-sm font-semibold hover:bg-white/10"
                >
                  See What&rsquo;s On
                </Link>
              </div>
            </div>
          </div>

          {/* Mission checklist strip */}
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
                  className="flex items-start gap-3 rounded-xl bg-white/5 ring-1 ring-white/10 px-4 py-3 backdrop-blur-sm"
                >
                  <span
                    aria-hidden
                    className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/25 ring-1 ring-emerald-400/40"
                  >
                    <span className="text-emerald-300 text-xs">✔</span>
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

      {/* ===== Why We Exist / What you'll find ===== */}
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

          <div className="rounded-xl border border-white/10 bg-white/5 p-5">
            <h4 className="text-lg font-semibold">What you&rsquo;ll find here</h4>
            <ul className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2 text-white/80 text-sm">
              <li>• Documentaries &amp; archival series</li>
              <li>• Freedom School content</li>
              <li>• Music blocks &amp; culture shows</li>
              <li>• Community conversations</li>
              <li>• History, politics, and analysis</li>
              <li>• Live broadcasts &amp; specials</li>
            </ul>
          </div>
        </div>
      </section>

      {/* ===== Why We're a Private Network ===== */}
      <section className="px-6 md:px-10 py-14 border-b border-white/10 bg-gradient-to-b from-black via-[#0a0410] to-black">
        <div className="max-w-6xl mx-auto">
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-300/90">
            Why we&rsquo;re a private network
          </p>
          <h2 className="mt-2 text-2xl md:text-4xl font-extrabold tracking-tight">
            Built so it can&rsquo;t be taken down.
          </h2>

          <div className="mt-6 grid md:grid-cols-[1.4fr_1fr] gap-8 items-start">
            <div className="space-y-4 text-white/85 leading-relaxed">
              <p>
                Every major platform — YouTube, TikTok, Facebook — has demonetized,
                flagged, or removed Black truth-tellers. Algorithms suppress what
                should reach us. Coordinated flag campaigns disappear content
                overnight. The history we tell does not survive on platforms that
                profit from burying it.
              </p>
              <p>
                Black Truth TV was built differently. As a members&rsquo; network on
                independent infrastructure, the archive cannot be silenced by a
                flag, an advertiser, or a policy change. Members fund the platform.
                The platform serves the community. The content stays where it
                belongs — accessible, protected, and free of algorithmic
                gatekeeping.
              </p>
              <p className="text-white/70">
                This is what &ldquo;independent&rdquo; actually means: not owned, not
                pressured, not removable.
              </p>
            </div>

            <div className="space-y-3">
              <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                <div className="text-[#facc15] text-xs font-bold uppercase tracking-wide mb-1">
                  Independent
                </div>
                <p className="text-sm text-white/75 leading-relaxed">
                  No corporate parent. No outside advertisers shaping the lineup.
                </p>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                <div className="text-[#facc15] text-xs font-bold uppercase tracking-wide mb-1">
                  Member-funded
                </div>
                <p className="text-sm text-white/75 leading-relaxed">
                  Subscriptions pay for the streams, servers, and archive. The
                  community owns the experience.
                </p>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                <div className="text-[#facc15] text-xs font-bold uppercase tracking-wide mb-1">
                  Protected
                </div>
                <p className="text-sm text-white/75 leading-relaxed">
                  Moderated, members-only, with a documented takedown response
                  process for legitimate copyright claims.
                </p>
              </div>
            </div>
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
              desc="Scheduled channels that run around the clock. When a slot is open, our curated standby keeps the stream alive."
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
            <li>• Tell the truth, even when it&rsquo;s uncomfortable.</li>
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
          <p className="mt-4 text-white/80 max-w-3xl">
            Start with the free tier — 10 channels, no card required. Upgrade to
            Member for the full archive whenever you&rsquo;re ready. Cancel anytime.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/request-access"
              className="inline-flex items-center rounded-lg bg-[#facc15] text-black px-4 py-2 text-sm font-semibold hover:bg-[#f5c20a]"
            >
              Request Free Access
            </Link>
            <Link
              href="/membership"
              className="inline-flex items-center rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-2 text-sm font-semibold text-amber-100 hover:bg-amber-500/20"
            >
              See Membership Plans
            </Link>
            <Link
              href="/guide"
              className="inline-flex items-center rounded-lg border border-white/25 px-4 py-2 text-sm font-semibold hover:bg-white/10"
            >
              Open the Guide
            </Link>
          </div>
        </div>
      </section>

      {/* ===== Contact ===== */}
      <section className="px-6 md:px-10 py-12 border-b border-white/10">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-2xl md:text-3xl font-bold">Get Involved</h2>
          <p className="mt-4 text-white/80">
            Questions, licensing, content submissions, partnerships, or press
            inquiries? We&rsquo;d love to hear from you.
          </p>
          <div className="mt-4 text-white/80">
            <a href="mailto:director@sfjfamilyservices.org" className="underline hover:text-amber-300">
              director@sfjfamilyservices.org
            </a>
          </div>

          <p className="mt-6 text-xs text-white/50 leading-relaxed max-w-2xl">
            Black Truth TV is operated independently by SF Johnson Consulting &amp;
            Construction Services. We maintain a documented DMCA-compliant
            takedown response process for legitimate copyright claims.
          </p>

          <div className="mt-8">
            <Link
              href="/login"
              className="inline-flex items-center rounded-lg border border-white/25 px-4 py-2 text-sm font-semibold hover:bg-white/10"
            >
              ← Back to Sign In
            </Link>
          </div>
        </div>
      </section>

      {/* ===== Footer ===== */}
      <footer className="px-6 md:px-10 py-8">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row md:items-center md:justify-between gap-4 text-xs text-white/60">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <Link href="/contact" className="hover:text-amber-300">Contact</Link>
            <Link href="/privacy" className="hover:text-amber-300">Privacy</Link>
            <Link href="/copyright" className="hover:text-amber-300">Copyright / Takedown</Link>
          </div>
          <div className="text-white/40">
            © Black Truth TV. A private members&apos; network.
          </div>
        </div>
      </footer>
    </main>
  );
}

function OfferCard({ label, desc }: { label: string; desc: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-5 shadow-[0_0_50px_-25px_rgba(250,204,21,.35)]">
      <div className="text-[#facc15] text-xs font-bold tracking-wide uppercase mb-2">
        {label}
      </div>
      <p className="text-white/80">{desc}</p>
    </div>
  );
}
