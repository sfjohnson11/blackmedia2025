// app/admin/program-titles/page.tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import { ArrowLeft, Save, Loader2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";

type Program = {
  id: number;
  channel_id: number;
  start_time: string;
  title: string | null;
  mp4_url: string;
  duration: number;
};

export default function ProgramTitlesPage() {
  const supabase = createClientComponentClient();

  const [programs, setPrograms] = useState<Program[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<number | null>(null);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [globalSuccess, setGlobalSuccess] = useState<string | null>(null);

  // Load all programs
  async function loadPrograms() {
    setLoading(true);
    setGlobalError(null);
    setGlobalSuccess(null);

    const { data, error } = await supabase
      .from("programs")
      .select("*")
      .order("channel_id", { ascending: true })
      .order("start_time", { ascending: true });

    if (error) {
      console.error("Load error:", error);
      setGlobalError(error.message);
    } else {
      setPrograms((data || []) as Program[]);
    }

    setLoading(false);
  }

  useEffect(() => {
    loadPrograms();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update a program title locally
  function updateTitle(id: number, value: string) {
    setPrograms((prev) =>
      prev.map((p) => (p.id === id ? { ...p, title: value } : p))
    );
  }

  // Save ONE program's title
  async function saveOne(id: number) {
    setGlobalError(null);
    setGlobalSuccess(null);
    setSavingId(id);

    const program = programs.find((p) => p.id === id);
    if (!program) {
      setGlobalError("Program not found in local state.");
      setSavingId(null);
      return;
    }

    try {
      const { error } = await supabase
        .from("programs")
        .update({ title: program.title })
        .eq("id", program.id);

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

    setSavingId(null);
  }

  return (
    <div className="min-h-screen bg-black text-white p-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Program Title Editor</h1>

        <Link href="/admin">
          <Button variant="outline" className="border-gray-600 bg-gray-900">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Admin
          </Button>
        </Link>
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

      {/* Loading */}
      {loading ? (
        <div className="py-10 text-center text-gray-300">
          <Loader2 className="mx-auto mb-3 h-6 w-6 animate-spin" />
          Loading programs…
        </div>
      ) : (
        <div className="space-y-6">
          {programs.map((program) => {
            const isSaving = savingId === program.id;

            return (
              <div
                key={program.id}
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
                      onChange={(e) => updateTitle(program.id, e.target.value)}
                      className="w-full rounded-md border border-gray-600 bg-gray-950 px-3 py-2 text-sm text-white focus:border-amber-400 focus:ring-1 focus:ring-amber-400"
                      placeholder="Enter program title"
                    />

                    <Button
                      type="button"
                      onClick={() => saveOne(program.id)}
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
              No programs found in the database.
            </div>
          )}
        </div>
      )}

      {/* Optional footer note */}
      <div className="mt-8 flex items-center gap-2 text-xs text-gray-500">
        <Check className="h-3 w-3 text-emerald-400" />
        <span>
          Each row has its own <span className="font-semibold">Save</span>{" "}
          button. Updating one title does not change any other titles or mp4
          files.
        </span>
      </div>
    </div>
  );
}
