"use client";

import { useEffect, useState } from "react";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";

type BreakingNewsRow = {
  id: number;
  title: string | null;
  content: string | null;
  is_active: boolean | null;
  sort_order: number | null;
};

export default function BreakingNewsPage() {
  const supabase = createClientComponentClient();
  const [rows, setRows] = useState<BreakingNewsRow[]>([]);
  const [loading, setLoading] = useState(true);

  // Load breaking news boxes
  useEffect(() => {
    const load = async () => {
      const { data, error } = await supabase
        .from("breaking_news")
        .select("id, title, content, is_active, sort_order")
        .eq("is_active", true)
        .order("sort_order", { ascending: true });

      if (error) {
        console.error(error);
        setRows([]);
      } else {
        setRows((data ?? []).slice(0, 3));
      }

      setLoading(false);
    };

    load();
  }, [supabase]);

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">

      {/* BACK TO HUB */}
      <div className="mb-6">
        <a
          href="/app"
          className="text-xs font-semibold text-yellow-300 hover:text-yellow-400 transition"
        >
          ← Back to Member Hub
        </a>
      </div>

      {/* HEADER STRIP */}
      <div className="mb-4 flex items-center justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-red-700/80 px-3 py-1">
            <span className="h-2 w-2 rounded-full bg-white animate-pulse" />
            <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white">
              Breaking News
            </span>
          </div>

          <h1 className="mt-3 text-3xl font-semibold text-slate-50">
            Live Coverage & Headlines
          </h1>

          <p className="mt-1 text-xs text-slate-300">
            Channel 21 live on the left · Top stories and seasonal updates on the right.
          </p>
        </div>

        <div className="hidden sm:block h-10 w-1 rounded-full bg-gradient-to-b from-yellow-400 via-yellow-300 to-yellow-500 shadow-[0_0_18px_rgba(250,204,21,0.6)]" />
      </div>

      {/* MAIN GRID */}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1.3fr)]">

        {/* LEFT: PLAYER CARD */}
        <section className="space-y-3">
          <div className="rounded-2xl border border-slate-700/80 bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 p-4 shadow-[0_18px_40px_rgba(0,0,0,0.7)]">

            <div className="flex items-center justify-between mb-3">
              <div>
                <h2 className="text-xl font-semibold text-slate-50">
                  Channel 21 — Black Truth TV Live
                </h2>
                <p className="text-xs text-slate-300">
                  Real-time news, documentaries, and live coverage from the Black Truth TV newsroom.
                </p>
              </div>

              <span className="hidden md:inline-flex items-center rounded-full border border-green-400/70 bg-green-500/20 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-green-200">
                ● On Air
              </span>
            </div>

            {/* 16:9 PLAYER */}
            <div className="w-full overflow-hidden rounded-xl border border-slate-700 bg-black/90">
              <div className="relative w-full" style={{ paddingTop: "56.25%" }}>
                <iframe
                  src="/watch/21"   // CORRECT URL FOR CHANNEL 21
                  className="absolute inset-0 h-full w-full"
                  allow="autoplay; encrypted-media; fullscreen"
                  allowFullScreen
                />
              </div>
            </div>
          </div>
        </section>

        {/* RIGHT: BREAKING NEWS BOXES */}
        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-slate-50 flex items-center gap-2">
            <span className="h-1 w-6 rounded-full bg-yellow-400" />
            Headlines & Updates
          </h2>

          {loading ? (
            <p className="text-slate-300 text-sm">Loading…</p>
          ) : rows.length === 0 ? (
            <p className="text-slate-300 text-sm">
              No breaking news posted yet.
            </p>
          ) : (
            <div className="flex flex-col gap-4">
              {rows.map((row, index) => (
                <article
                  key={row.id}
                  className="relative overflow-hidden rounded-2xl border border-slate-700 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 px-4 py-3 shadow-[0_10px_30px_rgba(0,0,0,0.55)]"
                >
                  {/* Gold Accent Bar */}
                  <div className="absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-yellow-400 via-amber-300 to-orange-400" />

                  <div className="pl-3">
                    <h3 className="text-sm font-semibold text-slate-50 mb-1">
                      {row.title || `Story ${index + 1}`}
                    </h3>

                    <p className="text-xs leading-relaxed text-slate-200 whitespace-pre-line">
                      {row.content}
                    </p>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

      </div>
    </div>
  );
}
