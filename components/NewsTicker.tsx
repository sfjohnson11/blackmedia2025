// components/NewsTicker.tsx — marquee ticker with optional admin editing
"use client";

import { useState, useEffect } from "react";
import { Pause, Play, Edit } from "lucide-react";
import { Button } from "@/components/ui/button";

interface NewsTickerProps {
  news?: string[];
  /** seconds for one full marquee pass (default 30) */
  speed?: number;
  /** Tailwind class for background (default bg-red-600) */
  backgroundColor?: string;
  /** Tailwind class for text (default text-white) */
  textColor?: string;
  /** When true, show edit controls below the ticker */
  isAdmin?: boolean;
  /** Called whenever the list is saved/updated */
  onUpdateNews?: (news: string[]) => void;
}

function NewsTickerComponent({
  news = [],
  speed = 30,
  backgroundColor = "bg-red-600",
  textColor = "text-white",
  isAdmin = false,
  onUpdateNews,
}: NewsTickerProps) {
  const [isPaused, setIsPaused] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editableNews, setEditableNews] = useState<string[]>(news);
  const [newNewsItem, setNewNewsItem] = useState("");

  useEffect(() => {
    setEditableNews(Array.isArray(news) ? news : []);
  }, [news]);

  const handleSaveNews = () => {
    const cleaned = editableNews.map((s) => s.trim()).filter(Boolean);
    setEditableNews(cleaned);
    onUpdateNews?.(cleaned);
    setIsEditing(false);
  };

  const handleAddNewsItem = () => {
    const next = newNewsItem.trim();
    if (!next) return;
    const updated = [...editableNews, next];
    setEditableNews(updated);
    setNewNewsItem("");
    onUpdateNews?.(updated);
  };

  const handleRemoveNewsItem = (index: number) => {
    const updated = editableNews.filter((_, i) => i !== index);
    setEditableNews(updated);
    onUpdateNews?.(updated);
  };

  if (!editableNews || editableNews.length === 0) return null;

  return (
    <div className={`w-full ${backgroundColor} relative shadow-md`}>
      {/* Ticker row */}
      <div className="flex items-center py-3 px-4 gap-4 overflow-hidden">
        {/* Label */}
        <div className="shrink-0">
          <span className={`font-bold ${textColor} text-sm md:text-base uppercase tracking-wider`}>
            Breaking News
          </span>
        </div>

        {/* Scroller */}
        <div className="flex-1 overflow-hidden relative">
          <div
            className={`whitespace-nowrap ${textColor} font-medium text-sm md:text-base animate-marquee ${
              isPaused ? "paused" : ""
            }`}
            style={{
              display: "inline-block",
              whiteSpace: "nowrap",
              // speed is seconds for one full cycle
              animationDuration: `${Math.max(5, speed)}s`,
            }}
          >
            {editableNews.map((item, i) => (
              <span key={i} className="mx-8 inline-block">
                {item}
              </span>
            ))}
          </div>
        </div>

        {/* Controls */}
        <div className="ml-2 flex items-center">
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
              className={`${textColor} hover:bg-white/20 ml-1`}
              aria-label="Edit news items"
            >
              <Edit className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Admin editor */}
      {isAdmin && isEditing && (
        <div className="bg-gray-900 p-4 border-t border-gray-700">
          <h3 className="font-bold mb-3">Edit Breaking News</h3>

          <div className="space-y-3 mb-4">
            {editableNews.map((item, index) => (
              <div key={index} className="flex items-center">
                <input
                  type="text"
                  value={item}
                  onChange={(e) => {
                    const updated = [...editableNews];
                    updated[index] = e.target.value;
                    setEditableNews(updated);
                  }}
                  className="flex-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded-md"
                />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleRemoveNewsItem(index)}
                  className="ml-2 text-red-400 hover:text-red-300"
                >
                  Remove
                </Button>
              </div>
            ))}
          </div>

          <div className="flex mb-4">
            <input
              type="text"
              value={newNewsItem}
              onChange={(e) => setNewNewsItem(e.target.value)}
              placeholder="Add new news item..."
              className="flex-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded-l-md"
            />
            <Button onClick={handleAddNewsItem} className="rounded-l-none">
              Add
            </Button>
          </div>

          <div className="flex justify-end">
            <Button variant="outline" onClick={() => setIsEditing(false)} className="mr-2">
              Cancel
            </Button>
            <Button onClick={handleSaveNews}>Save Changes</Button>
          </div>
        </div>
      )}
    </div>
  );
}

// export both ways so imports like `import NewsTicker from "./NewsTicker"`
// and `import { NewsTicker } from "./NewsTicker"` both work.
const NewsTicker = NewsTickerComponent;
export { NewsTicker };
export default NewsTicker;
