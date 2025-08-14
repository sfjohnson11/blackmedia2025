"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";

// Load the visual ticker client-side
const NewsTicker = dynamic(() => import("./NewsTicker"), { ssr: false });

type Item = { content: string; is_active?: boolean; sort_order?: number };

export default function NewsTickerLive() {
  const [items, setItems] = useState<string[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);

  // Fetch headlines from API (safe if API missing or key not set)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/news", { cache: "no-store" });
        if (!res.ok) throw new Error("http");
        const json = await res.json();
        const active: string[] = (json.items ?? [])
          .filter((x: Item) => x.is_active !== false)
          .sort((a: Item, b: Item) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
          .map((x: Item) => x.content);
        if (!cancelled) setItems(active);
      } catch {
        // No API or empty table → show nothing for viewers, placeholder for admins
        if (!cancelled) setItems([]);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Simple admin detection using your existing localStorage flag
  useEffect(() => {
    try {
      const token = localStorage.getItem("btv_admin_auth");
      setIsAdmin(!!token);
    } catch {}
  }, []);

  // Allow inline edits to save back through the API (no crash if API missing)
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
      // Silent fail if API not configured; edits still update locally for this session
    }
  };

  // Hide for viewers if there’s nothing, but let admins see a prompt to add items
  const renderItems = items.length ? items : isAdmin ? ["Click ✎ to add headlines"] : [];

  if (!renderItems.length) return null;

  return (
    <NewsTicker
      news={renderItems}
      isAdmin={isAdmin}
      onUpdateNews={handleUpdate}
      backgroundColor="bg-red-600"
      textColor="text-white"
      speedPxPerSec={80}
    />
  );
}
