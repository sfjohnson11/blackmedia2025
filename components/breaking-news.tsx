"use client";

import { useEffect, useState } from "react";
// IMPORTANT: match the actual file name's casing. If your file is "NewsTicker.tsx", import like this:
import { NewsTicker } from "./NewsTicker";
import { getNewsItems } from "@/lib/news-data";

export function BreakingNews() {
  const [newsItems, setNewsItems] = useState<string[]>([]);
  const [shouldRender, setShouldRender] = useState(false);

  useEffect(() => {
    // If the global ticker (in app/layout.tsx) is present, do NOT render a second one.
    const hasGlobal = !!document.getElementById("global-news-ticker");
    setShouldRender(!hasGlobal);

    // Load news text
    try {
      const items = getNewsItems();
      setNewsItems(items || []);
    } catch (error) {
      console.error("Error loading news items:", error);
      setNewsItems([]);
    }
  }, []);

  if (!shouldRender) return null;
  if (!newsItems || newsItems.length === 0) return null;

  return (
    <div className="bg-red-600 text-white w-full z-20 mt-16">
      <NewsTicker news={newsItems} />
    </div>
  );
}
