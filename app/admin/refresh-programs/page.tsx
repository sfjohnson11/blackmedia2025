// app/admin/refresh-programs/page.tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import {
  ArrowLeft,
  Calendar,
  Clock,
  Loader2,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";

type ProgramRow = {
  id: number;
  channel_id: number;
  title: string | null;
  mp4_url: string | null;
  duration: number | null;
  start_time: string | null;
};

export default function RefreshProgramsPage() {
  const supabase = createClientComponentClient();

  const [channelId, setChannelId] = useState<string>("");
  const [baseStart, setBaseStart] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [programCount, setProgramCount] = useState<number | null>(null);
  const [firstOld, setFirstOld] = useState<string | null>(null);
  const [lastOld, setLastOld] = useState<string | null>(null);

  function parseBaseStart(value: string): Date | null {
    if (!value) return null;
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return null;
    return d;
  }

  async function handlePreview() {
    setErr(null);
    setSuccessMsg(null);
    setProgramCount(null);
    setFirstOld(null);
    setLastOld(null);

    const chId = Number(channelId);
    if (Number.isNaN(chId)) {
      setErr("Channel ID must be a number (e.g. 1, 2, 16, 30).");
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("programs")
        .select("id, channel_id, title, mp4_url, duration, start_time")
        .eq("channel_id", chId)
        .order("start_time", { ascending: true });

      if (error) {
        console.error("Error loading programs", error);
        setErr(error.message);
        return;
      }

      const rows = (data || []) as ProgramRow[];
      if (rows.length === 0) {
        setErr(`No programs found for channel ${chId}.`);
        return;
      }

      setProgramCount(rows.length);
      setFirstOld(rows[0].start_time ?? null);
      setLastOld(rows[rows.length - 1].start_time ?? null);
    } catch (e: any) {
      console.error("Unexpected error loading programs", e);
      setErr(e?.message || "Unexpected error loading programs.");
    } finally {
      setLoading(false);
    }
  }

  async function handleRebuild() {
    setErr(null);
    setSuccessMsg(null);

    const chId = Number(channelId);
    if (Number.isNaN(chId)) {
      setErr("Channel ID must be a number (e.g. 1, 2, 16, 30).");
      return;
    }

    if (!baseStart) {
      setErr(
        "Base start time is required. It must look like 2025-11-16T10:00:00 (YYYY-MM-DDTHH:MM:SS)."
      );
      return;
    }

    const base = parseBaseStart(baseStart);
    if (!base) {
      setErr(
        "Base start time is invalid. It must look like 2025-11-16T10:00:00 (YYYY-MM-DDTHH:MM:SS)."
      );
      return;
    }

    setSaving(true);

    try {
      // Load existing programs for this channel, ordered by current start_time
      const { data, error } = await supabase
        .from("programs")
        .select("id, channel_id, title, mp4_url, duration, start_time")
        .eq("channel_id", chId)
        .order("start_time", { ascending: true });

      if (error) {
        console.error("Error loading programs", error);
        setErr(error.message);
        return;
      }

      const rows = (data || []) as ProgramRow[];
      if (rows.length === 0) {
        setErr(`No programs found for channel ${chId}.`);
        return;
      }

      // Build new start_times using existing durations, keeping titles/mp4_url the same
      let cursor = new Date(base);
      const updates: { id: number; start_time: string }[] = [];

      for (const row of rows) {
        const startIso = cursor.toISOString();
        updates.push({ id: row.id, start_time: startIso });

        const dur = row.duration && row.duration > 0 ? row.duration : 300; // default 5 min if missing
        cursor = new Date(cursor.getTime() + dur * 1000);
      }

      // Upsert only id + start_time so we don't touch titles, mp4_url, or duration
      const { error: upsertError } = await supabase
        .from("programs")
        .upsert(updates, { onConflict: "id" });

      if (upsertError) {
        console.error("Error updating schedules", upsertError);
        setErr(upsertError.message);
        return;
      }

      setProgramCount(rows.length);
      setFirstOld(rows[0].start_time ?? null);
      setLastOld(rows[rows.length - 1].start_time ?? null);

      setSuccessMsg(
        `Rebuilt schedule for channel ${chId}. Programs: ${rows.length}. New first start: ${base.toISOString()}.`
      );
    } catch (e: any) {
      console.error("Unexpected error rebuilding schedule", e);
      setErr(e?.message || "Unexpected error rebuilding schedule.");
    } finally {
      setSaving(false);
    }
  }

  const parsedBase = parseBaseStart(baseStart);

  const firstOldDisplay = firstOld
    ? new Date(firstOld).toLocaleString()
    : "—";
  const lastOldDisplay = lastOld ? new Date(lastOld).toLocaleString() : "—";
  const previewSummary =
    programCount != null
      ? `${programCount} program(s). First: ${firstOldDisplay} • Last: ${lastOldDisplay}`
      : "No preview yet.";

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#040814] via-[#050b1a] to-black text-white pb-10">
      <div className="mx-auto max-w-4xl px-4 pt-8 space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <RefreshCw className="h-5 w-5 text-emerald-400" />
              Rebuild Channel Schedule
            </h1>
            <p className="mt-1 text-sm text-slate-300">
              Recalculate <code className="text-amber-300">start_time</code> for
              a single channel using your existing programs and durations. Titles
              and MP4 URLs are preserved.
            </p>
          </div>
          <div className="flex gap-2">
            <Link href="/admin">
              <Button
                variant="outline"
                className="border-slate-600 bg-slate-900"
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Admin
              </Button>
            </Link>
          </div>
        </div>

        {/* Main form card */}
        <section className="rounded-lg border border-slate-700 bg-slate-900/70 p-4 space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {/* Channel ID */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Channel ID
              </label>
              <input
                type="number"
                value={channelId}
                onChange={(e) => setChannelId(e.target.value)}
                placeholder="e.g. 1"
                className="w-full rounded-md border border-slate-600 bg-slate-950 px-3 py-1.5 text-sm text-white focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400"
              />
              <p className="mt-1 text-[10px] text-slate-400">
                This must match <code>programs.channel_id</code> (1–29, 30 for
                Freedom School, etc.).
              </p>
            </div>

            {/* Base Start with presets + Now */}
            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Base Start (YYYY-MM-DDTHH:MM:SS)
              </label>
              <div className="flex gap-2">
                {/* main text input */}
                <input
                  type="text"
                  value={baseStart}
                  onChange={(e) => setBaseStart(e.target.value)}
                  placeholder="2025-11-16T10:00:00"
                  className="flex-1 rounded-md border border-slate-600 bg-slate-950 px-3 py-1.5 text-sm text-white focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400"
                />

                {/* FULL-DAY PRESETS (every hour) */}
                <select
                  className="rounded-md border border-slate-600 bg-slate-900 text-sm px-2"
                  onChange={(e) => {
                    const preset = e.target.value;
                    if (!preset) return;
                    const today = new Date();
                    const date = today.toISOString().split("T")[0]; // YYYY-MM-DD
                    setBaseStart(`${date}T${preset}`);
                  }}
                >
                  <option value="">Presets</option>
                  <option value="00:00:00">12:00 AM (Midnight)</option>
                  <option value="01:00:00">1:00 AM</option>
                  <option value="02:00:00">2:00 AM</option>
                  <option value="03:00:00">3:00 AM</option>
                  <option value="04:00:00">4:00 AM</option>
                  <option value="05:00:00">5:00 AM</option>
                  <option value="06:00:00">6:00 AM</option>
                  <option value="07:00:00">7:00 AM</option>
                  <option value="08:00:00">8:00 AM</option>
                  <option value="09:00:00">9:00 AM</option>
                  <option value="10:00:00">10:00 AM</option>
                  <option value="11:00:00">11:00 AM</option>
                  <option value="12:00:00">12:00 PM (Noon)</option>
                  <option value="13:00:00">1:00 PM</option>
                  <option value="14:00:00">2:00 PM</option>
                  <option value="15:00:00">3:00 PM</option>
                  <option value="16:00:00">4:00 PM</option>
                  <option value="17:00:00">5:00 PM</option>
                  <option value="18:00:00">6:00 PM</option>
                  <option value="19:00:00">7:00 PM</option>
                  <option value="20:00:00">8:00 PM</option>
                  <option value="21:00:00">9:00 PM</option>
                  <option value="22:00:00">10:00 PM</option>
                  <option value="23:00:00">11:00 PM</option>
                </select>

                {/* Now button */}
                <button
                  type="button"
                  onClick={() => {
                    const now = new Date();
                    const pad = (n: number) => String(n).padStart(2, "0");
                    const year = now.getFullYear();
                    const month = pad(now.getMonth() + 1);
                    const day = pad(now.getDate());
                    const hr = pad(now.getHours());
                    const min = pad(now.getMinutes());
                    const sec = pad(now.getSeconds());
                    setBaseStart(`${year}-${month}-${day}T${hr}:${min}:${sec}`);
                  }}
                  className="rounded-md bg-amber-600 px-3 py-1.5 text-xs hover:bg-amber-700"
                >
                  Now
                </button>
              </div>

              <p className="mt-1 text-[10px] text-slate-400">
                Must look exactly like{" "}
                <span className="font-mono text-amber-300">
                  2025-11-16T10:00:00
                </span>{" "}
                (no spaces). Current value:{" "}
                <span className="font-mono text-amber-200">
                  {baseStart || "(none)"}
                </span>
              </p>
              {parsedBase && (
                <p className="text-[10px] text-emerald-300 mt-1">
                  Local time preview: {parsedBase.toLocaleString()}
                </p>
              )}
            </div>
          </div>

          {/* buttons */}
          <div className="flex flex-wrap items-center gap-3 mt-2">
            <Button
              type="button"
              variant="outline"
              onClick={handlePreview}
              disabled={loading || saving}
              className="border-slate-600 bg-slate-950 text-sm"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Loading programs…
                </>
              ) : (
                <>
                  <Calendar className="mr-2 h-4 w-4" />
                  Preview Existing Schedule
                </>
              )}
            </Button>

            <Button
              type="button"
              onClick={handleRebuild}
              disabled={saving || loading}
              className="bg-emerald-600 hover:bg-emerald-700 text-sm"
            >
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Rebuilding schedule…
                </>
              ) : (
                <>
                  <Clock className="mr-2 h-4 w-4" />
                  Rebuild Schedule for Channel
                </>
              )}
            </Button>

            <span className="ml-auto text-[11px] text-slate-400">
              {previewSummary}
            </span>
          </div>

          {/* messages */}
          {err && (
            <div className="flex items-start gap-2 rounded-md border border-red-500/60 bg-red-950/60 px-3 py-2 text-xs text-red-100 mt-2">
              <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
              <p>{err}</p>
            </div>
          )}

          {successMsg && (
            <div className="flex items-start gap-2 rounded-md border border-emerald-500/60 bg-emerald-950/50 px-3 py-2 text-xs text-emerald-100 mt-2">
              <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0" />
              <p>{successMsg}</p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
