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
  "channel1","channel2","channel3","channel4","channel5","channel6","channel7",
  "channel8","channel9","channel10","channel11","channel12","channel13","channel14",
  "channel15","channel16","channel17","channel18","channel19","channel20","channel21",
  "channel22","channel23","channel24","channel25","channel26","channel27","channel28",
  "channel29","freedom-school",
];

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
        setErr(error.message);
        return;
      }

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
    } catch (e: any) {
      setErr(e?.message || "Unexpected error listing files.");
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

  async function detectDurationForFile(file: BucketFile) {
    const videoEl =
      hiddenVideoRef.current || document.createElement("video");

    hiddenVideoRef.current = videoEl;
    videoEl.preload = "metadata";
    videoEl.crossOrigin = "anonymous";

    const { data } = supabase.storage.from(bucketName).getPublicUrl(file.name);
    const publicUrl = data?.publicUrl;
    if (!publicUrl) throw new Error("Could not get public URL.");

    videoEl.src = publicUrl;

    await new Promise<void>((resolve, reject) => {
      const onLoaded = () => {
        cleanup();
        resolve();
      };
      const onError = () => {
        cleanup();
        reject(new Error("Could not load metadata."));
      };
      const cleanup = () => {
        videoEl.removeEventListener("loadedmetadata", onLoaded);
        videoEl.removeEventListener("error", onError);
      };
      videoEl.addEventListener("loadedmetadata", onLoaded);
      videoEl.addEventListener("error", onError);
    });

    const sec = videoEl.duration;
    if (!Number.isFinite(sec)) throw new Error("No duration available.");

    setFiles((prev) =>
      prev.map((f) =>
        f.name === file.name ? { ...f, duration: Math.round(sec) } : f
      )
    );
  }

  async function handleDetectDuration(name: string) {
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
        if (!err)
          setErr(`Could not detect duration for ${file.name}.`);
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
        f.name === name ? { ...f, duration: sec } : f
      )
    );
  }

  async function handleCreateSchedule() {
    setErr(null);
    setSuccessMsg(null);

    const chId = Number(channelId);
    if (Number.isNaN(chId)) {
      setErr("Channel ID must be a number.");
      return;
    }

    if (!baseStart) {
      setErr("Select a base start date/time.");
      return;
    }

    const selectedFiles = files.filter((f) => f.selected);
    if (selectedFiles.length === 0) {
      setErr("Select at least one file.");
      return;
    }

    if (selectedFiles.some((f) => !f.duration)) {
      setErr("All selected files must have durations.");
      return;
    }

    const base = new Date(baseStart);
    if (Number.isNaN(base.getTime())) {
      setErr("Invalid date/time format.");
      return;
    }

    const ordered = [...selectedFiles].sort((a, b) =>
      a.name.localeCompare(b.name)
    );

    const rows: {
      channel_id: number;
      start_time: string;
      title: string | null;
      mp4_url: string;
      duration: number;
    }[] = [];

    let currentStart = new Date(base);

    for (const file of ordered) {
      const durationSec = Math.round(file.duration || 0);

      const { data } = supabase.storage
        .from(bucketName)
        .getPublicUrl(file.name);

      const publicUrl = data?.publicUrl;
      if (!publicUrl) {
        setErr(`No public URL for ${file.name}.`);
        return;
      }

      rows.push({
        channel_id: chId,
        start_time: currentStart.toISOString(),
        title: file.name,
        mp4_url: publicUrl,
        duration: durationSec,
      });

      currentStart = new Date(
        currentStart.getTime() + durationSec * 1000
      );
    }

    setSavingSchedule(true);
    try {
      const { error } = await supabase.from("programs").insert(rows);
      if (error) setErr(error.message);
      else setSuccessMsg(`Created ${rows.length} programs.`);
    } catch (e: any) {
      setErr(e?.message || "Unexpected insert error.");
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

        {/* HEADER */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              Auto-Schedule from Buckets
            </h1>
            <p className="mt-1 text-sm text-slate-300">
              Detect durations + auto-build sequential program schedules.
            </p>
          </div>
          <Link href="/admin">
            <Button variant="outline" className="border-slate-600 bg-slate-900">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Admin
            </Button>
          </Link>
        </div>

        {/* CONTROL PANEL */}
        <section className="rounded-lg border border-slate-700 bg-slate-900/70 p-4 space-y-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">

            {/* CHANNEL ID */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Channel ID
              </label>
              <input
                type="number"
                value={channelId}
                onChange={(e) => setChannelId(e.target.value)}
                className="w-full rounded-md border border-slate-600 bg-slate-950 px-3 py-1.5 text-sm text-white"
                placeholder="e.g. 1"
              />
            </div>

            {/* BUCKET */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Storage Bucket
              </label>
              <select
                value={bucketName}
                onChange={(e) => setBucketName(e.target.value)}
                className="w-full rounded-md border border-slate-600 bg-slate-950 px-3 py-1.5 text-sm text-white"
              >
                {CHANNEL_BUCKETS.map((b) => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
            </div>

            {/* BASE START with seconds enabled */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Base Start (local time)
              </label>
              <input
                type="datetime-local"
                step="1"         // <-- enables seconds
                value={baseStart}
                onChange={(e) => setBaseStart(e.target.value)}
                className="w-full rounded-md border border-slate-600 bg-slate-950 px-3 py-1.5 text-sm text-white"
              />
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
                  Loading…
                </>
              ) : (
                <>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Load Files
                </>
              )}
            </Button>

            <Button
              type="button"
              variant="outline"
              onClick={handleDetectAll}
              disabled={loadingFiles || savingSchedule || files.length === 0}
              className="border-slate-600 bg-slate-950 text-sm"
            >
              <Clock className="mr-2 h-4 w-4" />
              Detect Duration for Selected
            </Button>

            <span className="ml-auto text-xs text-slate-400">
              Selected: {selectedCount}{" "}
              {allDurationsKnown && selectedCount > 0 ? "• all durations set" : ""}
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

          <video ref={hiddenVideoRef} style={{ display: "none" }} />
        </section>

        {/* FILE LIST */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-100">
              Files in "{bucketName}"
            </h2>
            <p className="text-xs text-slate-400">
              Only .mp4 files shown
            </p>
          </div>

          <div className="max-h-[420px] overflow-y-auto rounded-lg border border-slate-700 bg-slate-900/70">
            {loadingFiles ? (
              <div className="flex items-center justify-center py-10 text-slate-300 text-sm">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Loading…
              </div>
            ) : files.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400">
                No files loaded.
              </div>
            ) : (
              <table className="min-w-full text-xs">
                <thead>
                  <tr className="bg-slate-900/90 text-[11px] uppercase tracking-wide text-slate-300">
                    <th className="px-3 py-2 text-left">Use</th>
                    <th className="px-3 py-2 text-left">File</th>
                    <th className="px-3 py-2 text-left">Duration (sec)</th>
                    <th className="px-3 py-2 text-left">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {files.map((file) => (
                    <tr key={file.name} className="border-t border-slate-800/80 hover:bg-slate-800/60">
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
                          value={file.duration ?? ""}
                          onChange={(e) =>
                            handleManualDurationChange(file.name, e.target.value)
                          }
                          className="w-24 rounded-md border border-slate-600 bg-slate-950 px-2 py-1 text-[11px] text-white"
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

        {/* CREATE SCHEDULE BUTTON */}
        <section className="flex justify-end">
          <Button
            type="button"
            onClick={handleCreateSchedule}
            disabled={savingSchedule || files.length === 0 || selectedCount === 0}
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
