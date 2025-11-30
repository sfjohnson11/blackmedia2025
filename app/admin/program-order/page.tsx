// app/admin/program-order/page.tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import {
  ArrowLeft,
  ArrowUp,
  ArrowDown,
  Loader2,
  RefreshCw,
  Save,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";

type Program = {
  channel_id: number;
  start_time: string; // ISO string from DB (timestamptz)
  title: string | null;
  mp4_url: string;
  duration: number; // in seconds
};

const CHANNEL_OPTIONS: number[] = [
  1, 2, 3, 4, 5, 6, 7, 8, 9, 10,
  11, 12, 13, 14, 15, 16, 17, 18, 19, 20,
  21, 22, 23, 24, 25, 26, 27, 28, 29,
  30, // if you use 30 for Freedom School
];

export default function ProgramOrderPage() {
  const supabase = createClientComponentClient();

  const [channelFilter, setChannelFilter] = useState<string>(""); // "" = none selected yet
  const [programs, setPrograms] = useState<Program[]>([]);
  const [loading, setLoading] = useState(false);
  const [savingOrder, setSavingOrder] = useState(false);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [globalSuccess, setGlobalSuccess] = useState<string | null>(null);

  // Load programs for a specific channel
  async function loadPrograms(forChannel: string) {
    if (!forChannel) {
      setPrograms([]);
      return;
    }

    const chId = Number(forChannel);
    if (Number.isNaN(chId)) {
      setGlobalError("Channel must be a number.");
      setPrograms([]);
      return;
    }

    setLoading(true);
    setGlobalError(null);
    setGlobalSuccess(null);

    const { data, error } = await supabase
      .from("programs")
      .select("channel_id, start_time, title, mp4_url, duration")
      .eq("channel_id", chId)
      .order("start_time", { ascending: true });

    if (error) {
      console.error("Load error:", error);
      setGlobalError(error.message);
      setPrograms([]);
    } else {
      setPrograms((data || []) as Program[]);
    }

    setLoading(false);
  }

  // Load when channel changes
  useEffect(() => {
    if (channelFilter !== "") {
      loadPrograms(channelFilter);
    } else {
      setPrograms([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channelFilter]);

  function moveUp(index: number) {
    setPrograms((prev) => {
      if (index <= 0) return prev;
      const copy = [...prev];
      const temp = copy[index - 1];
      copy[index - 1] = copy[index];
      copy[index] = temp;
      return copy;
    });
  }

  function moveDown(index: number) {
    setPrograms((prev) => {
      if (index < 0 || index >= prev.length - 1) return prev;
      const copy = [...prev];
      const temp = copy[index + 1];
      copy[index + 1] = copy[index];
      copy[index] = temp;
      return copy;
    });
  }

  // Reflow the schedule for this channel in the current order
  async function saveOrder() {
    setGlobalError(null);
    setGlobalSuccess(null);

    if (!channelFilter) {
      setGlobalError("Select a channel before saving order.");
      return;
    }

    if (programs.length === 0) {
      setGlobalError("No programs to reorder for this channel.");
      return;
    }

    // Find earliest start time among current rows (as base)
    const baseMs = Math.min(
      ...programs.map((p) => new Date(p.start_time).getTime())
    );
    if (!Number.isFinite(baseMs)) {
      setGlobalError("Could not determine base start time.");
      return;
    }

    let current = new Date(baseMs);
    const updates: {
      program: Program;
      newStart: string;
    }[] = [];

    for (const p of programs) {
      const newStartIso = current.toISOString();
      updates.push({ program: p, newStart: newStartIso });

      // advance by duration
      const durMs = (p.duration || 0) * 1000;
      current = new Date(current.getTime() + durMs);
    }

    setSavingOrder(true);

    try {
      for (const u of updates) {
        const p = u.program;

        const { error } = await supabase
          .from("programs")
          .update({ start_time: u.newStart })
          .eq("channel_id", p.channel_id)
          .eq("mp4_url", p.mp4_url)
          .eq("start_time", p.start_time); // original start_time as key

        if (error) {
          console.error("Update error:", error);
          setGlobalError(
            `Error updating ${p.title || p.mp4_url}: ${error.message}`
          );
          setSavingOrder(false);
          return;
        }
      }

      setGlobalSuccess(
        `Updated order for Channel ${channelFilter} and reflowed start times in sequence.`
      );

      // Reload from DB so times and order reflect the latest
      await loadPrograms(channelFilter);
    } catch (e: any) {
      console.error("Unexpected save order error:", e);
      setGlobalError(e?.message || "Unexpected error saving order.");
    } finally {
      setSavingOrder(false);
    }
  }

  return (
    <div className="min-h-screen bg-black text-white p-6">
      {/* Header */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Program Order Manager</h1>
          <p className="mt-1 text-sm text-gray-400">
            Reorder programs for a single channel. Use the arrows to move shows
            up or down, then{" "}
            <span className="font-semibold text-amber-300">Save Order</span>{" "}
            to reflow start times in sequence based on duration.
          </p>
        </div>

        <Link href="/admin">
          <Button variant="outline" className="border-gray-600 bg-gray-900">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Admin
          </Button>
        </Link>
      </div>

      {/* Channel selector + actions */}
      <div className="mb-4 flex flex-col gap-3 rounded border border-gray-700 bg-gray-900/70 p-3 text-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <label className="text-xs font-medium text-gray-300">
            Channel
          </label>
          <select
            value={channelFilter}
            onChange={(e) => setChannelFilter(e.target.value)}
            className="rounded-md border border-gray-600 bg-gray-950 px-3 py-1.5 text-sm text-white focus:border-amber-400 focus:ring-1 focus:ring-amber-400"
          >
            <option value="">Select a channel…</option>
            {CHANNEL_OPTIONS.map((ch) => (
              <option key={ch} value={String(ch)}>
                Channel {ch}
              </option>
            ))}
          </select>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              if (channelFilter) loadPrograms(channelFilter);
            }}
            disabled={!channelFilter || loading}
            className="border-gray-600 bg-gray-950 ml-2"
          >
            {loading ? (
              <>
                <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                Loading…
              </>
            ) : (
              <>
                <RefreshCw className="mr-1 h-4 w-4" />
                Reload
              </>
            )}
          </Button>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-400">
            {channelFilter
              ? `Programs loaded: ${programs.length}`
              : "Select a channel to view its schedule."}
          </span>

          <Button
            type="button"
            onClick={saveOrder}
            disabled={
              !channelFilter ||
              programs.length === 0 ||
              savingOrder ||
              loading
            }
            className="bg-emerald-600 hover:bg-emerald-700 text-sm"
          >
            {savingOrder ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving Order…
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                Save Order
              </>
            )}
          </Button>
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

      {/* List */}
      {loading && !programs.length ? (
        <div className="py-10 text-center text-gray-300">
          <Loader2 className="mx-auto mb-3 h-6 w-6 animate-spin" />
          Loading programs…
        </div>
      ) : programs.length === 0 ? (
        <div className="py-6 text-center text-sm text-gray-400">
          {channelFilter
            ? "No programs found for this channel."
            : "Select a channel above to view its programs."}
        </div>
      ) : (
        <div className="space-y-3">
          {programs.map((p, index) => {
            const canMoveUp = index > 0;
            const canMoveDown = index < programs.length - 1;

            const start = new Date(p.start_time);
            const timeLabel = isNaN(start.getTime())
              ? p.start_time
              : start.toLocaleString();

            const durationMin = Math.round((p.duration || 0) / 60);

            return (
              <div
                key={`${p.channel_id}-${p.start_time}-${index}`}
                className="rounded border border-gray-700 bg-gray-900/60 p-3"
              >
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  {/* Info */}
                  <div className="min-w-0">
                    <p className="text-xs text-gray-400">
                      Channel {p.channel_id} • {timeLabel} •{" "}
                      {durationMin} min
                    </p>
                    <p className="text-sm font-semibold text-amber-200 truncate">
                      {p.title || "(no title)"}
                    </p>
                    <p className="mt-1 break-all text-[11px] text-blue-300">
                      {p.mp4_url}
                    </p>
                  </div>

                  {/* Controls */}
                  <div className="flex items-center gap-2 md:flex-col md:items-end">
                    <div className="flex items-center gap-1">
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={() => moveUp(index)}
                        disabled={!canMoveUp}
                        className="border-gray-600 bg-gray-950 h-7 w-7"
                      >
                        <ArrowUp className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={() => moveDown(index)}
                        disabled={!canMoveDown}
                        className="border-gray-600 bg-gray-950 h-7 w-7"
                      >
                        <ArrowDown className="h-4 w-4" />
                      </Button>
                    </div>
                    <p className="text-[10px] text-gray-400 max-w-[200px] text-right">
                      Use arrows to change order. When done, click{" "}
                      <span className="font-semibold text-amber-300">
                        Save Order
                      </span>{" "}
                      above to reflow all start times in this new order.
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Footer note */}
      <div className="mt-8 flex items-center gap-2 text-xs text-gray-500">
        <Check className="h-3 w-3 text-emerald-400" />
        <span>
          This page only updates <code>start_time</code> for programs in the
          selected channel. Titles and MP4 URLs are untouched.
        </span>
      </div>
    </div>
  );
}
