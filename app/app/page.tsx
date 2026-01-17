"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";

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

// Feb 1, 2026 @ 12:00am PT = 08:00:00Z
const GRACE_CUTOFF_ISO = "2026-02-01T08:00:00Z";

function parseMs(iso: string | null | undefined): number {
  if (!iso) return NaN;
  const t = Date.parse(iso);
  return Number.isNaN(t) ? NaN : t;
}

function fmtDateTimeLocal(iso: string) {
  try {
    return new Date(iso).toLocaleString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZoneName: "short",
    });
  } catch {
    return iso;
  }
}

export default function AppPage() {
  const supabase = createClientComponentClient();

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

  const graceUntilMs = useMemo(() => parseMs(profile?.grace_until), [profile]);

  // ✅ Access rule (what you confirmed):
  // - Admin always has access
  // - Active = access
  // - Otherwise, access allowed ONLY until grace_until
  const hasAccess = useMemo(() => {
    if (isAdmin) return true;
    if (status === "active") return true;
    if (Number.isFinite(graceUntilMs) && Date.now() < graceUntilMs) return true;
    return false;
  }, [isAdmin, status, graceUntilMs]);

  // ✅ Banner rule:
  // Show upgrade banner for anyone who is NOT active (but still approved/inside),
  // EVEN IF they still have access during grace.
  const showUpgradeBanner = useMemo(() => {
    if (profileLoading) return false;
    if (!profile) return false;
    if (isAdmin) return false;
    return status !== "active";
  }, [profileLoading, profile, isAdmin, status]);

  const graceCutoffLabel = useMemo(
    () => fmtDateTimeLocal(GRACE_CUTOFF_ISO),
    []
  );

  const graceLabel = useMemo(() => {
    if (!Number.isFinite(graceUntilMs)) return null;
    try {
      return new Date(graceUntilMs).toLocaleString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
        timeZoneName: "short",
      });
    } catch {
      return null;
    }
  }, [graceUntilMs]);

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

        {/* ✅ ALWAYS-SHOW UPGRADE BANNER (for unpaid users, even during grace) */}
        {showUpgradeBanner && (
          <section className="rounded-2xl border border-amber-500/30 bg-gradient-to-br from-amber-500/10 via-slate-950 to-black px-5 py-5 md:px-6 md:py-6 shadow-lg">
            <p className="text-xs font-semibold uppercase tracking-wide text-amber-300/90">
              Paid membership required (grace period currently on)
            </p>

            <h2 className="text-2xl font-extrabold tracking-tight mt-1">
              Upgrade to keep access
            </h2>

            <p className="text-sm text-slate-200 mt-2 max-w-3xl">
              You&apos;re approved to use Black Truth TV, but your account is not
              on a paid plan yet.{" "}
              <span className="font-semibold text-amber-300">
                Starting {graceCutoffLabel}
              </span>
              , access will require an active subscription.
            </p>

            <div className="mt-3 text-xs text-slate-300">
              <div className="flex flex-wrap gap-2">
                <span className="rounded-full border border-slate-700 bg-slate-900/70 px-3 py-1">
                  Status: <span className="text-amber-300 font-semibold">{status || "unpaid"}</span>
                </span>

                {graceLabel && (
                  <span className="rounded-full border border-slate-700 bg-slate-900/70 px-3 py-1">
                    Grace ends: <span className="text-slate-100 font-semibold">{graceLabel}</span>
                  </span>
                )}
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <a href={STRIPE_UPGRADE_URL}>
                <button className="rounded-full border border-amber-500/50 bg-amber-500/90 px-4 py-2 text-xs font-semibold text-black shadow hover:bg-amber-400 transition">
                  Upgrade — $9.99/month
                </button>
              </a>

              <Link href="/request-access">
                <button className="rounded-full border border-slate-500/70 bg-slate-800/90 px-4 py-2 text-xs font-semibold text-slate-100 shadow hover:bg-slate-700 transition">
                  Need help? Contact / Request
                </button>
              </Link>
            </div>

            <p className="text-xs text-slate-500 mt-3">
              After upgrading, log out and log back in so your membership status updates.
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
                Flip through all Black Truth TV channels, including Resistance TV,
                Construction Queen TV, Freedom School, and more.
              </p>
              <p className="text-xs text-slate-400">
                {hasAccess
                  ? "Click to open the full channel grid and choose where to watch."
                  : "Grace ended — upgrade required."}
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
                Binge full series, documentaries, and special features without waiting
                for the live schedule.
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
                Go to the Breaking News Hub for Channel 21 — watch the live stream and
                see today&apos;s top stories in one place.
              </p>
              <p className="text-xs text-slate-400">
                {hasAccess ? "Channel 21 is your live news window. Click here to enter the news hub." : "Grace ended — upgrade required."}
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
                Join private conversations about Black Truth TV channels, Freedom
                School lessons, and upcoming specials with other approved members.
              </p>
              <p className="text-xs text-slate-400">
                {hasAccess ? "Chat is moderated and available only to authorized community members." : "Grace ended — upgrade required."}
              </p>
            </div>
          </Link>
        </section>

        {!profileLoading && profile && !isPaidActive && (
          <div className="text-xs text-slate-500">
            Tip: you can still watch during grace, but upgrade now to avoid interruption on{" "}
            <span className="text-slate-200 font-semibold">{graceCutoffLabel}</span>.
          </div>
        )}
      </main>
    </div>
  );
}
