// app/breaking-news/page.tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import { Button } from "@/components/ui/button";

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
    <div className="max-w-6xl mx-auto px-4 py-10 space-y-8">
      <h1 className="text-3xl font-semibold text-slate-50">
        Breaking News & Updates
      </h1>

      {/* 🔴 CHANNEL 21 VIEWER / PROMO BLOCK */}
      <section>
        <div className="rounded-xl border border-slate-700 bg-slate-900/80 p-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="space-y-1 max-w-xl">
            <h2 className="text-xl font-semibold text-slate-50">
              Channel 21 — Black Truth TV Live
            </h2>
            <p className="text-sm text-slate-200">
              Watch our live coverage, breaking news, and special reports on{" "}
              <strong>Channel 21</strong>. Stream Black Truth TV in real time,
              24/7.
            </p>
          </div>
          <div className="mt-3 md:mt-0 flex md:justify-end">
            <Link href="/watch?channel=21">
              <Button className="text-sm font-semibold">
                Watch Channel 21 Live
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* 🟦 3 BREAKING NEWS BOXES */}
      <section>
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
      </section>
    </div>
  );
}
