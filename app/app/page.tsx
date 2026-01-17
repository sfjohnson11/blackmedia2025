// app/app/page.tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";

type Summary = {
  channels: number;
};

type Profile = {
  id: string;
  role?: string | null;
  welcome_started_at?: string | null;
};

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

function isWithin7Days(iso: string | null | undefined) {
  if (!iso) return true; // no timestamp = treat as "new" (show welcome)
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return true;
  return Date.now() - t < SEVEN_DAYS_MS;
}

export default function AppPage() {
  const supabase = createClientComponentClient();

  const [summary, setSummary] = useState<Summary | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(true);

  // Welcome state
  const [showWelcome, setShowWelcome] = useState(false);
  const [welcomeLoading, setWelcomeLoading] = useState(true);

  useEffect(() => {
    async function initWelcome() {
      setWelcomeLoading(true);
      try {
        const {
          data: { user },
          error: userErr,
        } = await supabase.auth.getUser();

        if (userErr || !user) {
          // Not logged in; no welcome logic here
          setShowWelcome(false);
          return;
        }

        // Load profile by auth uid
        const { data: profile, error: profErr } = await supabase
          .from("user_profiles")
          .select("id, role, welcome_started_at")
          .eq("id", user.id)
          .maybeSingle<Profile>();

        if (profErr) {
          console.error("Profile load error:", profErr);
          // fail open: don't block hub
          setShowWelcome(false);
          return;
        }

        // If missing profile row, fail open (do nothing)
        if (!profile?.id) {
          setShowWelcome(false);
          return;
        }

        const shouldShow = isWithin7Days(profile.welcome_started_at ?? null);
        setShowWelcome(shouldShow);

        // If they have no welcome_started_at, set it ONCE (first login)
        if (!profile.welcome_started_at) {
          const nowIso = new Date().toISOString();
          const { error: upErr } = await supabase
            .from("user_profiles")
            .update({ welcome_started_at: nowIso })
            .eq("id", user.id);

          if (upErr) {
            // Not fatal. Welcome still shows because timestamp was missing.
            console.error("Failed to set welcome_started_at:", upErr);
          }
        }
      } catch (e) {
        console.error("Welcome init error:", e);
        setShowWelcome(false);
      } finally {
        setWelcomeLoading(false);
      }
    }

    initWelcome();
  }, [supabase]);

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

        {/* ✅ 7-DAY WELCOME (shows for 7 days after first login, then disappears) */}
        {!welcomeLoading && showWelcome && (
          <section className="rounded-2xl border border-amber-500/30 bg-gradient-to-br from-amber-500/10 via-slate-950 to-black px-5 py-5 md:px-6 md:py-6 shadow-lg">
            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-amber-300/90">
                  Welcome to your private on-demand network
                </p>
                <h2 className="text-2xl font-extrabold tracking-tight">
                  Start Here (first 7 days)
                </h2>
                <p className="text-sm text-slate-200 max-w-2xl">
                  Everything is member-only and built for on-demand viewing. Here are
                  the fastest ways to get value immediately.
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <Link href="/channels">
                  <button className="rounded-full border border-amber-500/50 bg-amber-500/90 px-4 py-1.5 text-xs font-semibold text-black shadow hover:bg-amber-400 transition">
                    ▶ Start Watching
                  </button>
                </Link>
                <Link href="/on-demand">
                  <button className="rounded-full border border-slate-500/70 bg-slate-800/90 px-4 py-1.5 text-xs font-semibold text-slate-100 shadow hover:bg-slate-700 transition">
                    🎬 Browse On-Demand
                  </button>
                </Link>
                <Link href="/freedom-school">
                  <button className="rounded-full border border-emerald-500/50 bg-emerald-500/20 px-4 py-1.5 text-xs font-semibold text-emerald-200 shadow hover:bg-emerald-500/25 transition">
                    📚 Open Freedom School
                  </button>
                </Link>
              </div>
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-3">
              <div className="rounded-xl border border-slate-800 bg-black/40 p-4">
                <p className="text-xs font-semibold text-slate-300 mb-1">
                  ✅ Start Here Picks
                </p>
                <p className="text-sm text-slate-200">
                  Add your 3 “must-watch” items here (the strongest content that shows
                  what Black Truth TV is about).
                </p>
                <p className="text-xs text-slate-500 mt-2">
                  (You can swap these anytime — weekly is fine.)
                </p>
              </div>

              <div className="rounded-xl border border-slate-800 bg-black/40 p-4">
                <p className="text-xs font-semibold text-slate-300 mb-1">
                  ⭐ Featured This Week
                </p>
                <p className="text-sm text-slate-200">
                  Rotate 6–12 curated picks weekly so the network feels alive even
                  though everything is on-demand.
                </p>
                <p className="text-xs text-slate-500 mt-2">
                  (Promote these picks publicly.)
                </p>
              </div>

              <div className="rounded-xl border border-slate-800 bg-black/40 p-4">
                <p className="text-xs font-semibold text-slate-300 mb-1">
                  🎁 Member Bonuses
                </p>
                <p className="text-sm text-slate-200">
                  Add watch guides, playlists, discussion questions, and monthly watch
                  parties (replays go here).
                </p>
                <p className="text-xs text-slate-500 mt-2">
                  (This is what reduces churn.)
                </p>
              </div>
            </div>

            <div className="mt-3 text-xs text-slate-500">
              This welcome section automatically disappears after 7 days.
            </div>
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
            <Link href="/channels">
              <button className="rounded-full border border-red-500/70 bg-red-600/80 px-4 py-1.5 text-xs font-semibold shadow hover:bg-red-700/90 transition">
                🔴 Go to Live Network
              </button>
            </Link>
            <Link href="/freedom-school">
              <button className="rounded-full border border-amber-500/70 bg-amber-500/90 px-4 py-1.5 text-xs font-semibold text-black shadow hover:bg-amber-400 transition">
                📚 Freedom School
              </button>
            </Link>
            <Link href="/guide">
              <button className="rounded-full border border-slate-500/70 bg-slate-800/90 px-4 py-1.5 text-xs font-semibold text-slate-100 shadow hover:bg-slate-700 transition">
                📺 24-Hour Guide
              </button>
            </Link>
          </div>
        </section>

        {/* MAIN GRID */}
        <section className="grid gap-6 md:grid-cols-2">
          {/* Live Channels */}
          <Link href="/channels" className="group">
            <div className="h-full rounded-2xl border border-slate-800 bg-gradient-to-br from-red-800/40 via-slate-950 to-black p-5 shadow-lg transition group-hover:border-red-400/80 group-hover:shadow-red-900/40">
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
                Click to open the full channel grid and choose where to watch.
              </p>
            </div>
          </Link>

          {/* Freedom School */}
          <Link href="/freedom-school" className="group">
            <div className="h-full rounded-2xl border border-slate-800 bg-gradient-to-br from-emerald-800/30 via-slate-950 to-black p-5 shadow-lg transition group-hover:border-emerald-400/80 group-hover:shadow-emerald-900/40">
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
                Video, audio, and PDF content all in one virtual classroom.
              </p>
            </div>
          </Link>

          {/* On-Demand */}
          <Link href="/on-demand" className="group">
            <div className="h-full rounded-2xl border border-slate-800 bg-gradient-to-br from-indigo-700/30 via-slate-950 to-black p-5 shadow-lg transition group-hover:border-indigo-400/80 group-hover:shadow-indigo-900/40">
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
                Perfect when you want to go deep on one topic.
              </p>
            </div>
          </Link>

          {/* Daily News / Breaking News Hub */}
          <Link href="/breaking-news" className="group">
            <div className="h-full rounded-2xl border border-slate-800 bg-gradient-to-br from-slate-700/40 via-slate-950 to-black p-5 shadow-lg transition group-hover:border-slate-400/80 group-hover:shadow-slate-900/40">
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
                Channel 21 is your live news window. Click here to enter the news hub.
              </p>
            </div>
          </Link>

          {/* 💬 Community Chat */}
          <Link href="/chat" className="group">
            <div className="h-full rounded-2xl border border-slate-800 bg-gradient-to-br from-blue-700/40 via-slate-950 to-black p-5 shadow-lg transition group-hover:border-blue-400/80 group-hover:shadow-blue-900/40">
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
                Chat is moderated and available only to authorized community members.
              </p>
            </div>
          </Link>
        </section>
      </main>
    </div>
  );
}
