// app/app/page.tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";

type ContinueItem = {
  title: string;
  subtitle?: string;
  href: string;
  kind: "live" | "freedom" | "other";
};

export default function AppPage() {
  const router = useRouter();
  const supabase = createClientComponentClient();

  const [displayName, setDisplayName] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [initials, setInitials] = useState<string>("BT");
  const [continueItem, setContinueItem] = useState<ContinueItem | null>(null);

  // Load user profile (name + email) for avatar/header
  useEffect(() => {
    async function loadProfile() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        // If somehow we hit /app without a session, punt to login
        router.replace("/login");
        return;
      }

      const userEmail = user.email ?? null;
      setEmail(userEmail);

      // Try to get a nicer name from user_profiles
      let nameFromProfile: string | null = null;

      if (userEmail) {
        const { data: profile, error } = await supabase
          .from("user_profiles")
          .select("full_name, name, email")
          .eq("email", userEmail)
          .maybeSingle();

        if (!error && profile) {
          nameFromProfile =
            (profile.full_name as string | null) ??
            (profile.name as string | null) ??
            null;
        }
      }

      const finalName = nameFromProfile || userEmail || "Member";
      setDisplayName(finalName);

      // Build initials: first letters of first + last if we can
      const initialSource = nameFromProfile || userEmail || "BT";
      const parts = initialSource.split(/[\s.@]+/).filter(Boolean);
      const initialsGuess =
        parts.length >= 2
          ? `${parts[0][0]}${parts[1][0]}`
          : initialSource.slice(0, 2);
      setInitials(initialsGuess.toUpperCase());
    }

    loadProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load "continue watching" info from localStorage
  useEffect(() => {
    if (typeof window === "undefined") return;

    try {
      const raw = window.localStorage.getItem("btv_last_watch");
      if (!raw) return;

      const parsed = JSON.parse(raw) as {
        title?: string;
        subtitle?: string;
        href?: string;
        kind?: "live" | "freedom" | "other";
      };

      if (!parsed || !parsed.href || !parsed.title) return;

      setContinueItem({
        title: parsed.title,
        subtitle: parsed.subtitle,
        href: parsed.href,
        kind: parsed.kind ?? "other",
      });
    } catch {
      // ignore bad JSON and just show default UI
    }
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-b from-black via-slate-950 to-black text-white">
      <div className="mx-auto max-w-5xl px-4 py-8 md:py-10 space-y-8">
        {/* HEADER / HERO with avatar + name */}
        <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-[0.2em] text-amber-400">
              Black Truth TV • Member Hub
            </p>
            <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight">
              Welcome back{displayName ? `, ${displayName}` : ""}.
            </h1>
            <p className="max-w-2xl text-sm md:text-base text-slate-300">
              Jump straight into live channels, Freedom School lessons, or your
              on-demand library. This is your shortcut into the network.
            </p>
          </div>

          {/* Avatar */}
          <div className="flex items-center gap-3 self-start md:self-auto">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-800 border border-slate-600 text-sm font-bold">
              {initials}
            </div>
            <div className="text-xs text-slate-300">
              <p className="font-semibold text-slate-100">
                {displayName || "Member"}
              </p>
              {email && <p className="text-[11px] text-slate-400">{email}</p>}
            </div>
          </div>
        </header>

        {/* CONTINUE WATCHING */}
        <section className="rounded-2xl border border-slate-800 bg-slate-950/70 px-4 py-4 md:px-5 md:py-5 shadow-lg">
          <div className="flex items-center justify-between gap-3 mb-3">
            <div>
              <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">
                Continue watching
              </p>
              <h2 className="text-sm md:text-base font-semibold text-amber-300">
                {continueItem
                  ? continueItem.title
                  : "We’ll remember where you left off."}
              </h2>
              {continueItem?.subtitle && (
                <p className="text-[11px] text-slate-400 mt-0.5">
                  {continueItem.subtitle}
                </p>
              )}
            </div>
            {continueItem && (
              <Link
                href={continueItem.href}
                className="inline-flex items-center rounded-full bg-amber-600 px-3 py-1.5 text-[11px] font-semibold hover:bg-amber-700"
              >
                ▶ Resume
              </Link>
            )}
          </div>

          {!continueItem && (
            <p className="text-[11px] text-slate-400">
              Once you start a live channel or lesson, we’ll show a quick
              “resume” button here so you can jump back in.
            </p>
          )}
        </section>

        {/* QUICK ACTIONS */}
        <section className="grid gap-5 md:grid-cols-3">
          {/* Live / Home → NOW GOES TO /channels */}
          <Link
            href="/channels"
            className="group rounded-2xl border border-slate-800 bg-slate-950/70 p-5 shadow-lg hover:border-amber-400 hover:bg-slate-900/80 transition-colors"
          >
            <div className="mb-3 inline-flex rounded-full bg-amber-500/10 px-3 py-1 text-[11px] font-semibold text-amber-300">
              Live Channels
            </div>
            <h2 className="text-lg font-semibold mb-1 group-hover:text-amber-300">
              Watch Live Black Truth TV
            </h2>
            <p className="text-sm text-slate-300">
              Go to the channels page to pick a channel and jump into the live
              network.
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
              Browse on-demand documentaries, specials, and series available to
              members anytime.
            </p>
          </Link>
        </section>

        {/* FOOTER HINT */}
        <section className="mt-4 rounded-2xl border border-slate-800 bg-slate-950/60 px-4 py-3 text-xs text-slate-400">
          <p>
            Tip: Use the top navigation to move around the network at any time.
            This member hub is your shortcut back to the main areas of Black
            Truth TV.
          </p>
        </section>
      </div>
    </div>
  );
}
