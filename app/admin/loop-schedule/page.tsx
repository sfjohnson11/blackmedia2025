// app/admin/loop-schedule/page.tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import { ArrowLeft, Loader2, AlertCircle, CheckCircle2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

type ProgramRow = {
  id: number;
  channel_id: number;
  title: string | null;
  mp4_url: string | null;
  start_time: string;
  duration: number | null;
};

export default function LoopSchedulePage() {
  const supabase = createClientComponentClient();

  const [channelId, setChannelId] = useState<string>("");
  const [loopCount, setLoopCount] = useState<string>("1");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  async function handleLoop() {
    setErr(null);
    setSuccessMsg(null);

    const chId = Number(channelId);
    if (!Number.isInteger(chId) || chId <= 0) {
      setErr("Channel ID must be a positive number (e.g. 1, 2, 16).");
      return;
    }

    const loops = Number(loopCount);
    if (!Number.isInteger(loops) || loops <= 0) {
      setErr("Loop count must be a positive whole number.");
      return;
    }

    setLoading(true);
    try {
      // 1) Load all existing programs for this channel, ordered by start_time
      const { data, error } = await supabase
        .from("programs")
        .select("id, channel_id, title, mp4_url, start_time, duration")
        .eq("channel_id", chId)
        .order("start_time", { ascending: true });

      if (error) {
        console.error("Error loading programs", error);
        setErr(error.message);
        setLoading(false);
        return;
      }

      const rows = (data || []) as ProgramRow[];

      if (!rows.length) {
        setErr(`No existing programs found for channel ${chId}. Use the Auto-Schedule page first.`);
        setLoading(false);
        return;
      }

      // Require duration for every program so we can compute the block length
      const missingDur = rows.filter((r) => !r.duration || r.duration <= 0);
      if (missingDur.length > 0) {
        setErr(
          "Some programs have no duration. Please make sure all programs for this channel have a duration before looping."
        );
        setLoading(false);
        return;
      }

      // 2) Compute the original block's time span
      const firstStartMs = new Date(rows[0].start_time).getTime();
      let lastEndMs = firstStartMs;

      for (const p of rows) {
        const startMs = new Date(p.start_time).getTime();
        const durSec = p.duration ?? 0;
        const endMs = startMs + durSec * 1000;
        if (endMs > lastEndMs) lastEndMs = endMs;
      }

      const blockSpanMs = lastEndMs - firstStartMs;
      if (blockSpanMs <= 0) {
        setErr("Computed time span for this channel's schedule is invalid.");
        setLoading(false);
        return;
      }

      // 3) Build new program rows for each loop
      const newRows: {
        channel_id: number;
        title: string | null;
        mp4_url: string | null;
        start_time: string;
        duration: number;
      }[] = [];

      // We start the first loop immediately AFTER the current lastEndMs
      for (let i = 0; i < loops; i++) {
        const loopBaseOffsetMs = lastEndMs + i * blockSpanMs;

        for (const p of rows) {
          const originalStartMs = new Date(p.start_time).getTime();
          const offsetWithinBlock = originalStartMs - firstStartMs;
          const newStartMs = loopBaseOffsetMs + offsetWithinBlock;

          newRows.push({
            channel_id: chId,
            title: p.title,
            mp4_url: p.mp4_url,
            start_time: new Date(newStartMs).toISOString(), // keep UTC ISO
            duration: p.duration ?? 0,
          });
        }
      }

      if (!newRows.length) {
        setErr("No rows generated for loop. Nothing to insert.");
        setLoading(false);
        return;
      }

      // 4) Insert all new rows
      const { error: insertError } = await supabase.from("programs").insert(newRows);
      if (insertError) {
        console.error("Error inserting loop rows", insertError);
        setErr(insertError.message);
        setLoading(false);
        return;
      }

      setSuccessMsg(
        `Added ${newRows.length} program(s) by looping the current schedule ${loops} time(s) for channel ${chId}.`
      );
    } catch (e: any) {
      console.error("Unexpected loop error", e);
      setErr(e?.message || "Unexpected error while looping schedule.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#040814] via-[#050b1a] to-black text-white pb-10">
      <div className="mx-auto max-w-3xl px-4 pt-8 space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              Loop Existing Channel Schedule
            </h1>
            <p className="mt-1 text-sm text-slate-300">
              Take whatever is already in your <code className="text-amber-300">programs</code> table
              for a channel and copy it forward so the schedule repeats back-to-back.
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

        {/* Form card */}
        <section className="rounded-lg border border-slate-700 bg-slate-900/70 p-4 space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {/* Channel ID */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Channel ID (numeric)
              </label>
              <input
                type="number"
                value={channelId}
                onChange={(e) => setChannelId(e.target.value)}
                className="w-full rounded-md border border-slate-600 bg-slate-950 px-3 py-1.5 text-sm text-white focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400"
                placeholder="e.g. 1"
              />
              <p className="mt-1 text-[10px] text-slate-400">
                This must match the <code>channel_id</code> used in your <code>programs</code> table.
              </p>
            </div>

            {/* Loop count */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                How many times to repeat the current block?
              </label>
              <input
                type="number"
                min={1}
                max={50}
                value={loopCount}
                onChange={(e) => setLoopCount(e.target.value)}
                className="w-full rounded-md border border-slate-600 bg-slate-950 px-3 py-1.5 text-sm text-white focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400"
                placeholder="1"
              />
              <p className="mt-1 text-[10px] text-slate-400">
                1 = append the block once, 2 = append it twice, etc.
              </p>
            </div>
          </div>

          {err && (
            <div className="flex items-start gap-2 rounded-md border border-red-500/60 bg-red-950/50 px-3 py-2 text-xs text-red-200">
              <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
              <p>{err}</p>
            </div>
          )}

          {successMsg && (
            <div className="flex items-start gap-2 rounded-md border border-emerald-500/60 bg-emerald-950/40 px-3 py-2 text-xs text-emerald-200">
              <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0" />
              <p>{successMsg}</p>
            </div>
          )}

          <div className="flex justify-end">
            <Button
              type="button"
              onClick={handleLoop}
              disabled={loading}
              className="bg-emerald-600 hover:bg-emerald-700 text-sm"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Looping schedule…
                </>
              ) : (
                <>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Loop Schedule for This Channel
                </>
              )}
            </Button>
          </div>
        </section>
      </div>
    </div>
  );
}
