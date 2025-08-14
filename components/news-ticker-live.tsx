"use client";
import { useEffect, useState } from "react";
import NewsTicker from "./NewsTicker";

export function NewsTickerLive() {
  const [mounted, setMounted] = useState(false);
  const [isPrimary, setIsPrimary] = useState(true);

  useEffect(() => {
    setMounted(true);
    const others = document.querySelectorAll("#global-news-ticker .news-ticker-instance");
    if (others.length > 0) setIsPrimary(false);
  }, []);

  if (!mounted || !isPrimary) return null;

  return (
    <div className="news-ticker-instance">
      <NewsTicker />
    </div>
  );
}
