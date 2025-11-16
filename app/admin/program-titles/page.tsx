"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import { ArrowLeft, Loader2, RefreshCw, Save, Search } from "lucide-react";
import { Button } from "@/components/ui/button";

type ProgramRow = {
  channel_id: number;
  start_time: string;
  title: string | null;
  mp4_url: string;
  duration: number | null;
  _originalTitle: string | null;
  _dirty?: boolean;
};

const CHANNEL_OPTIONS = [
  { id: 1, label: "Channel 1" },
  { id: 2, label: "Channel 2" },
  { id: 3, label: "Channel 3" },
  { id: 4, label: "Channel 4" },
  { id: 5, label: "Channel 5" },
  { id: 6, label: "Channel 6" },
  { id: 7, label: "Channel 7" },
  { id: 8, label: "Channel 8" },
  { id: 9, label: "Channel 9" },
  { id: 10, label: "Channel 10" },
  { id: 11, label: "Channel 11" },
  { id: 12, label: "Channel 12" },
  { id: 13, label: "Channel 13" },
  { id: 14, label: "Channel 14" },
  { id: 15, label: "Channel 15" },
  { id: 16, label: "Channel 16" },
  { id: 17, label: "Channel 17" },
  { id: 18, label: "Channel 18" },
  { id: 19, label: "Channel 19" },
  { id: 20, label: "Channel 20" },
  { id: 21, label: "Channel 21" },
  { id: 22, label: "Channel 22" },
  { id: 23, label: "Channel 23" },
  { id: 24, label: "Channel 24" },
  { id: 25, label: "Channel 25" },
  { id: 26, label: "Channel 26" },
  { id: 27, label: "Channel 27" },
  { id: 28, label: "Channel 28" },
  { id: 29, label: "Channel 29" },
  { id: 30, label: "Channel 30 — Freedom School" },
];

export default function ProgramTitleEditorPage() {
  const supabase = createClientComponentClient();

  const [selectedChannel, setSelectedChannel] = useState<string>("");
  const [programs, setPrograms] = useState<ProgramRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  // Load programs for a channel
  async function loadPrograms() {
    setError(null);
    setStatus(null);
    setPrograms([]);

    const chId = Number(selectedChannel);
    if (!chId || Number.isNaN(chId)) {
      setError("Choose a channel first.");
      return;
    }

    setLoading(true);
    try {
      const { data, error: dbError } = await supabase
        .from("programs")
        .select("channel_id,start_time,title,mp4_url,duration")
        .eq("channel_id", chId)
        .order("start_time", { ascending: true })
        .limit(500);

      if (dbError) {
        console.error("Error loading programs", dbError);
        setError(`Database error: ${dbError.message}`);
        return;
      }

      const rows: ProgramRow[] =
        (data || []).map((row: any) => ({
          channel_id: Number(row.channel_id),
          start_time: row.start_time,
          title: row.title,
          mp4_url: row.mp4_url,
          duration:
            typeof row.duration === "number"
              ? row.duration
              : row.duration != null
              ? Number(row.duration)
              : null,
          _originalTitle: row.title,
          _dirty: false,
        })) || [];

      setPrograms(rows);
      setStatus(
        rows.length === 0
          ? "No programs found for this channel."
          : `Loaded ${rows.length} program(s).`
      );
    } catch (e: any) {
      console.error("Unexpected error loading programs", e);
      setError(e?.message || "Unexpected error loading programs.");
    } finally {
      setLoading(false);
    }
  }

  // Auto-load when channel changes
  useEffect(() => {
    if (!selectedChannel) return;
    loadPrograms();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedChannel]);

  // Helper: show just the file name portion
  function getFileName(mp4Url: string): string {
    if (!mp4Url) return "";
    try {
      // If it's a full URL, strip to path
      const u = new URL(mp4Url);
      const parts = u.pathname.split("/");
      return parts[parts.length - 1] || mp4Url;
    } catch {
      const parts = mp4Url.split("/");
      return parts[parts.length - 1] || mp4Url;
    }
  }

  function handleTitleChange(idx: number, value: string) {
    setPrograms((prev) =>
      prev.map((row, i) => {
        if (i !== idx) return row;
        const newTitle = value;
        const dirty = newTitle !== (row._originalTitle ?? "");
        return {
          ...row,
          title: newTitle,
          _dirty: dirty,
        };
      })
    );
    setStatus(null);
    setError(null);
  }

  const changedPrograms = useMemo(
    () => programs.filter((p) => p._dirty && p.title !== p._originalTitle),
    [programs]
  );
  const changedCount = changedPrograms.length;

  const filteredPrograms = useMemo(() => {
    if (!search.trim()) return programs;
    const q = search.toLowerCase();
    return programs.filter((p) => {
      const t = (p.title || "").toLowerCase();
      const f = getFileName(p.mp4_url).toLowerCase();
      return t.includes(q) || f.includes(q);
    });
  }, [programs, search]);

  async function handleSaveChanges() {
    setError(null);
    setStatus(null);

    if (changedCount === 0) {
      setStatus("No changes to save.");
      return;
    }

    setSaving(true);
    let updated = 0;

    try {
      for (const row of changedPrograms) {
        // Important: match by channel_id + start_time + mp4_url
        const { error: updateError } = await supabase
          .from("programs")
          .update({ title: row.title })
          .match({
            channel_id: row.channel_id,
            start_time: row.start_time,
            mp4_url: row.mp4_url,
          });

        if (updateError) {
          console.error("Update error for", row, updateError);
          setError(
            `Error updating "${row._originalTitle || getFileName(
              row.mp4_url
            )}": ${updateError.message}`
          );
          break;
        }

        updated += 1;
      }

      if (updated > 0 && !error) {
        // Mark updated rows clean
        setPrograms((prev) =>
          prev.map((row) => {
            const changed = changedPrograms.find(
              (c) =>
                c.channel_id === row.channel_id &&
                c.start_time === row.start_time &&
                c.mp4_url === row.mp4_url
            );
            if (!changed) return row;
            return {
              ...row,
              _originalTitle: row.title,
              _dirty: false,
            };
          })
        );
        setStatus(`Saved ${updated} change(s).`);
      }
    } catch (e: any) {
      console.error("Unexpected error saving changes", e);
      setError(e?.message || "Unexpected error saving changes.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#040814] via-[#050b1a] to-black text-white pb-10">
      <div className="mx-auto max-w-6xl px-4 pt-8 space-y-6">
        {/* Header */}
        <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <Link href="/admin">
              <Button
                variant="outline"
                className="border-slate-600 bg-slate-900 text-xs sm:text-sm"
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Admin
              </Button>
            </Link>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight">
                Program Title Editor
              </h1>
              <p className="mt-1 text-xs sm:text-sm text-slate-300">
                Clean up and rename program titles without touching your
                schedule or watch page.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={loadPrograms}
              disabled={!selectedChannel || loading}
              className="border-slate-600 bg-slate-900 text-xs sm:text-sm"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Reload
                </>
              ) : (
                <>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Reload
                </>
              )}
            </Button>
            <Button
              type="button"
              onClick={handleSaveChanges}
              disabled={saving || changedCount === 0}
              className="bg-emerald-600 hover:bg-emerald-700 text-xs sm:text-sm"
            >
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving…
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Save {changedCount > 0 ? `${changedCount} change(s)` : "changes"}
                </>
              )}
            </Button>
          </div>
        </header>

        {/* Controls */}
        <section className="rounded-lg border border-slate-700 bg-slate-900/70 p-4 space-y-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Channel
              </label>
              <select
                value={selectedChannel}
                onChange={(e) => setSelectedChannel(e.target.value)}
                className="w-full rounded-md border border-slate-600 bg-slate-950 px-3 py-1.5 text-sm text-white focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400"
              >
                <option value="">Select channel…</option>
                {CHANNEL_OPTIONS.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-[10px] text-slate-400">
                Picks from your existing schedule. No changes until you hit
                &quot;Save&quot;.
              </p>
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Search in titles or file names
              </label>
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Type to filter…"
                    className="w-full rounded-md border border-slate-600 bg-slate-950 pl-8 pr-3 py-1.5 text-sm text-white focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400"
                  />
                </div>
              </div>
              <p className="mt-1 text-[10px] text-slate-400">
                Helpful when you have a long list for the channel.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
            <span>
              Total loaded: {programs.length} • Showing: {filteredPrograms.length}
            </span>
            {changedCount > 0 && (
              <span className="text-amber-300">
                Unsaved changes: {changedCount}
              </span>
            )}
          </div>

          {error && (
            <div className="mt-2 rounded-md border border-red-500/60 bg-red-950/40 px-3 py-2 text-xs text-red-200">
              {error}
            </div>
          )}
          {status && !error && (
            <div className="mt-2 rounded-md border border-emerald-500/60 bg-emerald-950/40 px-3 py-2 text-xs text-emerald-200">
              {status}
            </div>
          )}
        </section>

        {/* Table */}
        <section className="rounded-lg border border-slate-700 bg-slate-900/70 overflow-hidden">
          {loading && programs.length === 0 ? (
            <div className="py-12 flex items-center justify-center text-sm text-slate-300">
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              Loading programs…
            </div>
          ) : programs.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-400">
              {selectedChannel
                ? "No programs found yet for this channel."
                : "Select a channel to view and edit program titles."}
            </div>
          ) : (
            <div className="max-h-[520px] overflow-y-auto">
              <table className="min-w-full text-xs">
                <thead className="bg-slate-950/90 sticky top-0 z-10">
                  <tr className="text-[11px] uppercase tracking-wide text-slate-300">
                    <th className="px-3 py-2 text-left w-40">Start Time</th>
                    <th className="px-3 py-2 text-left">Title</th>
                    <th className="px-3 py-2 text-left w-56">File</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPrograms.map((row, idx) => {
                    const localStart = row.start_time
                      ? new Date(row.start_time).toLocaleString()
                      : "";
                    const fileName = getFileName(row.mp4_url);
                    return (
                      <tr
                        key={`${row.channel_id}-${row.start_time}-${row.mp4_url}-${idx}`}
                        className={`border-t border-slate-800/80 ${
                          row._dirty ? "bg-slate-800/60" : "hover:bg-slate-800/40"
                        }`}
                      >
                        <td className="px-3 py-2 align-top text-slate-200 whitespace-nowrap">
                          {localStart}
                        </td>
                        <td className="px-3 py-2 align-top">
                          <input
                            type="text"
                            value={row.title ?? ""}
                            onChange={(e) =>
                              handleTitleChange(
                                programs.indexOf(row),
                                e.target.value
                              )
                            }
                            className={`w-full rounded-md border px-2 py-1 text-[11px] text-white bg-slate-950 focus:outline-none focus:ring-1 ${
                              row._dirty
                                ? "border-amber-400 focus:ring-amber-400"
                                : "border-slate-600 focus:ring-slate-500"
                            }`}
                          />
                        </td>
                        <td className="px-3 py-2 align-top text-slate-300">
                          <span className="break-all">{fileName}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
