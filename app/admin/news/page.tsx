"use client";

import { useEffect, useState } from "react";
import { getNewsItems, saveNewsItems } from "@/lib/news-data";
import Link from "next/link";

export default function AdminNewsPage() {
  const [items, setItems] = useState<string[]>([]);
  const [draft, setDraft] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const found = await getNewsItems();
      setItems(found);
    })();
  }, []);

  function remove(i: number) {
    setItems((prev) => prev.filter((_, idx) => idx !== i));
  }

  async function add() {
    if (!draft.trim()) return;
    setItems((prev) => [...prev, draft.trim()]);
    setDraft("");
  }

  async function save() {
    setSaving(true);
    setMsg(null);
    const res = await saveNewsItems(items);
    setSaving(false);
    setMsg(res.ok ? "Saved!" : res.error || "Failed to save");
  }

  return (
    <div className="container mx-auto max-w-2xl p-6">
      <div className="mb-4 flex items-center gap-3">
        <Link href="/admin" className="text-sm text-gray-300 hover:text-white">← Back</Link>
        <h1 className="text-xl font-bold">Breaking News (Ticker)</h1>
      </div>

      <div className="space-y-3">
        {items.map((it, i) => (
          <div key={i} className="flex gap-2">
            <input
              value={it}
              onChange={(e) => {
                const v = e.target.value;
                setItems((prev) => prev.map((p, idx) => (idx === i ? v : p)));
              }}
              className="flex-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded"
            />
            <button
              onClick={() => remove(i)}
              className="px-3 rounded bg-gray-800 border border-gray-700 hover:bg-gray-700"
            >
              Remove
            </button>
          </div>
        ))}
      </div>

      <div className="mt-4 flex gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Add a new ticker item…"
          className="flex-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded"
        />
        <button
          onClick={add}
          className="px-4 rounded bg-red-600 hover:bg-red-700"
        >
          Add
        </button>
      </div>

      <div className="mt-6 flex gap-2">
        <button
          onClick={save}
          disabled={saving}
          className="px-4 py-2 rounded bg-red-600 hover:bg-red-700 disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save changes"}
        </button>
        {msg && <span className="text-sm text-gray-300">{msg}</span>}
      </div>
    </div>
  );
}
