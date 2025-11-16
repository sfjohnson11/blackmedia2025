// app/admin/auto-schedule/page.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import {
  ArrowLeft,
  Loader2,
  RefreshCw,
  Clock,
  PlayCircle,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";

type BucketFile = {
  name: string;
  duration?: number | null;
  detecting?: boolean;
  selected: boolean;
};

const CHANNEL_BUCKETS = [
  "channel1",
  "channel2",
  "channel3",
  "channel4",
  "channel5",
  "channel6",
  "channel7",
  "channel8",
  "channel9",
  "channel10",
  "channel11",
  "channel12",
  "channel13",
  "channel14",
  "channel15",
  "channel16",
  "channel17",
  "channel18",
  "channel19",
  "channel20",
  "channel21",
  "channel22",
  "channel23",
  "channel24",
  "channel25",
  "channel26",
  "channel27",
  "channel28",
  "channel29",
  "freedom-school",
];

// 🔹 NEW: helper to turn "my_show-part_01.mp4" → "My Show Part 01"
function makePrettyTitle(fileName: string): string {
  // 1) Strip extension
  let base = fileName.replace(/\.[^./]+$/, "");

  // 2) Replace underscores/dashes with spaces & collapse double spaces
  base = base.replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();

  // 3) Title-case each word
  const words = base.split(" ");
  const titled = words
    .map((w) =>
      w.length === 0 ? "" : w[0].toUpperCase() + w.slice(1)
    )
    .join(" ");

  return titled || fileName; // fallback to original if something goes weird
}

export default function AutoSchedulePage() {
  const supabase = createClientComponentClient();

  const [channelId, setChannelId] = useState<string>("");
  const [bucketName, setBucketName] = useState<string>("channel1");
  const [baseStart, setBaseStart] = useState<string>(""); // datetime-local
  const [files, setFiles] = useState<BucketFile[]>([]);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [savingSchedule, setSavingSchedule] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const hiddenVideoRef = useRef<HTMLVideoElement | null>(null);

  // Load files from chosen bucket
  async function loadFiles() {
    setErr(null);
    setSuccessMsg(null);
    setLoadingFiles(true);
    setFiles([]);

    try {
      const { data, error } = await supabase.storage
        .from(bucketName)
        .list("", { limit: 1000 });

      if (error) {
        console.error("Error listing bucket files", error);
        setErr(error.message);
        setFiles([]);
      } else {
        const mp4s =
          (data || [])
            .filter((f) => f.name.toLowerCase().endsWith(".mp4"))
            .sort((a, b) => a.name.localeCompare(b.name))
            .map<BucketFile>((f) => ({
              name: f.name,
              selected: true,
            })) || [];

        if (mp4s.length === 0) {
          setErr("No .mp4 files found in this bucket.");
        }

        setFiles(mp4s);
      }
    } catch (e: any) {
      console.error("Unexpected error listing files", e);
      setErr(e?.message || "Unexpected error listing files.");
      setFiles([]);
    } finally {
      setLoadingFiles(false);
    }
  }

  function toggleFileSelected(name: string) {
    setFiles((prev) =>
      prev.map((f) =>
        f.name === name ? { ...f, selected: !f.selected } : f
      )
    );
  }

  // Detect duration for one file using a hidden <video>
  async function detectDurationForFile(file: BucketFile) {
    setErr(null);
    setSuccessMsg(null);

    const videoEl =
      hiddenVideoRef.current || document.createElement("video");
    hiddenVideoRef.current = videoEl;
    videoEl.preload = "metadata";
    videoEl.crossOrigin = "anonymous";

    // Get public URL for this file
    const { data } = supabase.storage.from(bucketName).getPublicUrl(file.name);
    const publicUrl = data?.publicUrl;
    if (!publicUrl) {
      throw new Error("Could not get public URL for file.");
    }

    videoEl.src = publicUrl;

    await new Promise<void>((resolve, reject) => {
      const onLoaded = () => {
        cleanup();
        resolve();
      };
      const onError = () => {
        cleanup();
        reject(new Error("Could not load video metadata for duration."));
      };
      const cleanup = () => {
        videoEl.removeEventListener("loadedmetadata", onLoaded);
        videoEl.removeEventListener("error", onError);
      };
      videoEl.addEventListener("loadedmetadata", onLoaded);
      videoEl.addEventListener("error", onError);
    });

    const sec = videoEl.duration;
    if (!Number.isFinite(sec)) {
      throw new Error("Duration is not available for this video.");
    }

    setFiles((prev) =>
      prev.map((f) =>
        f.name === file.name ? { ...f, duration: Math.round(sec) } : f
      )
    );
  }

  async function handleDetectDuration(name: string) {
    setErr(null);
    setSuccessMsg(null);

    setFiles((prev) =>
      prev.map((f) =>
        f.name === name ? { ...f, detecting: true } : f
      )
    );

    try {
      const file = files.find((f) => f.name === name);
      if (!file) throw new Error("File not found.");

      await detectDurationForFile(file);
    } catch (e: any) {
      console.error("Duration detect error", e);
      setErr(e?.message || "Could not detect duration.");
    } finally {
      setFiles((prev) =>
        prev.map((f) =>
          f.name === name ? { ...f, detecting: false } : f
        )
      );
    }
  }

  async function handleDetectAll() {
    setErr(null);
    setSuccessMsg(null);
    // Detect only for selected files that don't yet have duration
    const targets = files.filter((f) => f.selected && !f.duration);

    for (const file of targets) {
      setFiles((prev) =>
        prev.map((f) =>
          f.name === file.name ? { ...f, detecting: true } : f
        )
      );
      try {
        await detectDurationForFile(file);
      } catch (e: any) {
        console.error("Duration detect error", e);
        setErr(
          (prevErr) =>
            prevErr ||
            `Could not detect duration for ${file.name}. You may need to enter it manually later.`
        );
      } finally {
        setFiles((prev) =>
          prev.map((f) =>
            f.name === file.name ? { ...f, detecting: false } : f
          )
        );
      }
    }
  }

  function handleManualDurationChange(name: string, value: string) {
    const sec = value ? Number(value) : undefined;
    setFiles((prev) =>
      prev.map((f) =>
        f.name === name ? { ...f, duration: Number.isFinite(sec) ? sec : undefined } : f
      )
    );
  }

  async function handleCreateSchedule() {
    setErr(null);
    setSuccessMsg(null);

    const chId = Number(channelId);
    if (Number.isNaN(chId)) {
      setErr("Channel ID must be a number (e.g. 1, 2, 16).");
      return;
    }

    if (!baseStart) {
      setErr("Select a base start date/time for the first program.");
      return;
    }

    const selectedFiles = files.filter((f) => f.selected);
    if (selectedFiles.length === 0) {
      setErr("Select at least one file to schedule.");
      return;
    }

    // Warn if any selected file has no duration
    const missingDuration = selectedFiles.filter((f) => !f.duration);
    if (missingDuration.length > 0) {
      setErr(
        `Some selected files have no duration. Please detect or enter durations for all selected files.`
      );
      return;
    }

    // Build schedule
    const base = new Date(baseStart);
    if (Number.isNaN(base.getTime())) {
      setErr("Base start time is invalid.");
      return;
    }

    // Sort selected files by name (you can change this ordering if you want)
    const ordered = [...selectedFiles].sort((a, b) =>
      a.name.localeCompare(b.name)
    );

    // Build rows for programs table
    const rows: {
      channel_id: number;
      start_time: string;
      title: string | null;
      mp4_url: string;
      duration: number;
    }[] = [];

    let currentStart = new Date(base);

    for (const file of ordered) {
      const durationSec = file.duration ? Math.round(file.duration) : 0;

      const { data } = supabase.storage
        .from(bucketName)
        .getPublicUrl(file.name);

      const publicUrl = data?.publicUrl;
      if (!publicUrl) {
        setErr(`Could not get public URL for ${file.name}.`);
        return;
      }

      // 🔹 Use pretty title instead of raw filename
      const prettyTitle = makePrettyTitle(file.name);

      rows.push({
        channel_id: chId,
        start_time: currentStart.toISOString(),
        title: prettyTitle,
        mp4_url: publicUrl,
        duration: durationSec,
      });

      // Advance currentStart by duration
      currentStart = new Date(
        currentStart.getTime() + durationSec * 1000
      );
    }

    // Insert into programs table
    setSavingSchedule(true);
    try {
      const { error } = await supabase.from("programs").insert(rows);
      if (error) {
        console.error("Error inserting schedule", error);
        setErr(error.message);
      } else {
        setSuccessMsg(
          `Created ${rows.length} program(s) for channel ${chId} from bucket "${bucketName}".`
        );
      }
    } catch (e: any) {
      console.error("Unexpected insert error", e);
      setErr(e?.message || "Unexpected error creating schedule.");
    } finally {
      setSavingSchedule(false);
    }
  }

  const selectedCount = useMemo(
    () => files.filter((f) => f.selected).length,
    [files]
  );

  const allDurationsKnown = useMemo(
    () => files.filter((f) => f.selected).every((f) => !!f.duration),
    [files]
  );

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#040814] via-[#050b1a] to-black text-white pb-10">
      <div className="mx-auto max-w-6xl px-4 pt-8 space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              Auto-Schedule from Buckets
            </h1>
            <p className="mt-1 text-sm text-slate-300">
              Pull MP4 files from a channel bucket, detect durations, and
              create a sequential schedule in your{" "}
              <code className="text-amber-300">programs</code> table.
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

        {/* Controls */}
        <section className="rounded-lg border border-slate-700 bg-slate-900/70 p-4 space-y-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Channel ID (for programs.channel_id)
              </label>
              <input
                type="number"
                value={channelId}
                onChange={(e) => setChannelId(e.target.value)}
                className="w-full rounded-md border border-slate-600 bg-slate-950 px-3 py-1.5 text-sm text-white focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400"
                placeholder="e.g. 1"
              />
              <p className="mt-1 text-[10px] text-slate-400">
                Use the numeric channel ID your viewer uses (1–29, etc.).
              </p>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Storage Bucket
              </label>
              <select
                value={bucketName}
                onChange={(e) => setBucketName(e.target.value)}
                className="w-full rounded-md border border-slate-600 bg-slate-950 px-3 py-1.5 text-sm text-white focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400"
              >
                {CHANNEL_BUCKETS.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-[10px] text-slate-400">
                Choose the bucket where this channel&apos;s MP4s live.
              </p>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Base Start (local time)
              </label>
              <input
                type="datetime-local"
                value={baseStart}
                onChange={(e) => setBaseStart(e.target.value)}
                className="w-full rounded-md border border-slate-600 bg-slate-950 px-3 py-1.5 text-sm text-white focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400"
              />
              <p className="mt-1 text-[10px] text-slate-400">
                The first program will start here, then each one follows based on
                duration.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={loadFiles}
              disabled={loadingFiles}
              className="border-slate-600 bg-slate-950 text-sm"
            >
              {loadingFiles ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Loading files…
                </>
              ) : (
                <>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Load Files from Bucket
                </>
              )}
            </Button>

            <Button
              type="button"
              variant="outline"
              onClick={handleDetectAll}
              disabled={
                files.length === 0 ||
                savingSchedule ||
                loadingFiles
              }
              className="border-slate-600 bg-slate-950 text-sm"
            >
              <Clock className="mr-2 h-4 w-4" />
              Detect Duration for Selected
            </Button>

            <span className="ml-auto text-xs text-slate-400">
              Selected files: {selectedCount}{" "}
              {allDurationsKnown && selectedCount > 0
                ? "• all durations set"
                : ""}
            </span>
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

          {/* Hidden video for duration detection */}
          <video
            ref={hiddenVideoRef}
            style={{ display: "none" }}
            controls={false}
          />
        </section>

        {/* Files list */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-100">
              Files in &quot;{bucketName}&quot;
            </h2>
            <p className="text-xs text-slate-400">
              Only .mp4 files are shown. Files are sorted by name.
            </p>
          </div>

          <div className="max-h-[420px] overflow-y-auto rounded-lg border border-slate-700 bg-slate-900/70">
            {loadingFiles ? (
              <div className="flex items-center justify-center py-10 text-slate-300 text-sm">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Loading files…
              </div>
            ) : files.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400">
                No files loaded. Choose a bucket and click{" "}
                <span className="text-amber-300">Load Files from Bucket</span>.
              </div>
            ) : (
              <table className="min-w-full text-xs">
                <thead>
                  <tr className="bg-slate-900/90 text-[11px] uppercase tracking-wide text-slate-300">
                    <th className="px-3 py-2 text-left">Use</th>
                    <th className="px-3 py-2 text-left">File</th>
                    <th className="px-3 py-2 text-left">Duration (seconds)</th>
                    <th className="px-3 py-2 text-left">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {files.map((file) => (
                    <tr
                      key={file.name}
                      className="border-t border-slate-800/80 hover:bg-slate-800/60"
                    >
                      <td className="px-3 py-2 align-top">
                        <input
                          type="checkbox"
                          checked={file.selected}
                          onChange={() => toggleFileSelected(file.name)}
                        />
                      </td>
                      <td className="px-3 py-2 align-top text-slate-100">
                        {file.name}
                      </td>
                      <td className="px-3 py-2 align-top">
                        <input
                          type="number"
                          min={0}
                          value={
                            file.duration != null
                              ? String(Math.round(file.duration))
                              : ""
                          }
                          onChange={(e) =>
                            handleManualDurationChange(
                              file.name,
                              e.target.value
                            )
                          }
                          className="w-24 rounded-md border border-slate-600 bg-slate-950 px-2 py-1 text-[11px] text-white focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400"
                          placeholder="sec"
                        />
                      </td>
                      <td className="px-3 py-2 align-top">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={file.detecting}
                          onClick={() => handleDetectDuration(file.name)}
                          className="border-slate-600 bg-slate-950 text-[11px] px-2 py-1"
                        >
                          {file.detecting ? (
                            <>
                              <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                              Detect…
                            </>
                          ) : (
                            <>
                              <Clock className="mr-1 h-3 w-3" />
                              Detect
                            </>
                          )}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>

        {/* Create schedule */}
        <section className="flex justify-end">
          <Button
            type="button"
            onClick={handleCreateSchedule}
            disabled={
              savingSchedule ||
              files.length === 0 ||
              selectedCount === 0
            }
            className="bg-emerald-600 hover:bg-emerald-700 text-sm"
          >
            {savingSchedule ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating schedule…
              </>
            ) : (
              <>
                <PlayCircle className="mr-2 h-4 w-4" />
                Create Schedule in Programs Table
              </>
            )}
          </Button>
        </section>
      </div>
    </div>
  );
}
