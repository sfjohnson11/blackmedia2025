// NewsTicker.tsx — seamless marquee + admin editor (improved)
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Pause, Play, Edit, Plus, Trash2, X, Save } from "lucide-react";
import { Button } from "@/components/ui/button";

interface NewsTickerProps {
  /** List of news items (strings). If empty/undefined, ticker hides. */
  news?: string[];
  /** Pixels per second; higher = faster. Default 80. */
  speedPxPerSec?: number;
  /** Tailwind bg class for strip (e.g., "bg-red-600"). */
  backgroundColor?: string;
  /** Tailwind text class (e.g., "text-white"). */
  textColor?: string;
  /** Show editor controls. */
  isAdmin?: boolean;
  /** Called when user clicks Save in editor. */
  onUpdateNews?: (news: string[]) => void;
  /** Pause when hovering over strip (default true). */
  pauseOnHover?: boolean;
}

export function NewsTicker({
  news = [],
  speedPxPerSec = 80,
  backgroundColor = "bg-red-600",
  textColor = "text-white",
  isAdmin = false,
  onUpdateNews,
  pauseOnHover = true,
}: NewsTickerProps) {
  // Display state
  const [isPaused, setIsPaused] = useState(false);

  // Editor state
  const [isEditing, setIsEditing] = useState(false);
  const [editableNews, setEditableNews] = useState<string[]>(news);
  const [newItem, setNewItem] = useState("");

  // Re-sync editor when props.news changes (but don’t clobber while actively editing)
  useEffect(() => {
    if (!isEditing) setEditableNews(news || []);
  }, [news, isEditing]);

  // --- Marquee measurement (for smooth, duration-based animation) ---
  const containerRef = useRef<HTMLDivElement | null>(null);
  const firstCopyRef = useRef<HTMLSpanElement | null>(null);
  const [durationSec, setDurationSec] = useState<number>(20);

  // Join news with a separator for nicer spacing
  const joined = useMemo(() => {
    const trimmed = (editableNews || []).map((s) => s.trim()).filter(Boolean);
    // If nothing to show, component hides below
    return trimmed.length ? trimmed.join("  •  ") : "";
  }, [editableNews]);

  // Measure content width and compute duration = width / pxPerSec
  useEffect(() => {
    const measure = () => {
      if (!firstCopyRef.current) return;
      const contentWidth = firstCopyRef.current.offsetWidth;
      const pxPerSec = Math.max(20, speedPxPerSec); // clamp to avoid 0/very slow
      const secs = Math.max(8, Math.round((contentWidth / pxPerSec) * 10) / 10); // min 8s, 0.1s precision
      setDurationSec(secs);
    };

    measure();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(measure) : null;
    if (ro && firstCopyRef.current) ro.observe(firstCopyRef.current);
    // also re-measure on window resize
    window.addEventListener("resize", measure);
    return () => {
      window.removeEventListener("resize", measure);
      ro?.disconnect();
    };
  }, [speedPxPerSec, joined]);

  // Visibility API: pause when tab is hidden (saves CPU)
  useEffect(() => {
    const onVis = () => setIsPaused(document.visibilityState !== "visible");
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  // Don’t render if nothing to show
  if (!joined) return null;

  // Editing handlers (only call onUpdateNews when hitting Save)
  const addItem = () => {
    const next = newItem.trim();
    if (!next) return;
    setEditableNews((prev) => [...prev, next]);
    setNewItem("");
  };
  const removeIndex = (i: number) => {
    setEditableNews((prev) => prev.filter((_, idx) => idx !== i));
  };
  const save = () => {
    const cleaned = editableNews.map((s) => s.trim()).filter(Boolean);
    onUpdateNews?.(cleaned);
    setIsEditing(false);
  };
  const cancel = () => {
    setEditableNews(news || []);
    setIsEditing(false);
  };

  return (
    <div className={`w-full ${backgroundColor} relative shadow-md`}>

      {/* Top row: label + marquee + controls */}
      <div className="flex items-center py-3 px-4 gap-4 overflow-hidden">
        <div className="shrink-0">
          <span className={`font-bold ${textColor} text-sm md:text-base uppercase tracking-wider`}>
            Breaking News
          </span>
        </div>

        {/* Marquee container */}
        <div
          className="relative flex-1 overflow-hidden"
          ref={containerRef}
          onMouseEnter={pauseOnHover ? () => setIsPaused(true) : undefined}
          onMouseLeave={pauseOnHover ? () => setIsPaused(false) : undefined}
          aria-live="polite"
          aria-atomic="false"
          role="status"
        >
          <div
            className={`flex items-center marquee-track ${isPaused ? "is-paused" : ""} ${textColor}`}
            style={
              {
                // @ts-expect-error CSS var
                "--marquee-duration": `${durationSec}s`,
              } as React.CSSProperties
            }
          >
            {/* Copy #1 */}
            <span ref={firstCopyRef} className="px-8 whitespace-nowrap font-medium text-sm md:text-base">
              {joined}
            </span>
            {/* Copy #2 (for seamless loop) */}
            <span aria-hidden="true" className="px-8 whitespace-nowrap font-medium text-sm md:text-base">
              {joined}
            </span>
          </div>
        </div>

        {/* Controls */}
        <div className="ml-2 flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsPaused((p) => !p)}
            className={`${textColor} hover:bg-white/20`}
            aria-label={isPaused ? "Play ticker" : "Pause ticker"}
          >
            {isPaused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
          </Button>

          {isAdmin && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsEditing((e) => !e)}
              className={`${textColor} hover:bg-white/20`}
              aria-label="Edit Breaking News"
              title="Edit Breaking News"
            >
              <Edit className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Admin Editor */}
      {isAdmin && isEditing && (
        <div className="bg-gray-900 p-4 border-t border-gray-800">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-white">Edit Breaking News</h3>
            <Button variant="ghost" size="sm" onClick={cancel} className="text-gray-300 hover:text-white">
              <X className="h-4 w-4 mr-1" /> Close
            </Button>
          </div>

          {/* Existing items */}
          <div className="space-y-2 mb-4">
            {editableNews.map((item, index) => (
              <div key={index} className="flex items-center gap-2">
                <input
                  type="text"
                  value={item}
                  onChange={(e) =>
                    setEditableNews((prev) => prev.map((v, i) => (i === index ? e.target.value : v)))
                  }
                  className="flex-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-white"
                />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeIndex(index)}
                  className="text-red-400 hover:text-red-300"
                  title="Remove item"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
            {editableNews.length === 0 && (
              <p className="text-sm text-gray-400">No items yet. Add one below.</p>
            )}
          </div>

          {/* Add new item */}
          <div className="flex items-stretch gap-2 mb-4">
            <input
              type="text"
              value={newItem}
              onChange={(e) => setNewItem(e.target.value)}
              placeholder="Add new news item…"
              className="flex-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-white"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addItem();
                }
              }}
            />
            <Button onClick={addItem} title="Add item">
              <Plus className="h-4 w-4 mr-1" />
              Add
            </Button>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={cancel}>
              Cancel
            </Button>
            <Button onClick={save} className="bg-red-600 hover:bg-red-700">
              <Save className="h-4 w-4 mr-1" />
              Save Changes
            </Button>
          </div>
        </div>
      )}

      {/* Local styles for the marquee */}
      <style jsx>{`
        .marquee-track {
          width: max-content;
          /* 2 copies laid out in a row */
          gap: 0;
          animation: marquee var(--marquee-duration, 20s) linear infinite;
        }
        .marquee-track.is-paused {
          animation-play-state: paused;
        }
        @keyframes marquee {
          0% {
            transform: translateX(0);
          }
          100% {
            transform: translateX(-50%);
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .marquee-track {
            animation: none !important;
          }
        }
      `}</style>
    </div>
  );
}

export default NewsTicker;
