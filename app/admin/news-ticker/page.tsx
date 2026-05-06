// app/admin/news-ticker/page.tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Item = {
  id: string;
  message: string;
};

export default function NewsTickerAdmin() {
  const [items, setItems] = useState<Item[]>([]);
  const [newText, setNewText] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/news", { cache: "no-store" });
      const data = await res.json();
      setItems(Array.isArray(data.items) ? data.items : []);
    } catch (e: any) {
      setError(e?.message || "Failed to load");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function addItem(e: React.FormEvent) {
    e.preventDefault();
    if (!newText.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/news", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: newText.trim() }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || "Failed to add");
      }
      setNewText("");
      await load();
    } catch (e: any) {
      setError(e?.message || "Failed to add item");
    } finally {
      setBusy(false);
    }
  }

  async function deleteItem(id: string) {
    if (!confirm("Delete this ticker item?")) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/news?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || "Failed to delete");
      }
      await load();
    } catch (e: any) {
      setError(e?.message || "Failed to delete item");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-black text-white p-6">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">News Ticker</h1>
            <p className="text-sm text-slate-400 mt-1">
              Items shown in the scrolling banner on the member hub.
            </p>
          </div>
          <Link
            href="/admin"
            className="text-sm text-amber-300 underline hover:text-amber-400"
          >
            ← Back to Admin
          </Link>
        </div>

        <form
          onSubmit={addItem}
          className="bg-slate-900 border border-slate-700 rounded-lg p-4 space-y-3"
        >
          <label className="block">
            <span className="text-xs uppercase tracking-wide text-slate-400">
              New ticker message
            </span>
            <input
              type="text"
              value={newText}
              onChange={(e) => setNewText(e.target.value)}
              placeholder="e.g. Watch our new music channel coming soon!"
              className="mt-1 w-full rounded-md bg-slate-950 border border-slate-700 px-3 py-2 text-sm focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400"
              maxLength={300}
            />
          </label>
          <button
            type="submit"
            disabled={busy || !newText.trim()}
            className="rounded-full bg-amber-500 px-4 py-2 text-sm font-semibold text-black hover:bg-amber-400 disabled:opacity-50"
          >
            {busy ? "Saving…" : "Add to ticker"}
          </button>
        </form>

        {error && (
          <div className="bg-red-950/50 border border-red-700 rounded-md px-3 py-2 text-sm text-red-200">
            {error}
          </div>
        )}

        <div className="bg-slate-900 border border-slate-700 rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-700 text-sm font-semibold">
            Current items ({items.length})
          </div>
          {loading ? (
            <div className="px-4 py-6 text-sm text-slate-400">Loading…</div>
          ) : items.length === 0 ? (
            <div className="px-4 py-6 text-sm text-slate-400">
              No ticker items yet. Add one above.
            </div>
          ) : (
            <ul className="divide-y divide-slate-800">
              {items.map((item) => (
                <li
                  key={item.id}
                  className="flex items-center gap-3 px-4 py-3 text-sm"
                >
                  <span className="flex-1">{item.message}</span>
                  <button
                    onClick={() => deleteItem(item.id)}
                    disabled={busy}
                    className="text-xs text-red-400 hover:text-red-300 disabled:opacity-50"
                  >
                    Delete
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
