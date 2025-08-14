"use client";

import { useEffect, useMemo, useState } from "react";
import NewsTicker from "@/components/NewsTicker"; // capital N
import { Button } from "@/components/ui/button";

type NewsRow = {
  id: string;
  content: string;
  is_active: boolean;
  sort_order: number;
  updated_at: string;
};

export default function NewsTickerLive({
  speedPxPerSec = 80,
  backgroundColor = "bg-red-600",
  textColor = "text-white",
}: {
  speedPxPerSec?: number;
  backgroundColor?: string;
  textColor?: string;
}) {
  const [items, setItems] = useState<NewsRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);

  const isAdmin = typeof window !== "undefined" && localStorage.getItem("btv_admin_auth") === "blacktruth_admin_2025";

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/news", { cache: "no-store" });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || "Failed to load news");
      setItems(json.items || []);
    } catch (e: any) {
      setError(e?.message || "Failed to load news");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const newsStrings = useMemo(
    () => items.filter((i) => i.is_active).sort((a, b) => a.sort_order - b.sort_order).map((i) => i.content),
    [items]
  );

  const handleUpdateNews = async (updated: string[]) => {
    setSaving(true);
    setError(null);
    try {
      const bodyItems = updated.map((content, idx) => ({ content, is_active: true, sort_order: idx }));
      const res = await fetch("/api/news", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: bodyItems }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || "Failed to save");
      setItems(json.items || []);
      setLastSavedAt(new Date().toLocaleTimeString());
    } catch (e: any) {
      setError(e?.message || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  if (loading && !items.length) return null;
  if (!newsStrings.length) return null;

  return (
    <>
      <NewsTicker
        news={newsStrings}
        speedPxPerSec={speedPxPerSec}
        backgroundColor={backgroundColor}
        textColor={textColor}
        isAdmin={isAdmin}
        onUpdateNews={handleUpdateNews}
      />
      {isAdmin && (
        <div className="w-full bg-gray-900/60 text-xs text-gray-300 px-4 py-2 flex items-center gap-3">
          {saving ? <span>Saving…</span> : lastSavedAt ? <span>Saved at {lastSavedAt}</span> : <span>Loaded</span>}
          <Button size="xs" variant="outline" className="h-6 px-2" onClick={load}>
            Refresh
          </Button>
          {error && <span className="text-red-400">• {error}</span>}
        </div>
      )}
    </>
  );
}
