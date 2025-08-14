// components/breaking-news.tsx
"use client";

import { useEffect, useState } from "react";
import { NewsTicker } from "./NewsTicker";
import { getNewsItems } from "@/lib/news-data";

export function BreakingNews() {
  const [newsItems, setNewsItems] = useState<string[]>([]);

  useEffect(() => {
    try {
      const items = getNewsItems();
      setNewsItems(items || []);
    } catch (e) {
      console.error("Error loading news items:", e);
      setNewsItems([]);
    }
  }, []);

  // Render the bar even if empty (it will show the default message)
  return (
    <div className="w-full z-40 mt-16">
      <NewsTicker news={newsItems} />
    </div>
  );
}
