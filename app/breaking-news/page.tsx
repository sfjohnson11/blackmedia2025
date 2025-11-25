// app/admin/breaking-news/page.tsx
"use client";

import { useEffect, useState, FormEvent } from "react";
import Link from "next/link";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import { Loader2, Save, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

type BreakingNewsRow = {
  id: number;
  title: string | null;
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

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setErrorMsg(null);

      const { data, error } = await supabase
        .from("breaking_news")
        .select("id, title, content, is_active, sort_order, updated_at")
        .order("sort_order", { ascending: true })
        .order("id", { ascending: true });

      if (error) {
        console.error(error);
        setErrorMsg("Error loading breaking news.");
      } else {
        const rows = data ?? [];
        setRows(rows);
        setOriginalRows(rows);
      }

      setLoading(false);
    };

    load();
  }, [supabase]);

  const handleFieldChange = (
    id: number,
    field: keyof BreakingNewsRow,
    value: any
  ) => {
    setRows(prev =>
      prev.map(row =>
        row.id === id ? { ...row, [field]: value } : row
      )
    );
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      // Only update rows that actually changed
      const changed = rows.filter(row => {
        const original = originalRows.find(o => o.id === row.id);
        return JSON.stringify(original) !== JSON.stringify(row);
      });

      if (changed.length === 0) {
        setSuccessMsg("No changes to save.");
        setSaving(false);
        return;
      }

      const { error } = await supabase.from("breaking_news").upsert(
        changed.map(r => ({
          id: r.id,
          title: r.title?.trim() || null,
          content: r.content?.trim() || null,
          is_active: r.is_active ?? false,
          sort_order: r.sort_order,
        })),
        { onConflict: "id" }
      );

      if (error) {
        console.error(error);
        setErrorMsg("Error saving changes.");
      } else {
        setSuccessMsg("Breaking news updated.");
        setOriginalRows(rows);
      }
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center gap-2">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span>Loading breaking news…</span>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            href="/admin"
            className="inline-flex items-center text-sm text-blue-200 hover:text-white"
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back to Admin
          </Link>
          <h1 className="text-2xl font-semibold">Breaking News Boxes</h1>
        </div>
      </div>

      {errorMsg && (
        <div className="rounded-md border border-red-600 bg-red-950/40 px-4 py-2 text-sm text-red-100">
          {errorMsg}
        </div>
      )}
      {successMsg && (
        <div className="rounded-md border border-emerald-600 bg-emerald-950/40 px-4 py-2 text-sm text-emerald-100">
          {successMsg}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <p className="text-sm text-slate-300">
          You have three boxes on the public{" "}
          <strong>Breaking News</strong> page. Use the fields below to
          set the <strong>title</strong> and <strong>content</strong> for
          each box. Only the text you enter here will show to users.
        </p>

        <div className="grid gap-6 md:grid-cols-3">
          {rows.slice(0, 3).map((row, index) => (
            <div
              key={row.id}
              className="rounded-xl border border-slate-700 bg-slate-900/60 p-4 flex flex-col gap-3"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs uppercase tracking-wide text-slate-400">
                  Box {index + 1}
                </span>
                <label className="flex items-center gap-2 text-xs text-slate-300">
                  <input
                    type="checkbox"
                    className="h-3 w-3"
                    checked={!!row.is_active}
                    onChange={e =>
                      handleFieldChange(row.id, "is_active", e.target.checked)
                    }
                  />
                  Active
                </label>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-200">
                  Title
                </label>
                <input
                  type="text"
                  value={row.title ?? ""}
                  onChange={e =>
                    handleFieldChange(row.id, "title", e.target.value)
                  }
                  className="w-full rounded-md border border-slate-600 bg-slate-950/60 px-2 py-1.5 text-sm text-slate-50"
                  placeholder={`Box ${index + 1} title`}
                />
              </div>

              <div className="space-y-1 flex-1">
                <label className="text-xs font-medium text-slate-200">
                  Content
                </label>
                <textarea
                  value={row.content ?? ""}
                  onChange={e =>
                    handleFieldChange(row.id, "content", e.target.value)
                  }
                  className="w-full min-h-[140px] rounded-md border border-slate-600 bg-slate-950/60 px-2 py-1.5 text-sm text-slate-50"
                  placeholder={`Write the message you want visitors to see in Box ${index + 1}`}
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-200">
                  Sort Order (1–3)
                </label>
                <input
                  type="number"
                  value={row.sort_order ?? index + 1}
                  onChange={e =>
                    handleFieldChange(
                      row.id,
                      "sort_order",
                      e.target.value ? Number(e.target.value) : null
                    )
                  }
                  className="w-20 rounded-md border border-slate-600 bg-slate-950/60 px-2 py-1.5 text-xs text-slate-50"
                />
              </div>
            </div>
          ))}
        </div>

        <div className="flex justify-end">
          <Button type="submit" disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            <Save className="mr-2 h-4 w-4" />
            Save Changes
          </Button>
        </div>
      </form>
    </div>
  );
}
