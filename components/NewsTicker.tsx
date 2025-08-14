"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Pause, Play, Edit, Plus, Trash2, X, Save } from "lucide-react";
import { Button } from "@/components/ui/button";

interface NewsTickerProps {
  news?: string[];
  speedPxPerSec?: number;      // pixels per second
  backgroundColor?: string;    // tailwind class e.g. "bg-red-600"
  textColor?: string;          // tailwind class e.g. "text-white"
  isAdmin?: boolean;
  onUpdateNews?: (news: string[]) => void;
  pauseOnHover?: boolean;
}

export default function NewsTicker({
  news = [],
  speedPxPerSec = 80,
  backgroundColor = "bg-red-600",
  textColor = "text-white",
  isAdmin = false,
  onUpdateNews,
  pauseOnHover = true,
}: NewsTickerProps) {
  const [isPaused, setIsPaused] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editableNews, setEditableNews] = useState<string[]>(news);
  const [newItem, setNewItem] = useState("");

  // Keep internal list in sync with props when not editing
  useEffect(() => {
    if (!isEditing) setEditableNews(news || []);
  }, [news, isEditing]);

  // Build the ticker text (two copies for seamless loop)
  const joined = useMemo(() => {
    const trimmed = (editableNews || []).map((s) => s.trim()).filter(Boolean);
    return trimmed.length ? trimmed.join("  •  ") : "";
  }, [editableNews]);

  // Measure width to set animation duration
  const trackRef = useRef<HTMLDivElement | null>(null);
  const [durationSec, setDurationSec] = useState<number>(20);

  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    // width of one copy (we render two copies in a row)
    const span = el.querySelector<HTMLSpanElement>('[data-copy="1"]');
    if (!span) return;

    const contentWidth = span.offsetWidth;
    const pxPerSec = Math.max(20, speedPxPerSec);
    const secs = Math.max(8, Math.round((contentWidth / pxPerSec) * 10) / 10);
    setDurationSec(secs);
  }, [joined, speedPxPerSec]);

  if (!joined) return null;

  // Editing handlers
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
  };

  return (
    <div className={`w-full ${backgroundColor} relative shadow-md`}>
      {/* Ticker row */}
      <div className="flex items-center py-3 px-4 gap-4 overflow-hidden">
        <div className="shrink-0">
          <span className={`font-bold ${textColor} text-sm md:text-base uppercase tracking-wider`}>
            Breaking News
          </span>
        </div>

        <div
          className="relative flex-1 overflow-hidden"
          onMouseEnter={pauseOnHover ? () => setIsPaused(true) : undefined}
          onMouseLeave={pauseOnHover ? () => setIsPaused(false) : undefined}
          aria-live="polite"
          role="status"
        >
          <div
            ref={trackRef}
            className={`${textColor}`}
            style={{
              display: "inline-flex",
              whiteSpace: "nowrap",
              animationName: "btv-marquee",
              animationDuration: `${durationSec}s`,
              animationTimingFunction: "linear",
              animationIterationCount: "infinite",
              animationPlayState: isPaused ? ("paused" as const) : ("running" as const),
            }}
          >
            {/* copy 1 */}
            <span data-copy="1" style={{ paddingInline: 32 }} className="font-medium text-sm md:text-base">
              {joined}
            </span>
            {/* copy 2 */}
            <span aria-hidden="true" style={{ paddingInline: 32 }} className="font-medium text-sm md:text-base">
              {joined}
            </span>
          </div>
        </div>

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

      {/* Inline editor (admins only) */}
      {isAdmin && isEditing && (
        <div className="bg-gray-900 p-4 border-t border-gray-800">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-white">Edit Breaking News</h3>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={cancel} className="text-gray-300 hover:text-white">
                <X className="h-4 w-4 mr-1" /> Close
              </Button>
              <Button onClick={save} className="bg-red-600 hover:bg-red-700">
                <Save className="h-4 w-4 mr-1" />
                Save
              </Button>
            </div>
          </div>

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
            {editableNews.length === 0 && <p className="text-sm text-gray-400">No items yet. Add one below.</p>}
          </div>

          <div className="flex items-stretch gap-2">
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
        </div>
      )}

      {/* Global keyframes (simple, avoids styled-jsx parser issues) */}
      <style>{`
        @keyframes btv-marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
      `}</style>
    </div>
  );
}
