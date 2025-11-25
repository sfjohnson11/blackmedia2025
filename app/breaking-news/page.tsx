// app/breaking-news/page.tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

type BreakingNewsRow = {
  id: number;
  content: string | null;
  is_active: boolean | null;
  sort_order: number | null;
  updated_at: string | null;
};

type SlotKey = "lead" | "second" | "cta";

type SlotCard = {
  slot: SlotKey;
  label: string;
  tag: string;
  fallback: string;
  row?: BreakingNewsRow;
};

export default function BreakingNewsPage() {
  const [rows, setRows] = useState<BreakingNewsRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setLoading(true);
      setErr(null);
      try {
        const { data, error } = await supabase
          .from("breaking_news")
          .select("id, content, is_active, sort_order, updated_at")
          .eq("is_active", true)
          .order("sort_order", { ascending: true })
          .order("id", { ascending: true });

        if (error) throw error;
        if (!cancelled) {
          setRows((data || []) as BreakingNewsRow[]);
        }
      } catch (e: any) {
        if (!cancelled) {
          console.error("Error loading breaking_news for hub:", e);
          setErr(e?.message || "Failed to load breaking news.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // Take top 3 active rows and map to A/B/C blocks
  const activeTop3 = rows.slice(0, 3);

  const slots: SlotCard[] = [
    {
      slot: "lead",
      label: "Today’s Lead Story",
      tag: "A-Block • Open of the Show",
      fallback:
        'Edit this text in Admin → Breaking News. Example: "Democracy on Trial: The criminal cases, the courts, and the consequences for our communities."',
      row: activeTop3[0],
    },
    {
      slot: "second",
      label: "Second Story / Deep Dive",
      tag: "B-Block • Historical Context",
      fallback:
        "Use this block for your history segment: COINTELPRO, civil rights, voting rights, or other context that connects past to present.",
      row: activeTop3[1],
    },
    {
      slot: "cta",
      label: "Closing Notes & Call to Action",
      tag: "C-Block • What Viewers Can Do",
      fallback:
        "Drop your calls to action here: register to vote, support legal defense funds, follow the Black Political Podcast, share the stream, etc.",
      row: activeTop3[2],
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-black via-slate-950 to-black text-white">
      <main className="max-w-6xl mx-auto px-4 pt-20 pb-16 space-y-10">
        {/* HEADER */}
        <section className="space-y-3">
          <p className="text-xs font-semibold tracking-[0.25em] uppercase text-red-400">
            Channel 21 • Black Truth TV Report
          </p>
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight flex items-center gap-2">
            <span className="inline-flex h-3 w-3 rounded-full bg-red-500 animate-pulse" />
            Breaking News Hub
          </h1>
          <p className="text-sm md:text-base text-slate-300 max-w-2xl">
            Live coverage on Channel 21 plus a quick snapshot of today&apos;s
            top stories and calls to action. This hub reads from your{" "}
            <span className="font-mono text-amber-300">breaking_news</span>{" "}
            table.
          </p>
        </section>

        {/* LAYOUT: LIVE PLAYER + STORY CARDS */}
        <section className="grid gap-8 lg:grid-cols-[minmax(0,2fr)_minmax(0,1.4fr)] items-start">
          {/* LEFT: LIVE PLAYER */}
          <div className="space-y-4">
            <div className="rounded-2xl border border-red-600/60 bg-gradient-to-br from-red-900/40 via-slate-950 to-black p-4 shadow-lg">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="inline-flex h-2.5 w-2.5 rounded-full bg-red-500 animate-pulse" />
                  <span className="text-xs font-semibold uppercase tracking-wide text-red-200">
                    Live Now • Channel 21
                  </span>
                </div>
                <span className="text-[11px] uppercase tracking-wide text-slate-300">
                  Democracy • Justice • Culture
                </span>
              </div>

              {/* EMBED WATCH/21 IN AN IFRAME */}
              <div className="relative w-full overflow-hidden rounded-xl border border-slate-800 bg-black shadow-md">
                <div className="relative w-full" style={{ paddingTop: "56.25%" }}>
                  <iframe
                    src="/watch/21"
                    title="Channel 21 Live"
                    className="absolute inset-0 h-full w-full border-0"
                    allow="autoplay; fullscreen; picture-in-picture"
                  />
                </div>
              </div>

              <p className="mt-3 text-xs text-slate-300">
                This is the same live feed as{" "}
                <span className="font-mono text-amber-300">/watch/21</span>,
                wrapped in a news dashboard you can send viewers to during
                special coverage.
              </p>
            </div>
          </div>

          {/* RIGHT: STORY / SEGMENT CARDS DRIVEN BY breaking_news */}
          <div className="space-y-4">
            {err && (
              <div className="rounded-xl border border-red-600 bg-red-950/70 p-3 text-xs text-red-100">
                Error: {err}
              </div>
            )}

            {loading && (
              <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-4 text-sm text-slate-200">
                Loading breaking news cards…
              </div>
            )}

            {!loading &&
              slots.map((slot) => {
                const text = (slot.row?.content || "").trim();
                const body = text.length > 0 ? text : slot.fallback;

                return (
                  <div
                    key={slot.slot}
                    className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4 shadow"
                  >
                    <h2 className="text-lg font-bold mb-1">{slot.label}</h2>
                    <p className="text-xs uppercase tracking-wide text-slate-400 mb-2">
                      {slot.tag}
                    </p>
                    <p className="text-sm text-slate-200 whitespace-pre-line">
                      {body}
                    </p>
                  </div>
                );
              })}

            {/* Back button */}
            <Link href="/app" className="block">
              <button className="w-full mt-2 rounded-full border border-slate-600 bg-slate-900/80 px-4 py-2 text-xs font-semibold text-slate-100 hover:bg-slate-800 hover:border-slate-400 transition">
                ⬅ Back to Member Hub
              </button>
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}
