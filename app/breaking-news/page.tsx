// app/admin/breaking-news/page.tsx
"use client";

import { useEffect, useState, FormEvent } from "react";
import Link from "next/link";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import { Loader2, Save, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

type BreakingNewsRow = {
  id: number;
  content: string | null;
  is_active: boolean | null;
  sort_order: number | null;
  updated_at: string | null;
};

export default function AdminBreakingNewsPage() {
  const supabase = createClientComponentClient();

  const [rows, setRows] = useState<BreakingNewsRow[]>([]);
  const [originalRows, setOriginalRows] = useState<BreakingNewsRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Load from breaking_news
  async function loadRows() {
    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const { data, error } = await supabase
        .from("breaking_news")
        .select("id, content, is_active, sort_order, updated_at")
        .order("sort_order", { ascending: true })
        .order("id", { ascending: true });

      if (error) throw error;

      const rows = (data || []) as BreakingNewsRow[];
      setRows(rows);
      setOriginalRows(rows);
    } catch (e: any) {
      console.error("Error loading breaking_news:", e);
      setErrorMsg(e?.message || "Failed to load breaking news rows.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadRows();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function updateField<K extends keyof BreakingNewsRow>(
    id: number,
    field: K,
    value: BreakingNewsRow[K]
  ) {
    setRows((prev) =>
      prev.map((row) =>
        row.id === id ? { ...row, [field]: value } : row
      )
    );
  }

  async function addRow() {
    setSaving(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const maxSort =
        rows.reduce(
          (max, r) =>
            r.sort_order != null && r.sort_order > max ? r.sort_order : max,
          0
        ) || 0;

      const { data, error } = await supabase
        .from("breaking_news")
        .insert({
          content: "",
          is_active: true,
          sort_order: maxSort + 1,
        })
        .select("id, content, is_active, sort_order, updated_at")
        .single();

      if (error) throw error;

      const newRow = data as BreakingNewsRow;
      const next = [...rows, newRow].sort((a, b) => {
        const sa = a.sort_order ?? 0;
        const sb = b.sort_order ?? 0;
        if (sa === sb) return a.id - b.id;
        return sa - sb;
      });

      setRows(next);
      setOriginalRows(next);
      setSuccessMsg("New breaking news item created.");
    } catch (e: any) {
      console.error("Error creating row:", e);
      setErrorMsg(e?.message || "Unexpected error creating row.");
    } finally {
      setSaving(false);
    }
  }

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const changed = rows.filter((row) => {
        const original = originalRows.find((o) => o.id === row.id);
        if (!original) return true;

        const origContent = original.content ?? "";
        const newContent = row.content ?? "";
        const origActive = Boolean(original.is_active);
        const newActive = Boolean(row.is_active);
        const origSort = original.sort_order ?? 0;
        const newSort = row.sort_order ?? 0;

        return (
          origContent !== newContent ||
          origActive !== newActive ||
          origSort !== newSort
        );
      });

      if (changed.length === 0) {
        setSuccessMsg("No changes to save.");
        setSaving(false);
        return;
      }

      const results = await Promise.all(
        changed.map((row) =>
          supabase
            .from("breaking_news")
            .update({
              content: row.content,
              is_active: row.is_active ?? false,
              sort_order: row.sort_order,
            })
            .eq("id", row.id)
        )
      );

      const firstError = results.find((r) => r.error)?.error;
      if (firstError) {
        console.error("Save error:", firstError);
        setErrorMsg(firstError.message);
      } else {
        setSuccessMsg(
          `Updated ${changed.length} item${
            changed.length === 1 ? "" : "s"
          } successfully!`
        );
        setOriginalRows(rows);
      }
    } catch (e: any) {
      console.error("Unexpected save error:", e);
      setErrorMsg(e?.message || "Unexpected error saving changes.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-black text-white p-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Breaking News Admin</h1>
          <p className="mt-1 text-sm text-gray-300">
            Edit the items stored in the{" "}
            <code className="text-amber-300">breaking_news</code> table.
          </p>
          <p className="mt-0.5 text-xs text-gray-400">
            These rows can feed your /breaking-news hub or a ticker.
          </p>
        </div>

        <Link href="/admin">
          <Button
            variant="outline"
            className="border-gray-600 bg-gray-900 text-xs"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Admin
          </Button>
        </Link>
      </div>

      {/* Alerts */}
      {errorMsg && (
        <div className="mb-4 rounded border border-red-500 bg-red-900/40 p-3 text-sm text-red-100">
          {errorMsg}
        </div>
      )}
      {successMsg && (
        <div className="mb-4 rounded border border-emerald-500 bg-emerald-900/40 p-3 text-sm text-emerald-100">
          {successMsg}
        </div>
      )}

      {/* Top buttons */}
      <div className="mb-4 flex justify-between">
        <button
          type="button"
          onClick={addRow}
          disabled={saving}
          className="rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold hover:bg-emerald-700 disabled:opacity-60"
        >
          + Add Breaking News Item
        </button>

        <Button
          type="button"
          onClick={handleSave}
          disabled={saving || loading}
          className="bg-amber-600 hover:bg-amber-700"
        >
          {saving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving…
            </>
          ) : (
            <>
              <Save className="mr-2 h-4 w-4" />
              Save All Changes
            </>
          )}
        </Button>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex flex-col items-center gap-2 py-10 text-sm text-gray-300">
          <Loader2 className="h-5 w-5 animate-spin" />
          Loading breaking news…
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded border border-gray-700 bg-gray-900/60 p-4 text-sm text-gray-300">
          No breaking news items yet. Click{" "}
          <span className="font-semibold">“Add Breaking News Item”</span> to
          create your first row.
        </div>
      ) : (
        <form onSubmit={handleSave} className="space-y-4">
          {rows.map((row) => (
            <div
              key={row.id}
              className="rounded-xl border border-gray-700 bg-gray-900/70 p-4"
            >
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-xs text-gray-400">
                <span>
                  ID: <span className="font-mono">{row.id}</span>
                </span>

                <span className="flex items-center gap-1">
                  Sort order:
                  <input
                    type="number"
                    value={row.sort_order ?? 0}
                    onChange={(e) =>
                      updateField(
                        row.id,
                        "sort_order",
                        Number(e.target.value)
                      )
                    }
                    className="w-16 rounded border border-gray-600 bg-gray-950 px-2 py-1 text-xs text-white"
                  />
                </span>

                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={Boolean(row.is_active)}
                    onChange={(e) =>
                      updateField(row.id, "is_active", e.target.checked)
                    }
                  />
                  <span className="text-gray-200">Active</span>
                </label>

                {row.updated_at && (
                  <span className="text-[11px] text-gray-500">
                    Updated: {new Date(row.updated_at).toLocaleString()}
                  </span>
                )}
              </div>

              <textarea
                value={row.content ?? ""}
                onChange={(e) => updateField(row.id, "content", e.target.value)}
                rows={4}
                className="mt-1 w-full rounded border border-gray-600 bg-black/60 px-3 py-2 text-sm text-white outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400"
                placeholder="Full text of this breaking news item…"
              />
            </div>
          ))}

          {/* bottom save just in case */}
          <div className="flex justify-end pt-2">
            <Button
              type="submit"
              disabled={saving}
              className="bg-amber-600 hover:bg-amber-700"
            >
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving…
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Save All Changes
                </>
              )}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
