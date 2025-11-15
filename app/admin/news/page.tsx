// app/admin/news/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  ArrowLeft,
  Loader2,
  Plus,
  Save,
  Trash2,
  Type,
} from "lucide-react";
import { getNewsItems, saveNewsItems } from "@/lib/news-data";
import { Button } from "@/components/ui/button";

type TickerState = {
  items: string[];
  loading: boolean;
  saving: boolean;
  msg: string | null;
  error: string | null;
};

export default function AdminNewsPage() {
  const [state, setState] = useState<TickerState>({
    items: [],
    loading: true,
    saving: false,
    msg: null,
    error: null,
  });

  const [draft, setDraft] = useState("");

  // Load on mount
  useEffect(() => {
    (async () => {
      try {
        const found = await getNewsItems();
        setState((s) => ({
          ...s,
          items: found,
          loading: false,
        }));
      } catch (e: any) {
        console.error(e);
        setState((s) => ({
          ...s,
          loading: false,
          error: e?.message || "Failed to load ticker items.",
        }));
      }
    })();
  }, []);

  const activeCount = useMemo(
    () => state.items.filter((t) => t.trim().length > 0).length,
    [state.items],
  );

  function updateItem(index: number, value: string) {
    setState((s) => {
      const next = [...s.items];
      next[index] = value;
      return { ...s, items: next, msg: null, error: null };
    });
  }

  function removeItem(index: number) {
    setState((s) => {
      const next = s.items.filter((_, i) => i !== index);
      return { ...s, items: next, msg: null, error: null };
    });
  }

  function addDraft() {
    const value = draft.trim();
    if (!value) return;
    setState((s) => ({
      ...s,
      items: [...s.items, value],
      msg: null,
      error: null,
    }));
    setDraft("");
  }

  async function handleSave() {
    setState((s) => ({ ...s, saving: true, msg: null, error: null }));
    const trimmed = state.items.map((t) => t.trim()).filter((t) => t.length > 0);

    const res = await saveNewsItems(trimmed);

    if (!res.ok) {
      setState((s) => ({
        ...s,
        saving: false,
        error: res.error || "Failed to save changes.",
        msg: null,
      }));
      return;
    }

    setState((s) => ({
      ...s,
      saving: false,
      msg: `Saved ${trimmed.length} ticker item${
        trimmed.length === 1 ? "" : "s"
      }.`,
      error: null,
      items: trimmed,
    }));
  }

  async function handleClearAll() {
    if (!confirm("Clear all ticker items? This will remove all breaking news.")) {
      return;
    }

    setState((s) => ({ ...s, saving: true, msg: null, error: null }));
    const res = await saveNewsItems([]);

    if (!res.ok) {
      setState((s) => ({
        ...s,
        saving: false,
        error: res.error || "Failed to clear items.",
      }));
      return;
    }

    setState((s) => ({
      ...s,
      saving: false,
      items: [],
      msg: "Cleared all ticker items.",
    }));
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#040814] via-[#050b1a] to-black text-white pb-10">
      <div className="mx-auto max-w-4xl px-4 pt-8 space-y-6">
        {/* Top bar */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/admin"
              className="inline-flex items-center text-xs text-slate-300 hover:text-white"
            >
              <ArrowLeft className="mr-1 h-4 w-4" />
              Back to Admin
            </Link>
            <div className="rounded-full border border-rose-500/60 bg-rose-500/15 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-rose-200">
              Breaking News Ticker
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs text-slate-300">
              Active items:{" "}
              <span className="font-semibold text-amber-300">
                {activeCount}
              </span>
            </p>
            <p className="text-[11px] text-slate-400">
              These scroll across your Black Truth TV watch page.
            </p>
          </div>
        </div>

        {/* Main card */}
        <div className="rounded-xl border border-slate-700 bg-slate-900/75 p-4 shadow-lg shadow-black/60 space-y-5">
          {/* Existing items */}
          <div className="space-y-3">
            {state.loading ? (
              <div className="flex items-center justify-center py-8 text-sm text-slate-300">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Loading current ticker items…
              </div>
            ) : state.items.length === 0 ? (
              <p className="text-xs text-slate-400">
                No breaking news items yet. Add one below to start the ticker.
              </p>
            ) : (
              state.items.map((it, i) => (
                <div
                  key={i}
                  className="flex flex-col gap-2 rounded-lg border border-slate-700 bg-slate-950/80 p-3 sm:flex-row sm:items-start"
                >
                  <div className="flex-1">
                    <label className="mb-1 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                      <Type className="h-3 w-3" />
                      Item {i + 1}
                    </label>
                    <input
                      value={it}
                      onChange={(e) => updateItem(i, e.target.value)}
                      className="w-full rounded-md border border-slate-600 bg-slate-900 px-3 py-1.5 text-sm text-white placeholder-slate-500 focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400"
                      placeholder="Breaking headline or short alert…"
                    />
                    <p className="mt-1 text-[10px] text-slate-500">
                      Keep it short and punchy – this will scroll in the ticker.
                    </p>
                  </div>
                  <div className="flex flex-row justify-end gap-2 sm:flex-col sm:justify-between">
                    <Button
                      type="button"
                      size="icon"
                      variant="outline"
                      onClick={() => removeItem(i)}
                      className="border-slate-600 bg-slate-900/80 hover:bg-red-900/40"
                      title="Remove this item"
                    >
                      <Trash2 className="h-4 w-4 text-red-400" />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Add new item */}
          <div className="mt-4 rounded-lg border border-slate-700 bg-slate-950/80 p-3 space-y-2">
            <label className="mb-1 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
              <Plus className="h-3 w-3" />
              Add New Ticker Item
            </label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Type a new breaking news line…"
                className="flex-1 rounded-md border border-slate-600 bg-slate-900 px-3 py-1.5 text-sm text-white placeholder-slate-500 focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400"
              />
              <Button
                type="button"
                onClick={addDraft}
                disabled={!draft.trim()}
                className="bg-rose-600 text-sm hover:bg-rose-700"
              >
                <Plus className="mr-1 h-4 w-4" />
                Add
              </Button>
            </div>
            <p className="text-[10px] text-slate-500">
              You can add multiple lines; they will loop in the order shown above.
            </p>
          </div>

          {/* Status / errors */}
          {(state.error || state.msg) && (
            <div className="mt-3 flex items-start gap-2 rounded-md border border-slate-700 bg-slate-950/80 px-3 py-2 text-xs">
              {state.error && (
                <>
                  <AlertCircle className="mt-0.5 h-4 w-4 text-red-400" />
                  <p className="text-red-200">{state.error}</p>
                </>
              )}
              {!state.error && state.msg && (
                <p className="text-emerald-200">{state.msg}</p>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex gap-2">
              <Button
                type="button"
                onClick={handleSave}
                disabled={state.saving || state.loading}
                className="bg-emerald-600 text-sm hover:bg-emerald-700 disabled:opacity-60"
              >
                {state.saving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving…
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    Save Changes
                  </>
                )}
              </Button>

              <Button
                type="button"
                variant="outline"
                onClick={handleClearAll}
                disabled={
                  state.saving || state.loading || state.items.length === 0
                }
                className="border-red-500/70 bg-red-950/40 text-sm text-red-200 hover:bg-red-900/40 disabled:opacity-60"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Clear All
              </Button>
            </div>

            <p className="text-[11px] text-slate-400">
              Changes go live as soon as they are saved and read by your ticker
              component.
            </p>
          </div>
        </div>

        {/* Preview strip */}
        <div className="mt-4 rounded-full border border-rose-500/50 bg-gradient-to-r from-rose-900/70 via-black to-rose-900/70 px-4 py-3 text-xs text-rose-50 shadow-[0_0_24px_rgba(0,0,0,0.7)]">
          <span className="mr-3 inline-flex items-center gap-1 rounded-full bg-rose-700 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide">
            Live Preview
          </span>
          {activeCount === 0 ? (
            <span className="text-slate-300">
              No ticker items yet. Add a line above to see a preview.
            </span>
          ) : (
            <span className="whitespace-nowrap">
              {state.items
                .filter((t) => t.trim().length > 0)
                .join("  •  ")}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
