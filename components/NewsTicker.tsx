"use client";

import { useEffect, useState } from "react";

type NewsTickerItem = {
  message: string;
};

export default function NewsTicker() {
  const [items, setItems] = useState<NewsTickerItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch("/api/admin/news", {
          method: "GET",
          cache: "no-store",
        });

        if (!res.ok) {
          console.error("Failed to load news ticker", await res.text());
          if (!cancelled) setItems([]);
          return;
        }

        const data = await res.json();
        if (!cancelled) {
          setItems(Array.isArray(data.items) ? data.items : []);
        }
      } catch (err) {
        console.error("Ticker fetch error", err);
        if (!cancelled) setItems([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    const interval = setInterval(load, 60_000); // refresh every 60s

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  const messages = items
    .map((m) => (typeof m === "string" ? m : m?.message))
    .filter((m): m is string => !!m && m.trim().length > 0);

  // If nothing to show, render nothing (so it won't mess up your layout)
  if (!loading && messages.length === 0) return null;

  const text = messages.join("   •   ");

  return (
    <div className="w-full border-y border-rose-500/50 bg-gradient-to-r from-rose-900/80 via-black to-rose-900/80 text-xs text-rose-50 shadow-[0_0_18px_rgba(0,0,0,0.75)]">
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-2">
        <span className="inline-flex items-center gap-1 rounded-full bg-rose-700 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide">
          <span className="inline-block h-2 w-2 rounded-full bg-rose-300 animate-pulse" />
          Breaking
        </span>

        <div className="relative flex-1 overflow-hidden">
          {/* simple marquee effect */}
          <div className="animate-[ticker-marquee_40s_linear_infinite] whitespace-nowrap">
            {loading && messages.length === 0 ? (
              <span className="text-slate-300 opacity-80">
                Loading latest headlines…
              </span>
            ) : (
              <span>{text}</span>
            )}
          </div>
        </div>
      </div>

      {/* Local CSS for marquee animation so we don't touch your Tailwind config */}
      <style jsx>{`
        @keyframes ticker-marquee {
          0% {
            transform: translateX(0%);
          }
          100% {
            transform: translateX(-50%);
          }
        }
      `}</style>
    </div>
  );
}
