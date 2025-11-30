// app/admin/program-titles/page.tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import { ArrowLeft, Save, Loader2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";

type Program = {
  channel_id: number;
  start_time: string;
  title: string | null;
  mp4_url: string;
  duration: number;
};

const CHANNEL_OPTIONS: number[] = [
  1, 2, 3, 4, 5, 6, 7, 8, 9, 10,
  11, 12, 13, 14, 15, 16, 17, 18, 19, 20,
  21, 22, 23, 24, 25, 26, 27, 28, 29,
  30 // if you use 30 for Freedom School, etc.
];

export default function ProgramTitlesPage() {
  const supabase = createClientComponentClient();

  const [programs, setPrograms] = useState<Program[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingIndex, setSavingIndex] = useState<number | null>(null);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [globalSuccess, setGlobalSuccess] = useState<string | null>(null);

  // New: channel filter (string so it works nicely with <select>)
  const [channelFilter, setChannelFilter] = useState<string>(""); // "" = all channels

  // Load programs (optionally filtered by channel)
  async function loadPrograms(forChannel: string) {
    setLoading(true);
    setGlobalError(null);
    setGlobalSuccess(null);

    let query = supabase
      .from("programs")
      .select("channel_id, start_time, title, mp4_url, duration");

    // If a specific channel is selected, filter by that channel_id
    if (forChannel !== "") {
      const chId = Number(forChannel);
      if (!Number.isNaN(chId)) {
        query = query.eq("channel_id", chId);
      }
    }

    // Always order within the result
    query = query
      .order("channel_id", { ascending: true })
      .order("start_time", { ascending: true });

    const { data, error } = await query;

    if (error) {
      console.error("Load error:", error);
      setGlobalError(error.message);
      setPrograms([]);
    } else {
      setPrograms((data || []) as Program[]);
    }

    setLoading(false);
  }

  // Load once on mount (all or default), then reload whenever the channel filter changes
  useEffect(() => {
    loadPrograms(channelFilter);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channelFilter]);

  // Update title in local state by row index
  function updateTitleAtIndex(index: number, value: string) {
    setPrograms((prev) =>
      prev.map((p, i) => (i === index ? { ...p, title: value } : p))
    );
  }

  // Save ONE program's title to Supabase (identified by channel_id + start_time + mp4_url)
  async function saveOne(index: number) {
    setGlobalError(null);
    setGlobalSuccess(null);
    setSavingIndex(index);

    const program = programs[index];
    if (!program) {
      setGlobalError("Program not found in local state.");
      setSavingIndex(null);
      return;
    }

    try {
      const { error } = await supabase
        .from("programs")
        .update({ title: program.title })
        .eq("channel_id", program.channel_id)
        .eq("start_time", program.start_time)
        .eq("mp4_url", program.mp4_url);

      if (error) {
        console.error("Save error:", error);
        setGlobalError(error.message);
      } else {
        setGlobalSuccess(
          `Updated title for Channel ${program.channel_id} (${new Date(
            program.start_time
          ).toLocaleString()})`
        );
      }
    } catch (e: any) {
      console.error("Unexpected save error:", e);
      setGlobalError(e?.message || "Unexpected error saving title.");
    }

    setSavingIndex(null);
  }

  return (
    <div className="min-h-screen bg-black text-white p-6">
      {/* Header */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold">Program Title Editor</h1>

        <Link href="/admin">
          <Button variant="outline" className="border-gray-600 bg-gray-900">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Admin
          </Button>
        </Link>
      </div>

      {/* Channel filter */}
      <div className="mb-4 flex flex-col gap-2 rounded border border-gray-700 bg-gray-900/60 p-3 text-sm">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <label className="block text-xs font-medium text-gray-300 mb-1">
              Filter by Channel
            </label>
            <div className="flex items-center gap-2">
              <select
                value={channelFilter}
                onChange={(e) => setChannelFilter(e.target.value)}
                className="rounded-md border border-gray-600 bg-gray-950 px-3 py-1.5 text-sm text-white focus:border-amber-400 focus:ring-1 focus:ring-amber-400"
              >
                <option value="">All Channels</option>
                {CHANNEL_OPTIONS.map((ch) => (
                  <option key={ch} value={String(ch)}>
                    Channel {ch}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="text-xs text-gray-400 sm:text-right">
            Showing{" "}
            <span className="font-semibold text-amber-300">
              {programs.length}
            </span>{" "}
            program(s)
            {channelFilter !== "" && (
              <>
                {" "}
                for{" "}
                <span className="font-semibold">
                  Channel {channelFilter}
                </span>
              </>
            )}
            {channelFilter === "" && " across all channels."}
          </div>
        </div>
      </div>

      {/* Global alerts */}
      {globalError && (
        <div className="mb-4 rounded border border-red-500 bg-red-900/50 p-3 text-sm text-red-200">
          {globalError}
        </div>
      )}
      {globalSuccess && (
        <div className="mb-4 rounded border border-emerald-500 bg-emerald-900/40 p-3 text-sm text-emerald-100">
          {globalSuccess}
        </div>
      )}

      {/* Loading / list */}
      {loading ? (
        <div className="py-10 text-center text-gray-300">
          <Loader2 className="mx-auto mb-3 h-6 w-6 animate-spin" />
          Loading programs…
        </div>
      ) : (
        <div className="space-y-6">
          {programs.map((program, index) => {
            const isSaving = savingIndex === index;

            return (
              <div
                key={`${program.channel_id}-${program.start_time}-${index}`}
                className="rounded border border-gray-700 bg-gray-900/60 p-4"
              >
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  {/* Info */}
                  <div className="min-w-0">
                    <p className="mb-1 text-xs text-gray-400">
                      Channel {program.channel_id} •{" "}
                      {new Date(program.start_time).toLocaleString()}
                    </p>
                    <p className="break-all text-xs text-blue-300">
                      {program.mp4_url}
                    </p>
                  </div>

                  {/* Title + Save */}
                  <div className="flex flex-col items-stretch gap-2 md:w-96 md:flex-row md:items-center">
                    <input
                      type="text"
                      value={program.title || ""}
                      onChange={(e) =>
                        updateTitleAtIndex(index, e.target.value)
                      }
                      className="w-full rounded-md border border-gray-600 bg-gray-950 px-3 py-2 text-sm text-white focus:border-amber-400 focus:ring-1 focus:ring-amber-400"
                      placeholder="Enter program title"
                    />

                    <Button
                      type="button"
                      onClick={() => saveOne(index)}
                      disabled={isSaving}
                      className="shrink-0 bg-amber-600 hover:bg-amber-700"
                    >
                      {isSaving ? (
                        <>
                          <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                          Saving…
                        </>
                      ) : (
                        <>
                          <Save className="mr-1 h-4 w-4" />
                          Save
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}

          {programs.length === 0 && (
            <div className="py-6 text-center text-sm text-gray-400">
              No programs found for this selection.
            </div>
          )}
        </div>
      )}

      {/* Footer note */}
      <div className="mt-8 flex items-center gap-2 text-xs text-gray-500">
        <Check className="h-3 w-3 text-emerald-400" />
        <span>
          Each row has its own <span className="font-semibold">Save</span>{" "}
          button. Titles are filtered by channel so you don&apos;t have to
          scroll through all channels at once.
        </span>
      </div>
    </div>
  );
}
