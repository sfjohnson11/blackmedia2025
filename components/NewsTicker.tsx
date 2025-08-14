// components/NewsTicker.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { Pause, Play } from "lucide-react";
import { Button } from "@/components/ui/button";

type Props = {
  news?: string[];
  speed?: number; // seconds for one full scroll
  backgroundColor?: string; // tailwind bg class
  textColor?: string; // tailwind text class
};

export function NewsTicker({
  news = [],
  speed = 30,
  backgroundColor = "bg-red-600",
  textColor = "text-white",
}: Props) {
  // Always show at least one item so the bar is visible
  const items = news.length > 0 ? news : ["Welcome to Black Truth TV — streaming 24/7."];

  const [isPaused, setIsPaused] = useState(false);
  const trackRef = useRef<HTMLDivElement>(null);

  // Duplicate items so the scroll looks continuous
  const doubled = [...items, ...items];

  useEffect(() => {
    if (!trackRef.current) return;
    trackRef.current.style.setProperty("--marquee-duration", `${speed}s`);
  }, [speed]);

  return (
    <div className={`w-full ${backgroundColor} relative shadow-md`}>
      <div className="flex items-center py-3 px-4 gap-4 overflow-hidden">
        <div className="shrink-0">
          <span className={`font-bold ${textColor} text-sm md:text-base uppercase tracking-wider`}>
            BREAKING NEWS
          </span>
        </div>

        <div className="relative flex-1 overflow-hidden">
          <div
            ref={trackRef}
            className={`marquee-track ${textColor} ${isPaused ? "paused" : ""}`}
          >
            {doubled.map((item, i) => (
              <span key={i} className="mx-8 whitespace-nowrap font-medium text-sm md:text-base">
                {item}
              </span>
            ))}
          </div>
        </div>

        <div className="shrink-0">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsPaused((p) => !p)}
            className={`${textColor} hover:bg-white/20`}
            aria-label={isPaused ? "Play ticker" : "Pause ticker"}
          >
            {isPaused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
          </Button>
        </div>
      </div>
    </div>
  );
}
