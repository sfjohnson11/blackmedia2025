"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Pause, Play, Edit, Plus, Trash2, X, Save } from "lucide-react";
import { Button } from "@/components/ui/button";

interface NewsTickerProps {
  news?: string[];
  speedPxPerSec?: number;
  backgroundColor?: string;
  textColor?: string;
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

  useEffect(() => {
    if (!isEditing) setEditableNews(news || []);
  }, [news, isEditing]);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const firstCopyRef = useRef<HTMLSpanElement | null>(null);
  const [durationSec, setDurationSec] = useState<number>(20);

  const joined = useMemo(() => {
    const trimmed = (editableNews || []).map((s) => s.trim()).filter(Boolean);
    return trimmed.length ? trimmed.join("  •  ") : "";
  }, [editableNews]);

  useEffect(() => {
    const measure = () => {
      if (!firstCopyRef.current) return;
      const contentWidth = firstCopyRef.current.offsetWidth;
      const pxPerSec = Math.max(20, speedPxPerSec);
      const secs = Math.max(8, Math.round((contentWidth / pxPerSec) * 10) / 10);
      setDurationSec(secs);
    };
    measure();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(measure) : null;
    if (ro && firstCopyRef.current) ro.observe(firstCopyRef.current);
    window.addEventListener("resize", measure);
    return () => {
      window.removeEventListener("resize", measure);
      ro?.disconnect();
    };
  }, [speedPxPerSec, joined]);

  useEffect(() => {
    const onVis = () => setIsPaused(document.visibilityState !== "visible");
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  if (!joined) return null;

  const addItem = () => {
    const next = newItem.trim();
    if (!next) return;
    setEditableNews((prev) => [...prev, next]);
    setNewItem("");
  };
  const removeIndex = (i: number) => setEditableNews((prev) => prev.filter((_, idx) => idx !== i));
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
      <div className="flex items-center py-3 px-4 gap-4 overflow-hidden">
        <div className="shrink-0">
          <span className={`font-bold ${textColor} text-sm md:text-base uppercase tracking-wider`}>
            Breaking News
          </span>
        </div>

        <div
          className="relative flex-1 overflow-hidden"
          ref={containerRef}
          onMouseEnter={pauseOnHover ? () => setIsPaused(true) : undefined}
          onMouseLeave={pauseOnHover ? () => setIsPaused(false) : undefined}
          aria-live="polite"
          role="status"
        >
          <div
            className={`flex items-center marquee-track ${isPaused ? "is-paused" : ""} ${textColor}`}
            style={{ ["--marquee-duration" as any]: `${durationSec}s` }}
          >
            <span ref={firstCopyRef} className="px-8 whitespace-nowrap font-medium text-sm md:text-base">
              {joined}
            </span>
            <span aria-hidden="true" className="px-8 whitespace-nowrap font-medium text-sm md:text-base">
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

      {isAdmin && isEditing && (
        <div className="bg-gray-900 p-4 border-t border-gray-800">
