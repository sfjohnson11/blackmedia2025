// app/breaking-news/page.tsx
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

  useEffect(() => {
    const load = async () => {
      const { data, error } = await supabase
        .from("breaking_news")
        .select("id, title, content, is_active, sort_order")
        .eq("is_active", true)
        .order("sort_order", { ascending: true })
        .order("id", { ascending: true });

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
      {/* PAGE HEADING */}
      <h1 className="text-3xl font-semibold text-slate-50 mb-4">
        Breaking News & Live Coverage
      </h1>

      {/* NEWS-LIKE LAYOUT: LEFT = PLAYER, RIGHT = BOXES */}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1.2fr)]">
        {/* LEFT: FULL PLAYER AREA */}
        <section className="space-y-3">
          <div>
            <h2 className="text-xl font-semibold text-slate-50">
              Channel 21 — Black Truth TV Live
            </h2>
            <p className="text-sm text-slate-200">
              Live stream of Black Truth TV Channel 21 — breaking news, special
              coverage, and real-time updates.
            </p>
          </div>

          {/* 16:9 responsive player, full on the left */}
          <div className="w-full rounded-xl overflow-hidden border border-slate-700 bg-black">
            <div className="relative w-full" style={{ paddingTop: "56.25%" }}>
              <iframe
                src="/watch/21"   // ✅ correct route
                className="absolute inset-0 h-full w-full"
                allow="autoplay; encrypted-media; fullscreen"
                allowFullScreen
              />
            </div>
          </div>
        </section>

        {/* RIGHT: STACKED BREAKING NEWS BOXES */}
        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-slate-50">
            Headlines & Updates
          </h2>

          {loading ? (
            <p className="text-slate-300 text-sm">Loading…</p>
          ) : rows.length === 0 ? (
            <p className="text-slate-300 text-sm">
              No breaking news has been posted yet. Please check back soon.
            </p>
          ) : (
            <div className="flex flex-col gap-4">
              {rows.map((row, index) => (
                <article
                  key={row.id}
                  className="rounded-xl border border-slate-700 bg-slate-900/80 px-4 py-3 flex flex-col gap-1"
                >
                  <h3 className="text-sm font-semibold text-slate-50">
                    {row.title || `Box ${index + 1}`}
                  </h3>
                  <p className="text-xs leading-relaxed text-slate-200 whitespace-pre-line">
                    {row.content}
                  </p>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
