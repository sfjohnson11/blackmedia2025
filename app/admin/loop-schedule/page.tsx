// app/admin/loop-schedule/page.tsx
"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import { Loader2, AlertCircle, CheckCircle2, Repeat, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

type ProgramRow = {
  channel_id: number;
  title: string | null;
  mp4_url: string | null;
  start_time: string; // ISO string
  duration: number | null;
};

export default function LoopSchedulePage() {
  const supabase = createClientComponentClient();

  const [channelId, setChannelId] = useState<string>("");
  const [repeatCount, setRepeatCount] = useState<string>("1");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [previewInfo, setPreviewInfo] = useState<{
    count: number;
    first: string;
    last: string;
    windowHours: number;
  } | null>(null);

  async function handlePreview() {
    setErr(null);
    setSuccessMsg(null);
    setPreviewInfo(null);

    const chId = Number(channelId);
    if (!Number.isInteger(chId)) {
      setErr("Channel ID must be a whole number (e.g. 1, 2, 16).");
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("programs")
        .select("channel_id,title,mp4_url,start_time,duration")
        .eq("channel_id", chId)
        .order("start_time", { ascending: true });

      if (error) {
        console.error("Error loading programs", error);
        setErr(error.message);
        return;
      }

      const rows = (data || []) as ProgramRow[];
      if (!rows.length) {
        setErr(`No programs found for channel ${chId}.`);
        return;
      }

      const firstStart = new Date(rows[0].start_time);
      const last = rows[rows.length - 1];
      const lastStart = new Date(last.start_time);
      const lastDurSec = Number(last.duration ?? 0);
      const windowEnd = new Date(lastStart.getTime() + lastDurSec * 1000);
      const windowHours = (windowEnd.getTime() - firstStart.getTime()) / (1000 * 60 * 60);

      setPreviewInfo({
        count: rows.length,
        first: firstStart.toUTCString(),
        last: windowEnd.toUTCString(),
        windowHours: Math.max(0, Math.round(windowHours * 10) / 10),
      });
    } catch (e: any) {
      console.error("Unexpected preview error", e);
      setErr(e?.message || "Unexpected error loading schedule.");
    } finally {
      setLoading(false);
    }
  }

  async function handleLoop() {
    setErr(null);
    setSuccessMsg(null);

    const chId = Number(channelId);
    if (!Number.isInteger(chId)) {
      setErr("Channel ID must be a whole number (e.g. 1, 2, 16).");
      return;
    }

    const repeats = Number(repeatCount);
    if (!Number.isInteger(repeats) || repeats <= 0) {
      setErr("Repeat count must be a positive whole number (e.g. 1, 2, 5).");
      return;
    }

    setLoading(true);
    try {
      // 1) Get existing programs for this channel, ordered by start_time
      const { data, error } = await supabase
        .from("programs")
        .select("channel_id,title,mp4_url,start_time,duration")
        .eq("channel_id", chId)
        .order("start_time", { ascending: true });

      if (error) {
        console.error("Error loading programs", error);
        setErr(error.message);
        return;
      }

      const rows = (data || []) as ProgramRow[];
      if (!rows.length) {
        setErr(`No programs found for channel ${chId}.`);
        return;
      }

      // 2) Compute the base “loop window” length
      const baseStart = new Date(rows[0].start_time);
      const last = rows[rows.length - 1];
      const lastStart = new Date(last.start_time);
      const lastDurSec = Number(last.duration ?? 0);
      const baseEnd = new Date(lastStart.getTime() + lastDurSec * 1000);
      const windowMs = baseEnd.getTime() - baseStart.getTime();

      if (windowMs <= 0) {
        setErr("The existing window duration is invalid (<= 0). Check durations.");
        return;
      }

      // 3) Build repeated schedule
      const inserts: {
        channel_id: number;
        start_time: string;
        title: string | null;
        mp4_url: string;
        duration: number;
      }[] = [];

      for (let r = 1; r <= repeats; r++) {
        const offsetMs = windowMs * r;
        for (const p of rows) {
          const srcStart = new Date(p.start_time);
          const newStart = new Date(srcStart.getTime() + offsetMs);

          const durationSec = Number(p.duration ?? 0);
          if (!Number.isFinite(durationSec) || durationSec <= 0) {
            // Skip any program with invalid duration instead of blowing up
            continue;
          }

          const url = p.mp4_url;
          if (!url) continue;

          inserts.push({
            channel_id: chId,
            start_time: newStart.toISOString(), // UTC ISO
            title: p.title ?? null,
            mp4_url: url,
            duration: durationSec,
          });
        }
      }

      if (!inserts.length) {
        setErr("No valid rows to insert. Check that existing programs have durations and mp4 URLs.");
        return;
      }

      // 4) Insert into programs (no reference to programs.id)
      const { error: insertError } = await supabase.from("programs").insert(inserts);

      if (insertError) {
        console.error("Error inserting looped programs", insertError);
        setErr(insertError.message);
        return;
      }

      setSuccessMsg(
        `Created ${inserts.length} looped program(s) for channel ${chId} across ${repeats} repeat block(s).`
      );
    } catch (e: any) {
      console.error("Unexpected loop error", e);
      setErr(e?.message || "Unexpected error creating loop schedule.");
    } finally {
      setLoading(false);
    }
  }

  const disableActions = useMemo(() => loading, [loading]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#040814] via-[#050b1a] to-black text-white pb-10">
      <div className="mx-auto max-w-4xl px-4 pt-8 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 mb-2">
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <Repeat className="h-6 w-6 text-amber-400" />
              Loop Channel Schedule
            </h1>
            <p className="mt-1 text-sm text-slate-300 max-w-xl">
              Take the existing schedule window for a channel and repeat it forward in time
              for continuous 24/7 rotation. This does{" "}
              <span className="font-semibold text-amber-300">not</span> touch or modify your
              current entries—only adds new rows into <code>programs</code>.
            </p>
          </div>
          <Link href="/admin">
            <Button
              variant="outline"
              className="border-slate-600 bg-slate-900 text-xs"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Admin
            </Button>
          </Link>
        </div>

        {/* Controls */}
        <section className="rounded-lg border border-slate-700 bg-slate-900/70 p-4 space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {/* Channel ID */}
            <div>
              <label className="block text-xs font-medium text-slate-200 mb-1">
                Channel ID
              </label>
              <input
                type="number"
                value={channelId}
                onChange={(e) => setChannelId(e.target.value)}
                className="w-full rounded-md border border-slate-600 bg-slate-950 px-3 py-1.5 text-sm text-white focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400"
                placeholder="e.g. 1"
              />
              <p className="mt-1 text-[11px] text-slate-400">
                Must match <code>programs.channel_id</code> and your /watch URL.
              </p>
            </div>

            {/* Repeat count */}
            <div>
              <label className="block text-xs font-medium text-slate-200 mb-1">
                Repeat block count
              </label>
              <input
                type="number"
                min={1}
                value={repeatCount}
                onChange={(e) => setRepeatCount(e.target.value)}
                className="w-full rounded-md border border-slate-600 bg-slate-950 px-3 py-1.5 text-sm text-white focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400"
                placeholder="e.g. 3"
              />
              <p className="mt-1 text-[11px] text-slate-400">
                1 = add the window once, 2 = twice, etc.
              </p>
            </div>

            {/* Actions */}
            <div className="flex items-end gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={disableActions}
                onClick={handlePreview}
                className="border-slate-600 bg-slate-950 text-xs flex-1"
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Working…
                  </>
                ) : (
                  "Preview Window"
                )}
              </Button>
              <Button
                type="button"
                disabled={disableActions}
                onClick={handleLoop}
                className="bg-emerald-600 hover:bg-emerald-700 text-xs flex-1"
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating…
                  </>
                ) : (
                  "Create Loop Schedule"
                )}
              </Button>
            </div>
          </div>

          {previewInfo && (
            <div className="mt-2 rounded-md border border-slate-600 bg-slate-900/80 px-3 py-2 text-xs text-slate-200">
              <div className="font-semibold mb-1">Current window overview</div>
              <p>
                Programs in window:{" "}
                <span className="text-amber-300">{previewInfo.count}</span>
              </p>
              <p>
                From:{" "}
                <span className="font-mono text-amber-200">
                  {previewInfo.first}
                </span>
              </p>
              <p>
                To:{" "}
                <span className="font-mono text-amber-200">
                  {previewInfo.last}
                </span>{" "}
                ({previewInfo.windowHours} hours total)
              </p>
            </div>
          )}

          {err && (
            <div className="flex items-start gap-2 rounded-md border border-red-500/60 bg-red-950/60 px-3 py-2 text-xs text-red-100">
              <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
              <p>{err}</p>
            </div>
          )}

          {successMsg && (
            <div className="flex items-start gap-2 rounded-md border border-emerald-500/60 bg-emerald-950/50 px-3 py-2 text-xs text-emerald-100">
              <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0" />
              <p>{successMsg}</p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
