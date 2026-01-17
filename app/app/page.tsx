// app/app/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";

type Summary = { channels: number };

type Profile = {
  id: string;
  role: string | null;
  membership_status: string | null;
  grace_until: string | null;
  welcome_started_at: string | null;
};

const STRIPE_UPGRADE_URL = "https://buy.stripe.com/7sY8wPekWcUp6IM6Rq6J314";

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

function isWithin7Days(iso: string | null | undefined) {
  if (!iso) return true;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return true;
  return Date.now() - t < SEVEN_DAYS_MS;
}

function parseMs(iso: string | null) {
  if (!iso) return NaN;
  const t = Date.parse(iso);
  return Number.isNaN(t) ? NaN : t;
}

export default function AppPage() {
  const supabase = createClientComponentClient();
  const searchParams = useSearchParams();

  // 🔹 query params from middleware redirect
  const paywallParam = searchParams.get("paywall"); // "1" when blocked
  const redirectParam = searchParams.get("redirect"); // original destination

  const isPaywallRedirect = paywallParam === "1";

  const [summary, setSummary] = useState<Summary | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(true);

  const [profile, setProfile] = useState<Profile | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);

  // Load profile + set welcome_started_at once
  useEffect(() => {
    let cancelled = false;

    async function loadProfile() {
      setProfileLoading(true);
      try {
        const {
          data: { user },
          error: userErr,
        } = await supabase.auth.getUser();

        if (userErr || !user) {
          if (!cancelled) setProfile(null);
          return;
        }

        const { data: prof, error: profErr } = await supabase
          .from("user_profiles")
          .select("id, role, membership_status, grace_until, welcome_started_at")
          .eq("id", user.id)
          .maybeSingle<Profile>();

        if (profErr) {
          console.error("Profile load error:", profErr);
          if (!cancelled) setProfile(null);
          return;
        }

        if (!cancelled) setProfile(prof ?? null);

        // Set welcome_started_at once (first time they hit the hub)
        if (prof?.id && !prof.welcome_started_at) {
          const nowIso = new Date().toISOString();
          const { error: upErr } = await supabase
            .from("user_profiles")
            .update({ welcome_started_at: nowIso })
            .eq("id", user.id);

          if (upErr) console.error("Failed to set welcome_started_at:", upErr);

          if (!cancelled) {
            setProfile((p) => (p ? { ...p, welcome_started_at: nowIso } : p));
          }
        }
      } catch (e) {
        console.error("Profile init error:", e);
        if (!cancelled) setProfile(null);
      } finally {
        if (!cancelled) setProfileLoading(false);
      }
    }

    loadProfile();
    return () => {
      cancelled = true;
    };
  }, [supabase]);

  // Load channel count summary (unchanged)
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

  const isAdmin = useMemo(() => {
    const r = (profile?.role ?? "").toLowerCase().trim();
    return r === "admin";
  }, [profile]);

  const hasAccess = useMemo(() => {
    if (isAdmin) return true;

    const status = (profile?.membership_status ?? "").toLowerCase().trim();
    if (status === "active") return true;

    const graceMs = parseMs(profile?.grace_until ?? null);
    if (Number.isFinite(graceMs) && Date.now() < graceMs) return true;

    return false;
  }, [profile, isAdmin]);

  const showWelcome = useMemo(() => {
    if (!profile) return false;
    if (!hasAccess) return false;
    return isWithin7Days(profile.welcome_started_at);
  }, [profile, hasAccess]);

  // A small helper to show where they tried to go (safe display)
  const attemptedPath =
    redirectParam && redirectParam.startsWith("/") ? redirectParam : null;

  return (
    <div className="min-h-screen bg-gradient-to-b from-black via-slate-950 to-black text-white">
      <main className="max-w-6xl mx-auto px-4 pt-20 pb-16 space-y-10">
        {/* HEADER */}
        <section className="space-y-3">
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight">
            Black Truth TV — Member Hub
          </h1>
          <p className="text-sm md:text-base text-slate-300 max-w-2xl">
            Welcome inside the network. From here you can jump to live channels,
            Freedom School lessons, and on-demand specials.
          </p>
        </section>

        {/* ✅ PAYWALL BANNER WHEN MIDDLEWARE REDIRECTS HERE */}
        {!profileLoading && isPaywallRedirect && !hasAccess && (
          <section className="rounded-2xl border border-red-500/30 bg-gradient-to-br from-red-500/10 via-slate-950 to-black px-5 py-5 md:px-6 md:py-6 shadow-lg">
            <p className="text-xs font-semibold uppercase tracking-wide text-red-300/90">
              Access blocked — membership required
            </p>
            <h2 className="text-2xl font-extrabold tracking-tight mt-1">
              Upgrade to keep watching
            </h2>
            <p className="text-sm text-slate-200 mt-2 max-w-3xl">
              Black Truth TV is now a private, member-supported network. To watch
              channels, on-demand specials, and Freedom School content, you’ll need
              an active membership.
            </p>

            {attemptedPath && (
              <p className="text-xs text-slate-400 mt-2">
                You tried to access:{" "}
                <span className="text-slate-200 font-semibold">{attemptedPath}</span>
              </p>
            )}

            <div className="mt-4 flex flex-wrap gap-2">
              <a href={STRIPE_UPGRADE_URL}>
                <button className="rounded-full border border-amber-500/50 bg-amber-500/90 px-4 py-2 text-xs font-semibold text-black shadow hover:bg-amber-400 transition">
                  Upgrade — $9.99/month
                </button>
              </a>

              <Link href="/request-access">
                <button className="rounded-full border border-slate-500/70 bg-slate-800/90 px-4 py-2 text-xs font-semibold text-slate-100 shadow hover:bg-slate-700 transition">
                  Need help? Request / Contact
                </button>
              </Link>
            </div>

            <p className="text-xs text-slate-500 mt-3">
              After upgrading, log out and log back in so your access updates.
            </p>
          </section>
        )}

        {/* ✅ 7-DAY WELCOME (only for paid/grace users) */}
        {!profileLoading && showWelcome && (
          <section className="rounded-2xl border border-amber-500/30 bg-gradient-to-br from-amber-500/10 via-slate-950 to-black px-5 py-5 md:px-6 md:py-6 shadow-lg">
            <p className="text-xs font-semibold uppercase tracking-wide text-amber-300/90">
              Welcome (shows for your first 7 days)
            </p>
            <h2 className="text-2xl font-extrabold tracking-tight mt-1">
              Start Here
            </h2>
            <p className="text-sm text-slate-200 mt-2 max-w-3xl">
              Everything is on-demand, but we guide you to the best content fast.
              Use these shortcuts to get value immediately.
            </p>

            <div className="mt-4 flex flex-wrap gap-2">
              <Link href="/channels">
                <button className="rounded-full border border-amber-500/50 bg-amber-500/90 px-4 py-2 text-xs font-semibold text-black shadow hover:bg-amber-400 transition">
                  ▶ Start Watching
                </button>
              </Link>
              <Link href="/on-demand">
                <button className="rounded-full border border-slate-500/70 bg-slate-800/90 px-4 py-2 text-xs font-semibold text-slate-100 shadow hover:bg-slate-700 transition">
                  🎬 Browse On-Demand
                </button>
              </Link>
              <Link href="/freedom-school">
                <button className="rounded-full border border-emerald-500/50 bg-emerald-500/20 px-4 py-2 text-xs font-semibold text-emerald-200 shadow hover:bg-emerald-500/25 transition">
                  📚 Open Freedom School
                </button>
              </Link>
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-3">
              <div className="rounded-xl border border-slate-800 bg-black/40 p-4">
                <p className="text-xs font-semibold text-slate-300 mb-1">
                  ✅ Start Here Picks
                </p>
                <p className="text-sm text-slate-200">
                  Add 3 must-watch items that explain what Black Truth TV is about.
                </p>
              </div>

              <div className="rounded-xl border border-slate-800 bg-black/40 p-4">
                <p className="text-xs font-semibold text-slate-300 mb-1">
                  ⭐ Featured This Week
                </p>
                <p className="text-sm text-slate-200">
                  Rotate 6–12 picks weekly so the network feels alive.
                </p>
              </div>

              <div className="rounded-xl border border-slate-800 bg-black/40 p-4">
                <p className="text-xs font-semibold text-slate-300 mb-1">
                  🎁 Member Bonuses
                </p>
                <p className="text-sm text-slate-200">
                  Watch guides, playlists, discussion prompts, and watch party replays.
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-500 mt-3">
              This welcome section disappears automatically after 7 days.
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
                className="rounded-full border border-red-500/70 bg-red-600/80 px-4 py-1.5 text-xs font-semibold shadow hover:bg-red-700/90 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                🔴 Go to Live Network
              </button>
            </Link>
            <Link href={hasAccess ? "/freedom-school" : "#"}>
              <button
                disabled={!hasAccess}
                className="rounded-full border border-amber-500/70 bg-amber-500/90 px-4 py-1.5 text-xs font-semibold text-black shadow hover:bg-amber-400 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                📚 Freedom School
              </button>
            </Link>
            <Link href={hasAccess ? "/guide" : "#"}>
              <button
                disabled={!hasAccess}
                className="rounded-full border border-slate-500/70 bg-slate-800/90 px-4 py-1.5 text-xs font-semibold text-slate-100 shadow hover:bg-slate-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                📺 24-Hour Guide
              </button>
            </Link>

            {!hasAccess && (
              <a href={STRIPE_UPGRADE_URL}>
                <button className="rounded-full border border-amber-500/50 bg-amber-500/90 px-4 py-1.5 text-xs font-semibold text-black shadow hover:bg-amber-400 transition">
                  Upgrade — $9.99/mo
                </button>
              </a>
            )}
          </div>
        </section>

        {/* MAIN GRID (unchanged visuals; gated links are disabled if no access) */}
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
                Flip through all Black Truth TV channels, including Resistance TV,
                Construction Queen TV, Freedom School, and more.
              </p>
              <p className="text-xs text-slate-400">
                {hasAccess
                  ? "Click to open the full channel grid and choose where to watch."
                  : "Upgrade required to watch."}
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
                Watch lessons, listen to lectures, and download study packets from the
                Freedom School library.
              </p>
              <p className="text-xs text-slate-400">
                {hasAccess
                  ? "Video, audio, and PDF content all in one virtual classroom."
                  : "Upgrade required to access."}
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
                Binge full series, documentaries, and special features without waiting
                for the live schedule.
              </p>
              <p className="text-xs text-slate-400">
                {hasAccess ? "Perfect when you want to go deep on one topic." : "Upgrade required to watch."}
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
                Go to the Breaking News Hub for Channel 21 — watch the live stream and
                see today&apos;s top stories in one place.
              </p>
              <p className="text-xs text-slate-400">
                {hasAccess ? "Channel 21 is your live news window. Click here to enter the news hub." : "Upgrade required to access."}
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
                Join private conversations about channels, Freedom School lessons, and
                specials with other members.
              </p>
              <p className="text-xs text-slate-400">
                {hasAccess ? "Chat is moderated and available only to authorized members." : "Upgrade required to participate."}
              </p>
            </div>
          </Link>
        </section>
      </main>
    </div>
  );
}
