// app/admin/loop-schedule/page.tsx
"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import {
  Loader2,
  AlertCircle,
  CheckCircle2,
  Repeat,
  ArrowLeft,
  Clock,
} from "lucide-react";
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
  const [blocksToExtend, setBlocksToExtend] = useState<string>("3"); // "blocks" = how many template repeats
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [previewInfo, setPreviewInfo] = useState<{
    count: number;
    templateCount: number;
    first: string;
    last: string;
    templateWindowHours: number;
    currentEnd: string;
    templateDurationHours: number;
    projectedEnd?: string;
    projectedBlocks?: number;
    projectedHoursAdded?: number;
  } | null>(null);

  const MAX_INSERTS = 2000; // safety cap
  const TEMPLATE_HOURS = 24; // we use the first 24 hours as the "day" pattern

  const disableActions = useMemo(() => loading, [loading]);

  async function loadChannelInfo() {
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

      // Earliest program start
      const earliestStart = new Date(rows[0].start_time);
      const templateCutoff = new Date(
        earliestStart.getTime() + TEMPLATE_HOURS * 60 * 60 * 1000
      );

      // Programs inside the template window (first 24 hours)
      let templateRows = rows.filter((p) => {
        const t = new Date(p.start_time);
        return t >= earliestStart && t < templateCutoff;
      });

      // Fallback: if somehow nothing in first 24h, use everything
      if (!templateRows.length) {
        templateRows = rows;
      }

      // Only rows with valid duration + mp4_url
      const validTemplateRows = templateRows.filter((p) => {
        const dur = Number(p.duration ?? 0);
        return Boolean(p.mp4_url) && Number.isFinite(dur) && dur > 0;
      });

      if (!validTemplateRows.length) {
        setErr(
          "No valid template rows (need positive duration and mp4 URL). Check durations in the programs table."
        );
        return;
      }

      // Compute template duration in ms and find template end
      const templateStartMs = earliestStart.getTime();
      let templateDurationMs = 0;
      let templateEndMs = templateStartMs;

      for (const p of validTemplateRows) {
        const sMs = new Date(p.start_time).getTime();
        const durSec = Number(p.duration ?? 0);
        const endMs = sMs + durSec * 1000;
        if (endMs > templateEndMs) templateEndMs = endMs;
        templateDurationMs += durSec * 1000;
      }

      const templateDurationHours =
        Math.round((templateDurationMs / (1000 * 60 * 60)) * 10) / 10;

      const templateWindowHours =
        Math.round(
          ((templateEndMs - templateStartMs) / (1000 * 60 * 60)) * 10
        ) / 10;

      // Current end time for the whole channel
      let currentEndMs = templateStartMs;
      for (const p of rows) {
        const s = new Date(p.start_time).getTime();
        const durSec = Number(p.duration ?? 0);
        const endMs = s + durSec * 1000;
        if (endMs > currentEndMs) currentEndMs = endMs;
      }
      const currentEnd = new Date(currentEndMs);

      // Projected end if we add N blocks (Option B)
      let projectedEnd: string | undefined = undefined;
      let projectedBlocks: number | undefined = undefined;
      let projectedHoursAdded: number | undefined = undefined;

      const blocks = Number(blocksToExtend);
      if (Number.isFinite(blocks) && blocks > 0 && templateDurationMs > 0) {
        const addedMs = blocks * templateDurationMs;
        const projectedEndMs = currentEndMs + addedMs;
        projectedEnd = new Date(projectedEndMs).toUTCString();
        projectedBlocks = blocks;
        projectedHoursAdded =
          Math.round((addedMs / (1000 * 60 * 60)) * 10) / 10;
      }

      setPreviewInfo({
        count: rows.length,
        templateCount: validTemplateRows.length,
        first: earliestStart.toUTCString(),
        last: new Date(templateEndMs).toUTCString(),
        templateWindowHours,
        currentEnd: currentEnd.toUTCString(),
        templateDurationHours,
        projectedEnd,
        projectedBlocks,
        projectedHoursAdded,
      });
    } catch (e: any) {
      console.error("Unexpected preview error", e);
      setErr(e?.message || "Unexpected error loading channel schedule.");
    } finally {
      setLoading(false);
    }
  }

  async function handleExtendSchedule() {
    setErr(null);
    setSuccessMsg(null);

    const chId = Number(channelId);
    if (!Number.isInteger(chId)) {
      setErr("Channel ID must be a whole number (e.g. 1, 2, 16).");
      return;
    }

    const blocks = Number(blocksToExtend);
    if (!Number.isFinite(blocks) || blocks <= 0) {
      setErr("Blocks to extend must be a positive number (e.g. 1, 3, 7).");
      return;
    }

    setLoading(true);
    try {
      // 1) Load existing programs
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

      // 2) Determine template window (first 24 hours)
      const earliestStart = new Date(rows[0].start_time);
      const templateCutoff = new Date(
        earliestStart.getTime() + TEMPLATE_HOURS * 60 * 60 * 1000
      );

      let templateRows = rows.filter((p) => {
        const t = new Date(p.start_time);
        return t >= earliestStart && t < templateCutoff;
      });

      // Fallback: if nothing in first 24h, use everything
      if (!templateRows.length) {
        templateRows = rows;
      }

      // Valid template rows only
      const validTemplateRows = templateRows.filter((p) => {
        const dur = Number(p.duration ?? 0);
        return Boolean(p.mp4_url) && Number.isFinite(dur) && dur > 0;
      });

      if (!validTemplateRows.length) {
        setErr(
          "No valid template rows (need positive duration and mp4 URL). Check durations in the programs table."
        );
        return;
      }

      // 3) Build template pattern with relative offsets and total duration
      const templateStartMs = earliestStart.getTime();
      let templateDurationMs = 0;

      const templatePattern = validTemplateRows.map((p) => {
        const startMs = new Date(p.start_time).getTime();
        const durSec = Number(p.duration ?? 0);
        const relOffsetMs = startMs - templateStartMs;
        templateDurationMs += durSec * 1000;
        return {
          title: p.title ?? null,
          mp4_url: p.mp4_url as string,
          durationSec: durSec,
          relOffsetMs,
        };
      });

      if (templateDurationMs <= 0) {
        setErr(
          "Computed template duration is invalid (<= 0). Check your program durations."
        );
        return;
      }

      // 4) Find current end of channel
      let currentEndMs = templateStartMs;
      for (const p of rows) {
        const s = new Date(p.start_time).getTime();
        const durSec = Number(p.duration ?? 0);
        const endMs = s + durSec * 1000;
        if (endMs > currentEndMs) currentEndMs = endMs;
      }

      // Each "block" = one full template duration (Option B)
      const totalBlocks = blocks;
      const estimatedInserts = totalBlocks * templatePattern.length;

      if (estimatedInserts > MAX_INSERTS) {
        setErr(
          `This would create about ${estimatedInserts} new programs, which is over the safety limit (${MAX_INSERTS}). Try fewer blocks or a smaller template.`
        );
        return;
      }

      // 5) Build inserts
      const inserts: {
        channel_id: number;
        start_time: string;
        title: string | null;
        mp4_url: string;
        duration: number;
      }[] = [];

      let workingEndMs = currentEndMs;

      for (let i = 0; i < totalBlocks; i++) {
        const blockBaseStartMs = workingEndMs;

        for (const p of templatePattern) {
          const newStartMs = blockBaseStartMs + p.relOffsetMs;
          const newStart = new Date(newStartMs);

          inserts.push({
            channel_id: chId,
            start_time: newStart.toISOString(), // UTC
            title: p.title,
            mp4_url: p.mp4_url,
            duration: p.durationSec,
          });
        }

        workingEndMs = blockBaseStartMs + templateDurationMs;
      }

      if (!inserts.length) {
        setErr("Nothing to insert. Check your template and durations.");
        return;
      }

      if (inserts.length > MAX_INSERTS) {
        setErr(
          `Would insert ${inserts.length} rows, which exceeds the safety limit (${MAX_INSERTS}). Try fewer blocks.`
        );
        return;
      }

      // 6) Insert into programs
      const { error: insertError } = await supabase
        .from("programs")
        .insert(inserts);

      if (insertError) {
        console.error("Error inserting looped programs", insertError);
        setErr(insertError.message);
        return;
      }

      const totalHoursAdded =
        Math.round(
          ((templateDurationMs * totalBlocks) / (1000 * 60 * 60)) * 10
        ) / 10;

      setSuccessMsg(
        `Added ${inserts.length} program(s), repeating the template ${totalBlocks} time(s) and adding ~${totalHoursAdded} hours of programming for channel ${chId}.`
      );
    } catch (e: any) {
      console.error("Unexpected loop error", e);
      setErr(e?.message || "Unexpected error extending schedule.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#040814] via-[#050b1a] to-black text-white pb-10">
      <div className="mx-auto max-w-4xl px-4 pt-8 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 mb-2">
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <Repeat className="h-6 w-6 text-amber-400" />
              Loop Channel Schedule (Safe)
            </h1>
            <p className="mt-1 text-sm text-slate-300 max-w-xl">
              Uses the{" "}
              <span className="font-semibold text-amber-300">
                first 24 hours
              </span>{" "}
              of programming on a channel as a template and repeats that block
              forward in time. Existing rows are not modified, only new rows
              are added with safety limits to avoid overloading your{" "}
              <code>programs</code> table.
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

            {/* Blocks to extend */}
            <div>
              <label className="block text-xs font-medium text-slate-200 mb-1">
                Blocks to extend (template repeats)
              </label>
              <input
                type="number"
                min={1}
                value={blocksToExtend}
                onChange={(e) => setBlocksToExtend(e.target.value)}
                className="w-full rounded-md border border-slate-600 bg-slate-950 px-3 py-1.5 text-sm text-white focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400"
                placeholder="e.g. 3"
              />
              <p className="mt-1 text-[11px] text-slate-400">
                1 = add the template block once, 2 = twice, etc.
              </p>
            </div>

            {/* Actions */}
            <div className="flex items-end gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={disableActions}
                onClick={loadChannelInfo}
                className="border-slate-600 bg-slate-950 text-xs flex-1"
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Working…
                  </>
                ) : (
                  <>
                    <Clock className="mr-2 h-4 w-4" />
                    Preview Window
                  </>
                )}
              </Button>
              <Button
                type="button"
                disabled={disableActions}
                onClick={handleExtendSchedule}
                className="bg-emerald-600 hover:bg-emerald-700 text-xs flex-1"
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Extending…
                  </>
                ) : (
                  "Extend Schedule"
                )}
              </Button>
            </div>
          </div>

          {previewInfo && (
            <div className="mt-2 rounded-md border border-slate-600 bg-slate-900/80 px-3 py-2 text-xs text-slate-200 space-y-1">
              <div className="font-semibold mb-1">
                Current schedule overview
              </div>
              <p>
                Total programs on channel:{" "}
                <span className="text-amber-300">{previewInfo.count}</span>
              </p>
              <p>
                Programs in template window (first {TEMPLATE_HOURS} hours):{" "}
                <span className="text-amber-300">
                  {previewInfo.templateCount}
                </span>
              </p>
              <p>
                Template window from:{" "}
                <span className="font-mono text-amber-200">
                  {previewInfo.first}
                </span>
              </p>
              <p>
                Template window to:{" "}
                <span className="font-mono text-amber-200">
                  {previewInfo.last}
                </span>{" "}
                ({previewInfo.templateWindowHours} hours)
              </p>
              <p>
                Template block duration:{" "}
                <span className="font-mono text-emerald-200">
                  ~{previewInfo.templateDurationHours} hours
                </span>
              </p>
              <p>
                Current channel ends at:{" "}
                <span className="font-mono text-emerald-200">
                  {previewInfo.currentEnd}
                </span>
              </p>

              {previewInfo.projectedEnd &&
                previewInfo.projectedBlocks &&
                previewInfo.projectedHoursAdded !== undefined && (
                  <div className="mt-2 pt-2 border-t border-slate-700">
                    <div className="font-semibold mb-1">
                      If you extend by {previewInfo.projectedBlocks} block
                      {previewInfo.projectedBlocks > 1 ? "s" : ""}:
                    </div>
                    <p>
                      Approx. hours added:{" "}
                      <span className="font-mono text-amber-200">
                        ~{previewInfo.projectedHoursAdded} hours
                      </span>
                    </p>
                    <p>
                      Projected new end time:{" "}
                      <span className="font-mono text-amber-200">
                        {previewInfo.projectedEnd}
                      </span>
                    </p>
                  </div>
                )}
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
