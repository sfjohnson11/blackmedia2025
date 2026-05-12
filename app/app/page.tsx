"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";
import NewsTicker from "@/components/NewsTicker";
import NotificationBell from "@/components/notification-bell";

type Summary = { channels: number };

type Profile = {
  id: string;
  full_name?: string | null;
  email?: string | null;
  role?: string | null;
  membership_status?: string | null; // "active" | "unpaid" | etc.
  grace_until?: string | null;       // timestamp
  welcome_started_at?: string | null;
};

const STRIPE_UPGRADE_URL = "https://buy.stripe.com/7sY8wPekWcUp6IM6Rq6J314";

export default function AppPage() {
  const supabase = createClient();

  const [summary, setSummary] = useState<Summary | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(true);

  const [profile, setProfile] = useState<Profile | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);

  // Load channel summary
  useEffect(() => {
    async function loadSummary() {
      try {
        const { count, error } = await supabase
          .from("channels")
          .select("id", { count: "exact", head: true });

        if (error) {
          console.error("Channel count error:", error);
          setSummary({ channels: 0 });
        } else {
          setSummary({ channels: count ?? 0 });
        }
      } catch (e) {
        console.error("Summary load error:", e);
        setSummary({ channels: 0 });
      } finally {
        setLoadingSummary(false);
      }
    }
    loadSummary();
  }, [supabase]);

  // Load user profile
  useEffect(() => {
    let cancelled = false;

    (async () => {
      setProfileLoading(true);
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          if (!cancelled) setProfile(null);
          return;
        }

        const { data, error } = await supabase
          .from("user_profiles")
          .select(
            "id,full_name,email,role,membership_status,grace_until,welcome_started_at"
          )
          .eq("id", user.id)
          .maybeSingle();

        if (error) {
          console.error("Profile load error:", error);
          if (!cancelled) setProfile(null);
          return;
        }

        if (!cancelled) setProfile((data as Profile) ?? null);
      } finally {
        if (!cancelled) setProfileLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [supabase]);

  const isAdmin = useMemo(() => {
    const r = String(profile?.role ?? "").toLowerCase().trim();
    return r === "admin";
  }, [profile]);

  const status = useMemo(() => {
    return String(profile?.membership_status ?? "").toLowerCase().trim();
  }, [profile]);

  const isPaidActive = useMemo(() => {
    if (isAdmin) return true;
    return status === "active";
  }, [isAdmin, status]);

  const hasAccess = useMemo(() => {
    if (!profile) return false;
    return true;
  }, [profile]);

  const showUpgradeBanner = useMemo(() => {
    if (profileLoading) return false;
    if (!profile) return false;
    if (isAdmin) return false;
    return status !== "active";
  }, [profileLoading, profile, isAdmin, status]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-black via-slate-950 to-black text-white">
      <main className="max-w-6xl mx-auto px-4 pt-20 pb-16 space-y-10">
        {/* NEWS TICKER */}
        <NewsTicker />

        {/* HEADER */}
        <section className="space-y-3">
          <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/40 bg-amber-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-amber-200">
            <span className="inline-flex h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />
            Private Members&apos; Network
          </div>
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight">
            Black Truth TV — Member Hub
          </h1>
          <p className="text-sm md:text-base text-slate-300 max-w-2xl">
            You&apos;re inside the network. Unfiltered, unbought, uninterrupted —
            jump to live channels, Freedom School lessons, and on-demand specials.
            All here. All yours. 24/7.
          </p>
        </section>

        {/* QUICK LINKS — Profile / Favorites / Browse / Notifications */}
        <section className="flex flex-wrap items-center gap-2">
          <Link href="/favorites">
            <button className="rounded-full border border-pink-500/60 bg-pink-600/20 px-4 py-1.5 text-xs font-semibold text-pink-100 hover:bg-pink-600/40 transition">
              ❤️ My Favorites
            </button>
          </Link>
          <Link href="/profile">
            <button className="rounded-full border border-blue-500/60 bg-blue-600/20 px-4 py-1.5 text-xs font-semibold text-blue-100 hover:bg-blue-600/40 transition">
              👤 My Profile
            </button>
          </Link>
          <Link href="/browse">
            <button className="rounded-full border border-slate-500/60 bg-slate-800/60 px-4 py-1.5 text-xs font-semibold text-slate-100 hover:bg-slate-700 transition">
              🔍 Browse All
            </button>
          </Link>
          <NotificationBell className="text-slate-100 hover:text-white" />
        </section>

        {/* ✅ UPGRADE BANNER for free-tier users */}
        {showUpgradeBanner && (
          <section className="rounded-2xl border border-amber-500/30 bg-gradient-to-br from-amber-500/10 via-slate-950 to-black px-5 py-5 md:px-6 md:py-6 shadow-lg">
            <p className="text-xs font-semibold uppercase tracking-wide text-amber-300/90">
              You&apos;re on the Free tier
            </p>

            <h2 className="text-2xl font-extrabold tracking-tight mt-1">
              Unlock all 30+ channels — $9.99/month
            </h2>

            <p className="text-sm text-slate-200 mt-2 max-w-3xl">
              You&apos;re inside the network with free access to 10 channels.
              Upgrade to Member for the full lineup — Freedom School, Construction
              Education, Black Truth Music Experience, Politics Then &amp; Now,
              Teaching Truth TV, and the complete archive. Member subscriptions
              fund the platform and keep it independent.
            </p>

            <div className="mt-4 flex flex-wrap gap-2">
              <a href={STRIPE_UPGRADE_URL}>
                <button className="rounded-full border border-amber-500/50 bg-amber-500/90 px-4 py-2 text-xs font-semibold text-black shadow hover:bg-amber-400 transition">
                  Upgrade — $9.99/month
                </button>
              </a>

              <Link href="/membership">
                <button className="rounded-full border border-slate-500/70 bg-slate-800/90 px-4 py-2 text-xs font-semibold text-slate-100 shadow hover:bg-slate-700 transition">
                  See what&apos;s included
                </button>
              </Link>
            </div>

            <p className="text-xs text-slate-500 mt-3">
              Cancel anytime · Secure checkout via Stripe
            </p>
          </section>
        )}

        {/* TODAY SUMMARY BAR */}
        <section className="rounded-2xl border border-slate-800 bg-slate-900/80 px-4 py-3 md:px-6 md:py-4 shadow-lg flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Today on Black Truth TV
            </p>
            <p className="text-sm text-slate-200">
              {loadingSummary ? (
                "Channel summary is loading…"
              ) : summary ? (
                <>
                  <span className="font-semibold text-amber-300">
                    {summary.channels}
                  </span>{" "}
                  channels · live schedule running now
                </>
              ) : (
                "Live schedule running now."
              )}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link href={hasAccess ? "/channels" : "#"}>
              <button
                disabled={!hasAccess}
                className={`rounded-full border border-red-500/70 bg-red-600/80 px-4 py-1.5 text-xs font-semibold shadow transition ${
                  hasAccess
                    ? "hover:bg-red-700/90"
                    : "opacity-60 cursor-not-allowed"
                }`}
              >
                🔴 Go to Live Network
              </button>
            </Link>

            <Link href={hasAccess ? "/freedom-school" : "#"}>
              <button
                disabled={!hasAccess}
                className={`rounded-full border border-amber-500/70 bg-amber-500/90 px-4 py-1.5 text-xs font-semibold text-black shadow transition ${
                  hasAccess
                    ? "hover:bg-amber-400"
                    : "opacity-60 cursor-not-allowed"
                }`}
              >
                📚 Freedom School
              </button>
            </Link>

            <Link href={hasAccess ? "/guide" : "#"}>
              <button
                disabled={!hasAccess}
                className={`rounded-full border border-slate-500/70 bg-slate-800/90 px-4 py-1.5 text-xs font-semibold text-slate-100 shadow transition ${
                  hasAccess
                    ? "hover:bg-slate-700"
                    : "opacity-60 cursor-not-allowed"
                }`}
              >
                📺 24-Hour Guide
              </button>
            </Link>
          </div>
        </section>

        {/* MAIN GRID */}
        <section className="grid gap-6 md:grid-cols-2">
          <Link href={hasAccess ? "/channels" : "#"} className="group">
            <div
              className={`h-full rounded-2xl border border-slate-800 bg-gradient-to-br from-red-800/40 via-slate-950 to-black p-5 shadow-lg transition ${
                hasAccess
                  ? "group-hover:border-red-400/80 group-hover:shadow-red-900/40"
                  : "opacity-60"
              }`}
            >
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
                30+ live channels — Resistance TV, Black History Uncut, Construction
                Queen TV, Freedom School, and more. The lineup the algorithm won&apos;t
                show you, running around the clock.
              </p>
              <p className="text-xs text-slate-400">
                {hasAccess
                  ? "Click to open the full channel grid and choose where to watch."
                  : "Grace ended — upgrade required."}
              </p>
            </div>
          </Link>

          <Link href="/favorites" className="group">
            <div className="h-full rounded-2xl border border-slate-800 bg-gradient-to-br from-pink-800/30 via-slate-950 to-black p-5 shadow-lg transition group-hover:border-pink-400/80 group-hover:shadow-pink-900/40">
              <div className="flex items-center justify-between gap-3 mb-3">
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <span className="text-lg">❤️</span>
                  My Favorites
                </h2>
                <span className="text-[11px] uppercase tracking-wide text-slate-300">
                  Saved Channels
                </span>
              </div>
              <p className="text-sm text-slate-200 mb-3">
                Jump straight to the channels you&apos;ve saved. Tap the heart on any
                channel to add it here.
              </p>
              <p className="text-xs text-slate-400">
                Your favorites follow you across devices.
              </p>
            </div>
          </Link>

          <Link href={hasAccess ? "/freedom-school" : "#"} className="group">
            <div
              className={`h-full rounded-2xl border border-slate-800 bg-gradient-to-br from-emerald-800/30 via-slate-950 to-black p-5 shadow-lg transition ${
                hasAccess
                  ? "group-hover:border-emerald-400/80 group-hover:shadow-emerald-900/40"
                  : "opacity-60"
              }`}
            >
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
                Lessons, lectures, and study packets — the curriculum your school
                never offered. Watch, listen, download, keep.
              </p>
              <p className="text-xs text-slate-400">
                {hasAccess
                  ? "Video, audio, and PDF content all in one virtual classroom."
                  : "Grace ended — upgrade required."}
              </p>
            </div>
          </Link>

          <Link href={hasAccess ? "/on-demand" : "#"} className="group">
            <div
              className={`h-full rounded-2xl border border-slate-800 bg-gradient-to-br from-indigo-700/30 via-slate-950 to-black p-5 shadow-lg transition ${
                hasAccess
                  ? "group-hover:border-indigo-400/80 group-hover:shadow-indigo-900/40"
                  : "opacity-60"
              }`}
            >
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
                Full series, documentaries, and specials — on your time. Binge the
                archive without waiting for the live schedule.
              </p>
              <p className="text-xs text-slate-400">
                {hasAccess ? "Perfect when you want to go deep on one topic." : "Grace ended — upgrade required."}
              </p>
            </div>
          </Link>

          <Link href={hasAccess ? "/breaking-news" : "#"} className="group">
            <div
              className={`h-full rounded-2xl border border-slate-800 bg-gradient-to-br from-slate-700/40 via-slate-950 to-black p-5 shadow-lg transition ${
                hasAccess
                  ? "group-hover:border-slate-400/80 group-hover:shadow-slate-900/40"
                  : "opacity-60"
              }`}
            >
              <div className="flex items-center justify-between gap-3 mb-3">
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <span className="text-lg">📰</span>
                  Daily News &amp; Updates
                </h2>
                <span className="text-[11px] uppercase tracking-wide text-slate-300">
                  Black Truth TV Report
                </span>
              </div>
              <p className="text-sm text-slate-200 mb-3">
                Channel 21 — the news the mainstream won&apos;t cover. Live stream
                plus today&apos;s top stories, all in one hub.
              </p>
              <p className="text-xs text-slate-400">
                {hasAccess ? "Click here to enter the news hub." : "Grace ended — upgrade required."}
              </p>
            </div>
          </Link>

          <Link href={hasAccess ? "/chat" : "#"} className="group">
            <div
              className={`h-full rounded-2xl border border-slate-800 bg-gradient-to-br from-blue-700/40 via-slate-950 to-black p-5 shadow-lg transition ${
                hasAccess
                  ? "group-hover:border-blue-400/80 group-hover:shadow-blue-900/40"
                  : "opacity-60"
              }`}
            >
              <div className="flex items-center justify-between gap-3 mb-3">
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <span className="text-lg">💬</span>
                  Community Chat
                </h2>
                <span className="text-[11px] uppercase tracking-wide text-slate-300">
                  Members Only
                </span>
              </div>
              <p className="text-sm text-slate-200 mb-3">
                Private, moderated conversations with other approved members. Talk
                channels, lessons, and specials — no trolls, no algorithm, no public
                scrolling.
              </p>
              <p className="text-xs text-slate-400">
                {hasAccess ? "Available only to authorized community members." : "Grace ended — upgrade required."}
              </p>
            </div>
          </Link>
        </section>

        {/* ===== WHY THIS NETWORK EXISTS ===== */}
        <section className="rounded-2xl border border-amber-500/20 bg-gradient-to-br from-amber-950/40 via-slate-950 to-black px-5 py-6 md:px-8 md:py-8 shadow-lg">
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-300/90">
            Why this is a private network
          </p>
          <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight mt-2">
            Built so it can&apos;t be taken down.
          </h2>
          <p className="mt-3 text-sm md:text-base text-slate-200 max-w-3xl leading-relaxed">
            Every major platform — YouTube, TikTok, Facebook — has demonetized,
            flagged, or removed Black truth-tellers. Black Truth TV is the answer:
            a members-only network where the history we tell can&apos;t be silenced
            by an algorithm or a coordinated flag. Members fund the archive. The
            archive belongs to the community. As long as we&apos;re here, this
            content stays here.
          </p>
          <p className="mt-3 text-sm md:text-base text-slate-300 max-w-3xl leading-relaxed">
            Every new member makes the network harder to silence. If Black Truth TV
            has changed how you see your history, share it with one person who
            needs it too.
          </p>

          <div className="mt-5 flex flex-wrap gap-2">
            <Link href="/about">
              <button className="rounded-full border border-amber-500/50 bg-amber-500/10 px-4 py-2 text-xs font-semibold text-amber-100 hover:bg-amber-500/20 transition">
                Read our mission
              </button>
            </Link>
            <Link href="/contact">
              <button className="rounded-full border border-slate-500/70 bg-slate-800/80 px-4 py-2 text-xs font-semibold text-slate-100 hover:bg-slate-700 transition">
                Submit content or partner with us
              </button>
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}
