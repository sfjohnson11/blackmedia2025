"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";

type Profile = {
  id: string;
  role: string | null;
  email: string | null;
  membership_status: string | null;
  grace_until: string | null;
};

const LOGO_URL =
  "https://msllqpnxwbugvkpnquwx.supabase.co/storage/v1/object/public/brand/blacktruth1.jpeg";

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Your admin email
  const ADMIN_EMAIL = "info@sfjohnsonconsulting.com";

  function hasAccess(profile: Profile | null) {
    // Paid users always allowed
    const status = String(profile?.membership_status || "free").toLowerCase();
    if (status === "active") return true;

    // Grace period allowed
    if (profile?.grace_until) {
      const graceUntil = new Date(profile.grace_until);
      if (new Date() < graceUntil) return true;
    }

    return false;
  }

  async function loadProfile(userId: string, userEmail?: string | null) {
    // Best: lookup by auth user id
    const byId = await supabase
      .from("user_profiles")
      .select("id, role, email, membership_status, grace_until")
      .eq("id", userId)
      .maybeSingle();

    if (byId.data) return byId.data as Profile;

    // Fallback: lookup by email (in case your profile id mapping differs)
    if (userEmail) {
      const byEmail = await supabase
        .from("user_profiles")
        .select("id, role, email, membership_status, grace_until")
        .eq("email", userEmail)
        .maybeSingle();

      if (byEmail.data) return byEmail.data as Profile;
    }

    return null;
  }

  async function handleSignIn(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);

    // Optional: handle ?redirect=/something
    let redirectTo: string | null = null;
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      redirectTo = params.get("redirect");
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error || !data.user) {
      console.error("Supabase signIn error:", error);
      setErrorMsg(error?.message ?? "Invalid email or password.");
      setLoading(false);
      return;
    }

    const user = data.user;

    // IMPORTANT: Approval in your system means they were invited,
    // which means they should have a user_profiles row.
    const profile = await loadProfile(user.id, user.email);

    // If no profile exists, they are NOT approved (they're only in sign_up_requests).
    if (!profile) {
      // prevent half-logged-in state
      await supabase.auth.signOut();
      router.push("/pending");
      setLoading(false);
      return;
    }

    // Determine role
    let role = profile.role ? String(profile.role) : null;

    // Safety: hard-wire admin email
    if (!role && user.email === ADMIN_EMAIL) role = "admin";

    const finalRole = (role || "member").toLowerCase().trim();

    // Honor ?redirect=
    if (redirectTo && redirectTo.startsWith("/")) {
      router.push(redirectTo);
      setLoading(false);
      return;
    }

    // Admin route
    if (finalRole === "admin") {
      router.push("/admin");
      setLoading(false);
      return;
    }

    // Member route with paywall

    router.push("/app");
    setLoading(false);
  }

  return (
    <div className="min-h-screen bg-black text-white">
      {/* ===== HERO + LOGIN ===== */}
      <section className="relative overflow-hidden border-b border-white/10">
        {/* brand glow */}
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(900px_450px_at_15%_-10%,rgba(168,85,247,0.25),transparent_60%),radial-gradient(700px_350px_at_85%_-10%,rgba(234,179,8,0.22),transparent_60%)]" />
        <div className="relative bg-gradient-to-b from-[#2a0f3c] via-[#160a26] to-black px-5 py-10 md:px-10 md:py-16">
          <div className="max-w-6xl mx-auto grid md:grid-cols-2 gap-10 md:gap-12 items-start">
            {/* LEFT: pitch */}
            <div>
              {/* Private network pill */}
              <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/40 bg-amber-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-amber-200">
                <span className="inline-flex h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />
                Private Members&apos; Network
              </div>

              {/* Logo + wordmark */}
              <div className="mt-5 flex items-center gap-4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={LOGO_URL}
                  alt="Black Truth TV"
                  className="w-16 h-16 md:w-20 md:h-20 rounded-xl bg-black/40 ring-1 ring-white/10 object-contain p-1.5"
                />
                <div>
                  <h1 className="text-3xl md:text-5xl font-extrabold leading-tight tracking-tight">
                    <span className="bg-clip-text text-transparent bg-gradient-to-r from-[#facc15] via-[#fde68a] to-white">
                      Black Truth TV
                    </span>
                  </h1>
                  <p className="text-xs md:text-sm uppercase tracking-[0.2em] text-white/60 mt-1">
                    Unfiltered. Unbought. Uninterrupted.
                  </p>
                </div>
              </div>

              {/* Hook */}
              <h2 className="mt-6 text-2xl md:text-3xl font-bold leading-snug">
                The history YouTube hides.
                <br />
                <span className="text-white/70">
                  30+ channels. 24/7. Built to outlast the takedowns.
                </span>
              </h2>

              {/* Value bullets */}
              <ul className="mt-6 space-y-3 text-sm md:text-base text-white/85">
                <li className="flex items-start gap-3">
                  <span className="mt-1 inline-flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/25 ring-1 ring-emerald-400/40 shrink-0">
                    <span className="text-emerald-300 text-xs">✔</span>
                  </span>
                  <span>
                    <span className="font-semibold text-white">10 free channels</span> — Resistance
                    TV, Black History Uncut, Black StoryTime, Sankofa Kids, Black Truth LIVE,
                    and more. No card required.
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="mt-1 inline-flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/25 ring-1 ring-emerald-400/40 shrink-0">
                    <span className="text-emerald-300 text-xs">✔</span>
                  </span>
                  <span>
                    <span className="font-semibold text-white">$9.99/month</span> unlocks all 30+
                    channels, Freedom School, and the full archive. Cancel anytime.
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="mt-1 inline-flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/25 ring-1 ring-emerald-400/40 shrink-0">
                    <span className="text-emerald-300 text-xs">✔</span>
                  </span>
                  <span>
                    <span className="font-semibold text-white">Private members&apos; network</span>{" "}
                    — moderated, ad-free, algorithm-free. The content stays here.
                  </span>
                </li>
              </ul>

              {/* Secondary CTA for cold traffic */}
              <div className="mt-7 flex flex-wrap gap-3">
                <Link
                  href="/request-access"
                  className="inline-flex items-center rounded-lg bg-[#facc15] text-black px-5 py-2.5 text-sm font-bold hover:bg-[#f5c20a] transition"
                >
                  New here? Request Free Access →
                </Link>
                <Link
                  href="/about"
                  className="inline-flex items-center rounded-lg border border-white/25 px-5 py-2.5 text-sm font-semibold hover:bg-white/10 transition"
                >
                  Learn More
                </Link>
              </div>
            </div>

            {/* RIGHT: login form */}
            <div className="md:sticky md:top-8">
              <div className="rounded-2xl border border-white/10 bg-[rgba(10,20,40,0.9)] p-6 md:p-7 shadow-[0_18px_45px_rgba(0,0,0,0.65)]">
                <h3 className="text-xl font-bold text-center">Member Sign In</h3>
                <p className="text-xs text-white/70 text-center mt-1">
                  Already approved? Welcome back.
                </p>

                {errorMsg && (
                  <div className="mt-4 rounded-lg border border-red-400/50 bg-red-950/40 px-3 py-2.5 text-xs text-red-100">
                    {errorMsg}
                  </div>
                )}

                <form onSubmit={handleSignIn} className="mt-5 grid gap-3">
                  <label className="text-xs">
                    <span className="block mb-1 text-white/80">Email</span>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full rounded-lg border border-slate-400/70 bg-slate-900/90 px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-400/80 focus:ring-1 focus:ring-amber-400/40"
                    />
                  </label>

                  <label className="text-xs">
                    <span className="block mb-1 text-white/80">Password</span>
                    <input
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full rounded-lg border border-slate-400/70 bg-slate-900/90 px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-400/80 focus:ring-1 focus:ring-amber-400/40"
                    />
                  </label>

                  <button
                    type="submit"
                    disabled={loading}
                    className="mt-2 rounded-full px-4 py-2.5 text-sm font-bold uppercase tracking-wide text-gray-900 shadow-[0_10px_25px_rgba(180,83,9,0.5)] disabled:opacity-60 disabled:cursor-not-allowed"
                    style={{
                      background:
                        "linear-gradient(135deg, #FFD700 0%, #fbbf24 35%, #f97316 80%)",
                    }}
                  >
                    {loading ? "Signing in…" : "Sign In"}
                  </button>
                </form>

                <div className="mt-4 flex items-center justify-between text-[11px] text-white/70">
                  <Link
                    href="/auth/reset-password"
                    className="hover:text-amber-300 underline-offset-2 hover:underline"
                  >
                    Forgot password?
                  </Link>
                  <Link
                    href="/request-access"
                    className="text-amber-300 hover:text-amber-200 underline-offset-2 hover:underline"
                  >
                    Need an account?
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===== FREE ANCESTRY TOOL (public, no account needed) ===== */}
      <section className="px-5 md:px-10 py-10 border-b border-white/10">
        <div className="max-w-5xl mx-auto rounded-2xl border border-amber-400/40 bg-gradient-to-br from-amber-500/10 via-black to-black p-6 md:p-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-amber-300">
              Free for the People · No account needed
            </p>
            <h2 className="text-xl md:text-2xl font-extrabold text-white mt-1">
              Free Ancestry Search — every record has a name. Find yours.
            </h2>
            <p className="text-sm text-white/70 mt-1.5 max-w-xl">
              Search census rolls, Freedmen&apos;s Bureau papers, newspapers, and cemetery records on real, free archives - no account needed to search. Our gift to the community.
            </p>
          </div>
          <Link
            href="/ancestry"
            className="inline-flex w-max items-center justify-center rounded-xl bg-amber-400 text-black px-5 py-2.5 text-sm font-bold hover:bg-amber-300 transition shrink-0"
          >
            🌳 Start Searching Free
          </Link>
        </div>
      </section>

      {/* ===== WHY PRIVATE NETWORK ===== */}
      <section className="px-5 md:px-10 py-12 md:py-16 border-b border-white/10">
        <div className="max-w-5xl mx-auto">
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-300/90">
            Why this is a private network
          </p>
          <h2 className="mt-2 text-2xl md:text-4xl font-extrabold tracking-tight">
            Built so it can&apos;t be taken down.
          </h2>
          <p className="mt-4 text-white/85 max-w-3xl leading-relaxed">
            YouTube demonetizes. TikTok shadowbans. Facebook flags. Every major
            platform has silenced Black truth-tellers — sometimes by algorithm,
            sometimes by coordinated mass-reports. Black Truth TV is the answer:
            a members-only network where the history we tell can&apos;t be erased
            by a flag or a policy change.
          </p>
          <p className="mt-4 text-white/75 max-w-3xl leading-relaxed">
            Members fund the archive. The archive belongs to the community. As
            long as we&apos;re here, this content stays here.
          </p>

          {/* Three-up reassurance grid */}
          <div className="mt-8 grid md:grid-cols-3 gap-4">
            <div className="rounded-xl border border-white/10 bg-white/5 p-5">
              <div className="text-[#facc15] text-xs font-bold tracking-wide uppercase mb-2">
                Independent
              </div>
              <p className="text-white/80 text-sm leading-relaxed">
                No corporate parent. No outside advertisers shaping the lineup.
                Members fund it; members own the experience.
              </p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 p-5">
              <div className="text-[#facc15] text-xs font-bold tracking-wide uppercase mb-2">
                Curated
              </div>
              <p className="text-white/80 text-sm leading-relaxed">
                Every channel is intentional. Programmed to teach, challenge, and
                heal — not chase clicks.
              </p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 p-5">
              <div className="text-[#facc15] text-xs font-bold tracking-wide uppercase mb-2">
                Protected
              </div>
              <p className="text-white/80 text-sm leading-relaxed">
                Members-only. Moderated. No public scrolling, no trolls, no
                algorithmic suppression of the content you came here for.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ===== WHAT YOU GET (FREE vs MEMBER teaser) ===== */}
      <section className="px-5 md:px-10 py-12 md:py-16 border-b border-white/10">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight">
            What&apos;s inside
          </h2>
          <p className="mt-3 text-white/75 max-w-3xl">
            30+ channels of truth-centered programming. Start free. Upgrade when
            you&apos;re ready for the full archive.
          </p>

          <div className="mt-7 grid sm:grid-cols-2 gap-5">
            {/* Free */}
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
              <div className="font-bold text-white text-lg mb-1">Free</div>
              <div className="text-3xl font-bold text-white/60 mb-4">$0</div>
              <ul className="space-y-2 text-sm text-white/80">
                <li className="flex items-center gap-2">
                  <span className="text-emerald-400">✓</span> 10 live channels
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-emerald-400">✓</span> Resistance TV
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-emerald-400">✓</span> Black History Uncut
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-emerald-400">✓</span> Black StoryTime + Sankofa Kids
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-emerald-400">✓</span> Black Truth LIVE
                </li>
              </ul>
              <Link
                href="/request-access"
                className="mt-5 inline-flex w-full items-center justify-center rounded-xl border border-white/25 px-4 py-2.5 text-sm font-semibold hover:bg-white/10 transition"
              >
                Request Free Access
              </Link>
            </div>

            {/* Member */}
            <div className="relative rounded-2xl border-2 border-amber-400 bg-white/5 p-6">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 bg-amber-400 text-black rounded-full text-[10px] font-bold uppercase tracking-widest">
                Full Access
              </div>
              <div className="font-bold text-white text-lg mb-1">Member</div>
              <div className="text-3xl font-bold text-amber-300 mb-1">
                $9.99<span className="text-base text-white/60">/mo</span>
              </div>
              <div className="text-xs text-white/50 mb-4">Cancel anytime</div>
              <ul className="space-y-2 text-sm text-white/80">
                <li className="flex items-center gap-2">
                  <span className="text-amber-300">✓</span> All 30+ live channels
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-amber-300">✓</span> Freedom School Channel
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-amber-300">✓</span> Construction education
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-amber-300">✓</span> Politics Then &amp; Now
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-amber-300">✓</span> Black Truth Music Experience
                </li>
              </ul>
              <Link
                href="/membership"
                className="mt-5 inline-flex w-full items-center justify-center rounded-xl bg-amber-400 text-black px-4 py-2.5 text-sm font-bold hover:bg-amber-300 transition"
              >
                See Membership Details
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ===== FOOTER ===== */}
      <footer className="px-5 md:px-10 py-8">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row md:items-center md:justify-between gap-4 text-xs text-white/60">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <Link href="/about" className="hover:text-amber-300">About</Link>
            <Link href="/ancestry" className="hover:text-amber-300">Free Ancestry Search</Link>
            <Link href="/contact" className="hover:text-amber-300">Contact</Link>
            <Link href="/privacy" className="hover:text-amber-300">Privacy</Link>
            <Link href="/copyright" className="hover:text-amber-300">Copyright / Takedown</Link>
          </div>
          <div className="text-white/40">
            © Black Truth TV. A private members&apos; network.
          </div>
        </div>
      </footer>
    </div>
  );
}
