// app/admin/cleanup-programs/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import {
  ArrowLeft,
  Trash2,
  Loader2,
  Filter,
  AlertTriangle,
  Calendar as CalendarIcon,
  Film,
} from "lucide-react";
import { Button } from "@/components/ui/button";

type ProgramRow = {
  id: string | number;
  channel_id: number;
  title: string | null;
  mp4_url: string | null;
  start_time: string | null;
  duration: number | null;
};

export default function CleanupProgramsPage() {
  const supabase = createClientComponentClient();

  const [channelId, setChannelId] = useState<string>("");
  const [fromDate, setFromDate] = useState<string>(""); // YYYY-MM-DD
  const [toDate, setToDate] = useState<string>("");     // YYYY-MM-DD
  const [search, setSearch] = useState<string>("");     // part of MP4 or title

  const [programs, setPrograms] = useState<ProgramRow[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string | number>>(new Set());

  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Helper to format time nicely for display
  function fmtLocal(dt: string | null) {
    if (!dt) return "";
    const d = new Date(dt);
    if (Number.isNaN(d.getTime())) return dt;
    return d.toLocaleString("en-US", {
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  const anySelected = useMemo(
    () => selectedIds.size > 0,
    [selectedIds]
  );

  function toggleSelected(id: string | number) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAllVisible() {
    setSelectedIds(new Set(programs.map((p) => p.id)));
  }

  function clearSelection() {
    setSelectedIds(new Set());
  }

  async function loadPrograms() {
    setLoading(true);
    setErr(null);
    setSuccessMsg(null);
    setPrograms([]);
    setSelectedIds(new Set());

    try {
      let query = supabase
        .from("programs")
        .select("id, channel_id, title, mp4_url, start_time, duration")
        .order("start_time", { ascending: true });

      // Channel filter (strongly recommended)
      if (channelId.trim() !== "") {
        const chNum = Number(channelId);
        if (!Number.isFinite(chNum)) {
          setErr("Channel ID must be a number (e.g. 1, 16, 30).");
          setLoading(false);
          return;
        }
        query = query.eq("channel_id", chNum);
      }

      // Date range filters (optional)
      if (fromDate) {
        // fromDate is local YYYY-MM-DD; convert to ISO start of day
        const from = new Date(fromDate + "T00:00:00");
        query = query.gte("start_time", from.toISOString());
      }
      if (toDate) {
        // toDate → end of day
        const to = new Date(toDate + "T23:59:59");
        query = query.lte("start_time", to.toISOString());
      }

      const { data, error } = await query;

      if (error) throw error;

      let rows = (data || []) as ProgramRow[];

      // Client-side filter by search term (in title or mp4_url)
      if (search.trim()) {
        const term = search.toLowerCase();
        rows = rows.filter((p) => {
          const t = (p.title || "").toLowerCase();
          const u = (p.mp4_url || "").toLowerCase();
          return t.includes(term) || u.includes(term);
        });
      }

      setPrograms(rows);
    } catch (e: any) {
      console.error("Error loading programs for cleanup", e);
      setErr(e?.message || "Failed to load programs.");
    } finally {
      setLoading(false);
    }
  }

  async function deleteSelected() {
    if (!anySelected) return;
    const ids = Array.from(selectedIds);

    // Final "are you sure?" at browser level
    const ok = window.confirm(
      `Delete ${ids.length} program(s) from the schedule? This will NOT delete the MP4 file from storage, only unschedule it.`
    );
    if (!ok) return;

    setDeleting(true);
    setErr(null);
    setSuccessMsg(null);

    try {
      const { error } = await supabase
        .from("programs")
        .delete()
        .in("id", ids);

      if (error) throw error;

      // Remove deleted rows from local state
      setPrograms((prev) => prev.filter((p) => !selectedIds.has(p.id)));
      setSelectedIds(new Set());
      setSuccessMsg(`Deleted ${ids.length} program(s) from the schedule.`);
    } catch (e: any) {
      console.error("Error deleting programs", e);
      setErr(e?.message || "Failed to delete selected programs.");
    } finally {
      setDeleting(false);
    }
  }

  // Optional: load something on mount (e.g., nothing; wait for user filters)
  useEffect(() => {
    // You can auto-load by channel if you want:
    // loadPrograms();
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#040814] via-[#050b1a] to-black text-white pb-10">
      <div className="mx-auto max-w-6xl px-4 pt-8 space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <Film className="h-6 w-6 text-amber-400" />
              Cleanup / Remove Scheduled MP4s
            </h1>
            <p className="mt-1 text-sm text-slate-300 max-w-xl">
              Unschedule MP4s from the <code className="text-amber-300">programs</code> table.
              <span className="text-amber-300 font-semibold">
                {" "}This does NOT delete the files from your Supabase buckets.
              </span>
            </p>
          </div>
          <div className="flex gap-2">
            <Link href="/admin">
              <Button
                variant="outline"
                className="border-slate-600 bg-slate-900 text-sm"
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Admin
              </Button>
            </Link>
          </div>
        </div>

        {/* Filters */}
        <section className="rounded-lg border border-slate-700 bg-slate-900/70 p-4 space-y-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
            {/* Channel ID */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Channel ID
              </label>
              <input
                type="number"
                value={channelId}
                onChange={(e) => setChannelId(e.target.value)}
                placeholder="e.g. 1, 16, 30"
                className="w-full rounded-md border border-slate-600 bg-slate-950 px-3 py-1.5 text-sm text-white focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400"
              />
              <p className="mt-1 text-[10px] text-slate-400">
                Strongly recommended so you don&apos;t see every channel at once.
              </p>
            </div>

            {/* From date */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                From Date
              </label>
              <div className="flex items-center gap-2">
                <CalendarIcon className="h-4 w-4 text-slate-400" />
                <input
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="flex-1 rounded-md border border-slate-600 bg-slate-950 px-2 py-1.5 text-sm text-white focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400"
                />
              </div>
              <p className="mt-1 text-[10px] text-slate-400">
                Optional. Leave blank to include all earlier programs.
              </p>
            </div>

            {/* To date */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                To Date
              </label>
              <div className="flex items-center gap-2">
                <CalendarIcon className="h-4 w-4 text-slate-400" />
                <input
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  className="flex-1 rounded-md border border-slate-600 bg-slate-950 px-2 py-1.5 text-sm text-white focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400"
                />
              </div>
              <p className="mt-1 text-[10px] text-slate-400">
                Optional. Leave blank to include all future programs.
              </p>
            </div>

            {/* Search term */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Search (Title / MP4)
              </label>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="part of title or file name…"
                className="w-full rounded-md border border-slate-600 bg-slate-950 px-3 py-1.5 text-sm text-white focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400"
              />
              <p className="mt-1 text-[10px] text-slate-400">
                Filters locally after loading. Useful for a specific series.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={loadPrograms}
              disabled={loading}
              className="border-slate-600 bg-slate-950 text-sm"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Loading…
                </>
              ) : (
                <>
                  <Filter className="mr-2 h-4 w-4" />
                  Load Programs
                </>
              )}
            </Button>

            <div className="ml-auto flex items-center gap-2 text-xs text-slate-400">
              <span>Total loaded: {programs.length}</span>
              <span>• Selected: {selectedIds.size}</span>
            </div>
          </div>

          {err && (
            <div className="flex items-start gap-2 rounded-md border border-red-500/60 bg-red-950/50 px-3 py-2 text-xs text-red-200">
              <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
              <p>{err}</p>
            </div>
          )}

          {successMsg && (
            <div className="flex items-start gap-2 rounded-md border border-emerald-500/60 bg-emerald-950/40 px-3 py-2 text-xs text-emerald-200">
              <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 rotate-180" />
              <p>{successMsg}</p>
            </div>
          )}
        </section>

        {/* Table of programs */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-100">
              Matching Programs
            </h2>
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <button
                type="button"
                className="underline hover:text-slate-200"
                onClick={selectAllVisible}
              >
                Select all visible
              </button>
              <button
                type="button"
                className="underline hover:text-slate-200"
                onClick={clearSelection}
              >
                Clear selection
              </button>
            </div>
          </div>

          <div className="max-h-[480px] overflow-y-auto rounded-lg border border-slate-700 bg-slate-900/70">
            {loading ? (
              <div className="flex items-center justify-center py-10 text-slate-300 text-sm">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Loading…
              </div>
            ) : programs.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400">
                No programs loaded yet. Set filters and click{" "}
                <span className="text-amber-300">Load Programs</span>.
              </div>
            ) : (
              <table className="min-w-full text-xs">
                <thead>
                  <tr className="bg-slate-900/90 text-[11px] uppercase tracking-wide text-slate-300">
                    <th className="px-3 py-2 text-left">Select</th>
                    <th className="px-3 py-2 text-left">Channel</th>
                    <th className="px-3 py-2 text-left">Start</th>
                    <th className="px-3 py-2 text-left">Title</th>
                    <th className="px-3 py-2 text-left">MP4</th>
                  </tr>
                </thead>
                <tbody>
                  {programs.map((p) => (
                    <tr
                      key={p.id}
                      className="border-t border-slate-800/80 hover:bg-slate-800/60"
                    >
                      <td className="px-3 py-2 align-top">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(p.id)}
                          onChange={() => toggleSelected(p.id)}
                        />
                      </td>
                      <td className="px-3 py-2 align-top text-slate-100">
                        {p.channel_id}
                      </td>
                      <td className="px-3 py-2 align-top text-slate-200 whitespace-nowrap">
                        {fmtLocal(p.start_time)}
                      </td>
                      <td className="px-3 py-2 align-top text-slate-100 max-w-[220px] truncate">
                        {p.title || <span className="text-slate-500 italic">(no title)</span>}
                      </td>
                      <td className="px-3 py-2 align-top text-slate-300 max-w-[260px] truncate">
                        {p.mp4_url ?? ""}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>

        {/* Delete bar */}
        <section className="flex justify-end">
          <Button
            type="button"
            onClick={deleteSelected}
            disabled={!anySelected || deleting}
            className="bg-red-600 hover:bg-red-700 text-sm disabled:opacity-50"
          >
            {deleting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Deleting…
              </>
            ) : (
              <>
                <Trash2 className="mr-2 h-4 w-4" />
                Delete Selected from Schedule
              </>
            )}
          </Button>
        </section>

        {/* Safety note */}
        <section className="mt-4 text-[11px] text-slate-500">
          <p>
            This tool only deletes rows from the{" "}
            <code className="text-amber-300">programs</code> table. Your actual{" "}
            <code className="text-amber-300">.mp4</code> files remain in their
            Supabase storage buckets (channel1, channel2, Freedom School, etc.).
          </p>
        </section>
      </div>
    </div>
  );
}
