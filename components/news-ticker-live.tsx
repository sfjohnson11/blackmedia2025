"use client";

import { useEffect, useState } from "react";
import NewsTicker from "./NewsTicker";
import { getNewsItems, setNewsItems } from "@/lib/news-data";
import { usePathname } from "next/navigation";

export function NewsTickerLive() {
  const pathname = usePathname();
  const isAdmin = pathname?.startsWith("/admin/news") ?? false;

  const [mounted, setMounted] = useState(false);
  const [items, setItems] = useState<string[]>([]);

  useEffect(() => {
    setMounted(true);
    setItems(getNewsItems());

    const handler = (e: StorageEvent) => {
      if (e.key === "btv_news_items") {
        try {
          const next = e.newValue ? JSON.parse(e.newValue) : [];
          setItems(Array.isArray(next) ? next : []);
        } catch {
          setItems([]);
        }
      }
    };
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, []);

  if (!mounted) return null;

  const effectiveItems =
    items.length > 0 ? items : ["Welcome to Black Truth TV • Breaking updates appear here."];

  // mt-16 ensures the ticker sits *below* the fixed navbar
  return (
    <div className="bg-red-600 text-white w-full z-20 mt-16">
      <NewsTicker
        news={effectiveItems}
        isAdmin={isAdmin}
        onUpdateNews={(next) => {
          setItems(next);
          setNewsItems(next);
        }}
      />
    </div>
  );
}

export default NewsTickerLive;
