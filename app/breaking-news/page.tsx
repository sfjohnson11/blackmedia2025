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
    <div className="max-w-6xl mx-auto px-4 py-10 space-y-6">
      <h1 className="text-3xl font-semibold text-slate-50 mb-4">
        Breaking News & Updates
      </h1>

      {loading ? (
        <p className="text-slate-300 text-sm">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="text-slate-300 text-sm">
          No breaking news has been posted yet. Please check back soon.
        </p>
      ) : (
        <div className="grid gap-6 md:grid-cols-3">
          {rows.map((row, index) => (
            <article
              key={row.id}
              className="rounded-xl border border-slate-700 bg-slate-900/70 p-4 flex flex-col gap-2"
            >
              <h2 className="text-lg font-semibold text-slate-50">
                {row.title || `Box ${index + 1}`}
              </h2>
              <p className="text-sm leading-relaxed text-slate-200 whitespace-pre-line">
                {row.content}
              </p>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
