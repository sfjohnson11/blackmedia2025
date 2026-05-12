"use client";

import { useState, FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";

const LOGO_URL =
  "https://msllqpnxwbugvkpnquwx.supabase.co/storage/v1/object/public/brand/blacktruth1.jpeg";

export default function RequestAccessPage() {
  const supabase = createClient();
  const router = useRouter();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [agreed, setAgreed] = useState(false);

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleSignup(e: FormEvent) {
    e.preventDefault();
    setErrorMsg(null);

    // Client-side validation
    if (fullName.trim().length < 2) {
      setErrorMsg("Please enter your full name.");
      return;
    }
    if (password.length < 8) {
      setErrorMsg("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setErrorMsg("Passwords don't match. Try again.");
      return;
    }
    if (!agreed) {
      setErrorMsg("Please agree to the Terms and Privacy Policy to continue.");
      return;
    }

    setLoading(true);

    const redirectTo =
      typeof window !== "undefined"
        ? `${window.location.origin}/login?confirmed=true`
        : undefined;

    const { data, error } = await supabase.auth.signUp({
      email: email.trim().toLowerCase(),
      password,
      options: {
        data: { full_name: fullName.trim() },
        emailRedirectTo: redirectTo,
      },
    });

    if (error) {
      console.error("Signup error:", error);
      // Friendly error messaging
      const msg = error.message || "";
      if (msg.toLowerCase().includes("already") || msg.toLowerCase().includes("registered")) {
        setErrorMsg(
          "An account with that email already exists. Try signing in instead."
        );
      } else if (msg.toLowerCase().includes("password")) {
        setErrorMsg("Password is too weak. Please choose a stronger one.");
      } else {
        setErrorMsg(msg || "Something went wrong. Please try again.");
      }
      setLoading(false);
      return;
    }

    // If we got a session back, email confirmation is OFF — the user is
    // already signed in. Create the profile (in case the DB trigger didn't
    // fire for any reason) and send them straight into the app.
    if (data.user && data.session) {
      try {
        await supabase.from("user_profiles").upsert(
          {
            id: data.user.id,
            email: data.user.email,
            full_name: fullName.trim(),
            role: "member",
            membership_status: "free",
            welcome_started_at: new Date().toISOString(),
          },
          { onConflict: "id" }
        );
      } catch (err) {
        // Trigger handles this — don't block signup on this
        console.error("Profile upsert (non-blocking):", err);
      }

      // Straight into the member hub
      router.push("/app");
      return;
    }

    // No session means email confirmation is ON — show the check-email screen
    setSuccess(true);
    setLoading(false);
  }

  return (
    <div className="min-h-screen bg-black text-white">
      {/* ===== HERO ===== */}
      <section className="relative overflow-hidden border-b border-white/10">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(900px_450px_at_15%_-10%,rgba(168,85,247,0.25),transparent_60%),radial-gradient(700px_350px_at_85%_-10%,rgba(234,179,8,0.22),transparent_60%)]" />
        <div className="relative bg-gradient-to-b from-[#2a0f3c] via-[#160a26] to-black px-5 py-10 md:px-10 md:py-14">
          <div className="max-w-6xl mx-auto grid md:grid-cols-2 gap-10 md:gap-12 items-start">
            {/* LEFT: pitch */}
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/40 bg-amber-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-amber-200">
                <span className="inline-flex h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />
                Private Members&apos; Network
              </div>

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
                      Join the Network
                    </span>
                  </h1>
                  <p className="text-xs md:text-sm uppercase tracking-[0.2em] text-white/60 mt-1">
                    Free to start. No card required.
                  </p>
                </div>
              </div>

              <h2 className="mt-6 text-xl md:text-2xl font-bold leading-snug">
                Get free access to 10 live channels.
              </h2>
              <p className="mt-3 text-sm md:text-base text-white/80 leading-relaxed max-w-md">
                Resistance TV, Black History Uncut, Black StoryTime, Sankofa
                Kids, Black Truth LIVE, and more — running 24/7. Sign up with
                your email, confirm, and start watching.
              </p>

              <ul className="mt-6 space-y-3 text-sm text-white/80 max-w-md">
                <li className="flex items-start gap-3">
                  <span className="mt-1 inline-flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/25 ring-1 ring-emerald-400/40 shrink-0">
                    <span className="text-emerald-300 text-xs">✔</span>
                  </span>
                  <span>No credit card to join the free tier</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="mt-1 inline-flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/25 ring-1 ring-emerald-400/40 shrink-0">
                    <span className="text-emerald-300 text-xs">✔</span>
                  </span>
                  <span>Upgrade to all 30+ channels anytime for $9.99/mo</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="mt-1 inline-flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/25 ring-1 ring-emerald-400/40 shrink-0">
                    <span className="text-emerald-300 text-xs">✔</span>
                  </span>
                  <span>Your data isn&apos;t sold. Members-only, moderated, no ads.</span>
                </li>
              </ul>
            </div>

            {/* RIGHT: signup form or success state */}
            <div className="md:sticky md:top-8">
              <div className="rounded-2xl border border-white/10 bg-[rgba(10,20,40,0.9)] p-6 md:p-7 shadow-[0_18px_45px_rgba(0,0,0,0.65)]">
                {success ? (
                  /* ===== SUCCESS STATE ===== */
                  <div className="text-center">
                    <div className="mx-auto w-14 h-14 rounded-full bg-emerald-500/20 ring-1 ring-emerald-400/40 flex items-center justify-center text-3xl mb-4">
                      ✉️
                    </div>
                    <h3 className="text-xl font-bold mb-2">Check your email.</h3>
                    <p className="text-sm text-white/80 leading-relaxed mb-5">
                      We sent a confirmation link to{" "}
                      <span className="text-amber-300 font-semibold break-all">
                        {email}
                      </span>
                      . Click it to activate your account and start watching.
                    </p>

                    <div className="rounded-lg border border-white/10 bg-black/40 p-3 text-left mb-5">
                      <p className="text-[11px] uppercase tracking-wide text-amber-300 font-semibold mb-1">
                        Don&apos;t see it?
                      </p>
                      <p className="text-xs text-white/70 leading-relaxed">
                        Check your spam or promotions folder. Add{" "}
                        <span className="text-white">@blacktruthtv.org</span> to
                        your safe senders to make sure future notifications
                        reach you.
                      </p>
                    </div>

                    <Link
                      href="/login"
                      className="inline-flex w-full items-center justify-center rounded-full border border-amber-400/50 bg-amber-400 px-4 py-2.5 text-sm font-bold text-black hover:bg-amber-300 transition"
                    >
                      Go to Sign In →
                    </Link>
                  </div>
                ) : (
                  /* ===== SIGNUP FORM ===== */
                  <>
                    <h3 className="text-xl font-bold text-center">
                      Create Your Free Account
                    </h3>
                    <p className="text-xs text-white/70 text-center mt-1">
                      Takes 30 seconds. Free forever for the basic tier.
                    </p>

                    {errorMsg && (
                      <div className="mt-4 rounded-lg border border-red-400/50 bg-red-950/40 px-3 py-2.5 text-xs text-red-100">
                        {errorMsg}
                      </div>
                    )}

                    <form onSubmit={handleSignup} className="mt-5 grid gap-3">
                      <label className="text-xs">
                        <span className="block mb-1 text-white/80">Full name</span>
                        <input
                          type="text"
                          required
                          autoComplete="name"
                          value={fullName}
                          onChange={(e) => setFullName(e.target.value)}
                          className="w-full rounded-lg border border-slate-400/70 bg-slate-900/90 px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-400/80 focus:ring-1 focus:ring-amber-400/40"
                        />
                      </label>

                      <label className="text-xs">
                        <span className="block mb-1 text-white/80">Email</span>
                        <input
                          type="email"
                          required
                          autoComplete="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          className="w-full rounded-lg border border-slate-400/70 bg-slate-900/90 px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-400/80 focus:ring-1 focus:ring-amber-400/40"
                        />
                      </label>

                      <label className="text-xs">
                        <span className="block mb-1 text-white/80">
                          Password{" "}
                          <span className="text-white/50">(at least 8 characters)</span>
                        </span>
                        <input
                          type="password"
                          required
                          autoComplete="new-password"
                          minLength={8}
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          className="w-full rounded-lg border border-slate-400/70 bg-slate-900/90 px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-400/80 focus:ring-1 focus:ring-amber-400/40"
                        />
                      </label>

                      <label className="text-xs">
                        <span className="block mb-1 text-white/80">Confirm password</span>
                        <input
                          type="password"
                          required
                          autoComplete="new-password"
                          minLength={8}
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          className="w-full rounded-lg border border-slate-400/70 bg-slate-900/90 px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-400/80 focus:ring-1 focus:ring-amber-400/40"
                        />
                      </label>

                      <label className="flex items-start gap-2 text-[11px] text-white/75 mt-1 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={agreed}
                          onChange={(e) => setAgreed(e.target.checked)}
                          className="mt-0.5 accent-amber-400"
                        />
                        <span>
                          I agree to the{" "}
                          <Link
                            href="/terms"
                            target="_blank"
                            className="text-amber-300 hover:underline"
                          >
                            Terms
                          </Link>{" "}
                          and{" "}
                          <Link
                            href="/privacy"
                            target="_blank"
                            className="text-amber-300 hover:underline"
                          >
                            Privacy Policy
                          </Link>
                          .
                        </span>
                      </label>

                      <button
                        type="submit"
                        disabled={loading}
                        className="mt-3 rounded-full px-4 py-2.5 text-sm font-bold uppercase tracking-wide text-gray-900 shadow-[0_10px_25px_rgba(180,83,9,0.5)] disabled:opacity-60 disabled:cursor-not-allowed"
                        style={{
                          background:
                            "linear-gradient(135deg, #FFD700 0%, #fbbf24 35%, #f97316 80%)",
                        }}
                      >
                        {loading ? "Creating account…" : "Create Free Account"}
                      </button>
                    </form>

                    <p className="mt-4 text-center text-[11px] text-white/70">
                      Already have an account?{" "}
                      <Link
                        href="/login"
                        className="text-amber-300 hover:underline"
                      >
                        Sign in
                      </Link>
                    </p>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===== WHY PRIVATE NETWORK ===== */}
      <section className="px-5 md:px-10 py-12 md:py-14 border-b border-white/10">
        <div className="max-w-5xl mx-auto">
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-300/90">
            Why this is a private network
          </p>
          <h2 className="mt-2 text-2xl md:text-3xl font-extrabold tracking-tight">
            Built so it can&apos;t be taken down.
          </h2>
          <p className="mt-4 text-white/85 max-w-3xl leading-relaxed">
            YouTube demonetizes. TikTok shadowbans. Facebook flags. Every major
            platform has silenced Black truth-tellers. Black Truth TV is a
            members-only network on independent infrastructure — the content
            stays here because members keep it here. Free to start, $9.99/mo
            for the full archive, cancel anytime.
          </p>
        </div>
      </section>

      {/* ===== FOOTER ===== */}
      <footer className="px-5 md:px-10 py-8">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row md:items-center md:justify-between gap-4 text-xs text-white/60">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <Link href="/about" className="hover:text-amber-300">About</Link>
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
