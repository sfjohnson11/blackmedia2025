// app/admin/programs/page.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import {
  Loader2,
  RefreshCw,
  ArrowLeft,
  Filter,
  Clock,
  Plus,
} from "lucide-react";
import { Button } from "@/components/ui/button";

type Program = {
  id: string;
  channel_id: number;
  start_time: string | null;
  title: string | null;
  mp4_url: string | null;
  duration: number | null; // seconds
};

export default function ProgramsManagerPage() {
  const supabase = createClientComponentClient();

  const [programs, setPrograms] = useState<Program[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [selectedChannel, setSelectedChannel] = useState<string>("all");

  // Form state for quick-add
  const [newChannelId, setNewChannelId] = useState<string>("");
  const [newTitle, setNewTitle] = useState<string>("");
  const [newStartTime, setNewStartTime] = useState<string>(""); // ISO local string
  const [newMp4Url, setNewMp4Url] = useState<string>("");
  const [newDuration, setNewDuration] = useState<string>(""); // seconds as string
  const [saving, setSaving] = useState(false);
  const [autoDurationLoading, setAutoDurationLoading] = useState(false);

  const hiddenVideoRef = useRef<HTMLVideoElement | null>(null);

  async function loadPrograms() {
    setLoading(true);
    setErr(null);
    try {
      const { data, error } = await supabase
        .from("programs") // uses your programs table
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

  // Build channel list from data
  const channelOptions = useMemo(() => {
    const set = new Set<number>();
    for (const p of programs) {
      if (typeof p.channel_id === "number") set.add(p.channel_id);
    }
    return Array.from(set).sort((a, b) => a - b);
  }, [programs]);

  const filteredPrograms = useMemo(() => {
    if (selectedChannel === "all") return programs;
    const ch = Number(selectedChannel);
    if (Number.isNaN(ch)) return programs;
    return programs.filter((p) => p.channel_id === ch);
  }, [programs, selectedChannel]);

  function formatDate(value?: string | null) {
    if (!value) return "";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return value;
    return d.toLocaleString();
  }

  function formatDuration(seconds?: number | null) {
    if (!seconds && seconds !== 0) return "";
    const s = Math.floor(seconds);
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    if (h > 0) {
      return `${h}h ${m}m ${sec}s`;
    }
    if (m > 0) {
      return `${m}m ${sec}s`;
    }
    return `${sec}s`;
  }

  async function handleCreateProgram(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);

    const chId = Number(newChannelId);
    if (Number.isNaN(chId)) {
      setErr("Channel ID must be a number.");
      return;
    }

    if (!newMp4Url) {
      setErr("MP4 URL is required.");
      return;
    }

    setSaving(true);
    try {
      const durationNum = newDuration ? Number(newDuration) : null;

      const { error } = await supabase.from("programs").insert({
        channel_id: chId,
        title: newTitle || null,
        mp4_url: newMp4Url,
        start_time: newStartTime ? new Date(newStartTime).toISOString() : null,
        duration: durationNum,
      });

      if (error) {
        console.error("Error creating program", error);
        setErr(error.message);
      } else {
        // Clear form and reload list
        setNewChannelId("");
        setNewTitle("");
        setNewStartTime("");
        setNewMp4Url("");
        setNewDuration("");
        await loadPrograms();
      }
    } catch (e: any) {
      console.error("Unexpected error creating program", e);
      setErr(e?.message || "Unexpected error creating program");
    } finally {
      setSaving(false);
    }
  }

  // Auto-detect duration for the MP4 URL using a hidden <video>
  async function handleAutoDuration() {
    if (!newMp4Url) {
      setErr("Enter an MP4 URL first to detect duration.");
      return;
    }
    setErr(null);
    setAutoDurationLoading(true);

    try {
      const videoEl =
        hiddenVideoRef.current || document.createElement("video");
      hiddenVideoRef.current = videoEl;
      videoEl.preload = "metadata";
      videoEl.src = newMp4Url;
      videoEl.crossOrigin = "anonymous";

      await new Promise<void>((resolve, reject) => {
        const onLoaded = () => {
          cleanup();
          resolve();
        };
        const onError = () => {
          cleanup();
          reject(new Error("Could not load video metadata."));
        };
        const cleanup = () => {
          videoEl.removeEventListener("loadedmetadata", onLoaded);
          videoEl.removeEventListener("error", onError);
        };
        videoEl.addEventListener("loadedmetadata", onLoaded);
        videoEl.addEventListener("error", onError);
      });

      const durationSeconds = videoEl.duration;
      if (!Number.isFinite(durationSeconds)) {
        throw new Error("Video duration is not available.");
      }

      setNewDuration(String(Math.round(durationSeconds)));
    } catch (e: any) {
      console.error("Auto-duration error", e);
      setErr(e?.message || "Could not determine video duration.");
    } finally {
      setAutoDurationLoading(false);
    }
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
              Manage programs in your <code className="text-amber-300">programs</code>{" "}
              table. Use this to see what&apos;s scheduled and add new items from
              your MP4 URLs.
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

        {/* Quick Add Form */}
        <section className="rounded-lg border border-slate-700 bg-slate-900/70 p-4 space-y-4">
          <div className="flex items-center gap-2">
            <Plus className="h-4 w-4 text-emerald-300" />
            <h2 className="text-sm font-semibold text-slate-100">
              Add Program from MP4 URL
            </h2>
          </div>

          <form
            onSubmit={handleCreateProgram}
            className="grid grid-cols-1 gap-3 md:grid-cols-2"
          >
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Channel ID
              </label>
              <input
                type="number"
                value={newChannelId}
                onChange={(e) => setNewChannelId(e.target.value)}
                className="w-full rounded-md border border-slate-600 bg-slate-950 px-3 py-1.5 text-sm text-white focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400"
                placeholder="e.g. 1"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Title
              </label>
              <input
                type="text"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                className="w-full rounded-md border border-slate-600 bg-slate-950 px-3 py-1.5 text-sm text-white focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400"
                placeholder="Program title"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Start Time (local)
              </label>
              <input
                type="datetime-local"
                value={newStartTime}
                onChange={(e) => setNewStartTime(e.target.value)}
                className="w-full rounded-md border border-slate-600 bg-slate-950 px-3 py-1.5 text-sm text-white focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400"
              />
              <p className="mt-1 text-[10px] text-slate-400">
                This will be saved as UTC in your database.
              </p>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                MP4 URL
              </label>
              <input
                type="url"
                value={newMp4Url}
                onChange={(e) => setNewMp4Url(e.target.value)}
                className="w-full rounded-md border border-slate-600 bg-slate-950 px-3 py-1.5 text-sm text-white focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400"
                placeholder="https://..."
                required
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Duration (seconds)
              </label>
              <div className="flex gap-2">
                <input
                  type="number"
                  value={newDuration}
                  onChange={(e) => setNewDuration(e.target.value)}
                  className="w-full rounded-md border border-slate-600 bg-slate-950 px-3 py-1.5 text-sm text-white focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400"
                  placeholder="e.g. 1800"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleAutoDuration}
                  disabled={autoDurationLoading || !newMp4Url}
                  className="border-slate-600 bg-slate-950 text-xs"
                >
                  {autoDurationLoading ? (
                    <>
                      <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                      Detect
                    </>
                  ) : (
                    <>
                      <Clock className="mr-1 h-3 w-3" />
                      Detect
                    </>
                  )}
                </Button>
              </div>
              <p className="mt-1 text-[10px] text-slate-400">
                Optional: click Detect to read the duration from the video file in
                your browser.
              </p>
            </div>

            <div className="flex items-end">
              <Button
                type="submit"
                disabled={saving}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-sm"
              >
                {saving ? "Saving…" : "Add Program"}
              </Button>
            </div>
          </form>

          {err && (
            <div className="rounded-md border border-red-500/60 bg-red-950/50 px-3 py-2 text-xs text-red-200">
              {err}
            </div>
          )}

          {/* Hidden video element for duration detection */}
          <video
            ref={hiddenVideoRef}
            style={{ display: "none" }}
            controls={false}
          />
        </section>

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
              <option key={ch} value={String(ch)}>
                Channel {ch}
              </option>
            ))}
          </select>
          <span className="ml-auto text-xs text-slate-400">
            Showing {filteredPrograms.length} of {programs.length} programs
          </span>
        </div>

        {/* Table */}
        <div className="overflow-x-auto rounded-lg border border-slate-700 bg-slate-900/70">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="bg-slate-900/90 text-xs uppercase tracking-wide text-slate-300">
                <th className="px-3 py-2 text-left">Channel</th>
                <th className="px-3 py-2 text-left">Title</th>
                <th className="px-3 py-2 text-left">Start</th>
                <th className="px-3 py-2 text-left">Duration</th>
                <th className="px-3 py-2 text-left">MP4 URL</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-3 py-6 text-center text-slate-300"
                  >
                    <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                    Loading programs from Supabase…
                  </td>
                </tr>
              ) : filteredPrograms.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-3 py-6 text-center text-slate-400"
                  >
                    No programs found. Add one above using your MP4 URL.
                  </td>
                </tr>
              ) : (
                filteredPrograms.map((p) => (
                  <tr
                    key={p.id}
                    className="border-t border-slate-800/80 hover:bg-slate-800/60"
                  >
                    <td className="px-3 py-2 align-top text-slate-100">
                      Channel {p.channel_id}
                    </td>
                    <td className="px-3 py-2 align-top text-slate-100">
                      {p.title || (
                        <span className="text-slate-500 italic">Untitled</span>
                      )}
                    </td>
                    <td className="px-3 py-2 align-top text-slate-200">
                      {formatDate(p.start_time)}
                    </td>
                    <td className="px-3 py-2 align-top text-slate-200">
                      {formatDuration(p.duration)}
                    </td>
                    <td className="px-3 py-2 align-top text-[11px] text-slate-400 break-all">
                      {p.mp4_url}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
