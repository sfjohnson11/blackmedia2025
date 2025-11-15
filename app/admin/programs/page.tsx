// app/admin/programs/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import { Loader2, RefreshCw, ArrowLeft, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";

type Program = {
  id: string;
  title?: string | null;
  // different projects use different column names, so we allow both:
  channel?: string | number | null;
  channel_number?: number | null;
  start_time?: string | null;
  end_time?: string | null;
};

export default function ProgramsManagerPage() {
  const supabase = createClientComponentClient();
  const [programs, setPrograms] = useState<Program[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [selectedChannel, setSelectedChannel] = useState<string>("all");

  async function loadPrograms() {
    setLoading(true);
    setErr(null);
    try {
      const { data, error } = await supabase
        .from("programs") // 🔹 change this table name if yours is different
        .select("*")
        .order("start_time", { ascending: true });

      if (error) {
        console.error("Error loading programs", error);
        setErr(error.message);
        setPrograms([]);
      } else {
        setPrograms((data || []) as Program[]);
      }
    } catch (e: any) {
      console.error("Unexpected error loading programs", e);
      setErr(e?.message || "Unexpected error");
      setPrograms([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadPrograms();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Build list of channels from data
  const channelOptions = useMemo(() => {
    const set = new Set<string>();
    for (const p of programs) {
      const ch =
        p.channel_number != null
          ? String(p.channel_number)
          : p.channel != null
          ? String(p.channel)
          : "Unknown";
      set.add(ch);
    }
    return Array.from(set).sort((a, b) => {
      const na = Number(a);
      const nb = Number(b);
      if (!Number.isNaN(na) && !Number.isNaN(nb)) return na - nb;
      return a.localeCompare(b);
    });
  }, [programs]);

  const filteredPrograms = useMemo(() => {
    if (selectedChannel === "all") return programs;
    return programs.filter((p) => {
      const ch =
        p.channel_number != null
          ? String(p.channel_number)
          : p.channel != null
          ? String(p.channel)
          : "Unknown";
      return ch === selectedChannel;
    });
  }, [programs, selectedChannel]);

  function formatDate(value?: string | null) {
    if (!value) return "";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return value;
    return d.toLocaleString();
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#040814] via-[#050b1a] to-black text-white pb-10">
      <div className="mx-auto max-w-6xl px-4 pt-8 space-y-6">
        {/* Header / back to admin */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              Programs Manager
            </h1>
            <p className="mt-1 text-sm text-slate-300">
              View programs from Supabase so you can check schedules and make
              changes using your other tools.
            </p>
          </div>
          <div className="flex gap-2">
            <Link href="/admin">
              <Button variant="outline" className="border-slate-600 bg-slate-900">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Admin
              </Button>
            </Link>
            <Button
              variant="outline"
              onClick={loadPrograms}
              disabled={loading}
              className="border-slate-600 bg-slate-900"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Refreshing…
                </>
              ) : (
                <>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Refresh
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-slate-700 bg-slate-900/70 px-4 py-3">
          <div className="flex items-center gap-2 text-sm text-slate-200">
            <Filter className="h-4 w-4 text-amber-300" />
            <span className="font-medium">Filter by channel:</span>
          </div>
          <select
            value={selectedChannel}
            onChange={(e) => setSelectedChannel(e.target.value)}
            className="rounded-md border border-slate-600 bg-slate-950 px-3 py-1.5 text-sm text-white focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400"
          >
            <option value="all">All channels</option>
            {channelOptions.map((ch) => (
              <option key={ch} value={ch}>
                Channel {ch}
              </option>
            ))}
          </select>
          <span className="ml-auto text-xs text-slate-400">
            Showing {filteredPrograms.length} of {programs.length} programs
          </span>
        </div>

        {/* Error */}
        {err && (
          <div className="rounded-md border border-red-500/60 bg-red-950/50 px-4 py-3 text-sm text-red-200">
            <p className="font-semibold">Could not load programs</p>
            <p className="mt-1 text-xs opacity-80">{err}</p>
          </div>
        )}

        {/* Table */}
        <div className="overflow-x-auto rounded-lg border border-slate-700 bg-slate-900/70">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="bg-slate-900/90 text-xs uppercase tracking-wide text-slate-300">
                <th className="px-3 py-2 text-left">Channel</th>
                <th className="px-3 py-2 text-left">Title</th>
                <th className="px-3 py-2 text-left">Start</th>
                <th className="px-3 py-2 text-left">End</th>
                <th className="px-3 py-2 text-left">ID</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-3 py-6 text-center text-slate-300">
                    <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                    Loading programs from Supabase…
                  </td>
                </tr>
              ) : filteredPrograms.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-3 py-6 text-center text-slate-400">
                    No programs found. Try importing via CSV or check your Supabase
                    table name / RLS.
                  </td>
                </tr>
              ) : (
                filteredPrograms.map((p) => {
                  const channelLabel =
                    p.channel_number != null
                      ? `Channel ${p.channel_number}`
                      : p.channel != null
                      ? `Channel ${p.channel}`
                      : "Unknown";

                  return (
                    <tr
                      key={p.id}
                      className="border-t border-slate-800/80 hover:bg-slate-800/60"
                    >
                      <td className="px-3 py-2 align-top text-slate-100">
                        {channelLabel}
                      </td>
                      <td className="px-3 py-2 align-top text-slate-100">
                        {p.title || <span className="text-slate-500 italic">Untitled</span>}
                      </td>
                      <td className="px-3 py-2 align-top text-slate-200">
                        {formatDate(p.start_time)}
                      </td>
                      <td className="px-3 py-2 align-top text-slate-200">
                        {formatDate(p.end_time)}
                      </td>
                      <td className="px-3 py-2 align-top text-[11px] text-slate-400">
                        {p.id}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Helper links */}
        <div className="mt-4 flex flex-wrap gap-3 text-xs text-slate-400">
          <Link
            href="/setup/import-programs"
            className="underline-offset-2 hover:underline text-amber-300"
          >
            Import Programs (CSV)
          </Link>
          <span>•</span>
          <Link
            href="/admin/refresh-programs"
            className="underline-offset-2 hover:underline text-amber-300"
          >
            Refresh Programs / Rebuild Schedule
          </Link>
        </div>
      </div>
    </div>
  );
}
