"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";

// Render-only component (no SSR for smooth client behavior)
const NewsTicker = dynamic(() => import("./NewsTicker"), { ssr: false });

type Item = { content: string; is_active?: boolean; sort_order?: number };

const FALLBACK_HEADLINES = [
  "Welcome to Black Truth TV",
  "Streaming 29 channels — new shows weekly",
  "Follow us on YouTube for live events",
];

export default function NewsTickerLive() {
  const [items, setItems] = useState<string[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);

  // Admin detection (your existing admin login stores this key)
  useEffect(() => {
    try {
      const token = localStorage.getItem("btv_admin_auth");
      setIsAdmin(!!token);
    } catch {}
  }, []);

  // Try API; if it fails or returns nothing, show fallback so users still see a ticker
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/news", { cache: "no-store" });
        if (!res.ok) throw new Error("api");
        const json = await res.json();
        const active: string[] = (json.items ?? [])
          .filter((x: Item) => x.is_active !== false)
          .sort((a: Item, b: Item) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
          .map((x: Item) => x.content)
          .filter(Boolean);

        if (!cancelled) {
          setItems(active.length ? active : FALLBACK_HEADLINES);
        }
      } catch {
        if (!cancelled) setItems(FALLBACK_HEADLINES);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Inline save (works if API is configured; otherwise just updates locally)
  const handleUpdate = async (next: string[]) => {
    setItems(next);
    try {
      await fetch("/api/news", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: next.map((content, i) => ({ content, is_active: true, sort_order: i })),
        }),
      });
    } catch {
      // ignore if API not ready; ticker still shows locally
    }
  };

  if (!items.length) return null;

  return (
    <NewsTicker
      news={items}
      isAdmin={isAdmin}
      onUpdateNews={handleUpdate}
      backgroundColor="bg-red-600"
      textColor="text-white"
      speedPxPerSec={80}
    />
  );
}
