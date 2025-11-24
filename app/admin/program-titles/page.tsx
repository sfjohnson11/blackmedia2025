"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import { ArrowLeft, Save, Loader2 } from "lucide-react";
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
  const [originalPrograms, setOriginalPrograms] = useState<Program[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Load all programs
  async function loadPrograms() {
    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    const { data, error } = await supabase
      .from("programs")
      .select("*")
      .order("channel_id", { ascending: true })
      .order("start_time", { ascending: true });

    if (error) {
      console.error("Load error:", error);
      setErrorMsg(error.message);
    } else {
      const rows = (data || []) as Program[];
      setPrograms(rows);
      setOriginalPrograms(rows); // snapshot for change detection
    }

    setLoading(false);
  }

  // Update a program title locally
  function updateTitle(id: number, value: string) {
    setPrograms((prev) =>
      prev.map((p) => (p.id === id ? { ...p, title: value } : p))
    );
  }

  // Save only changed titles
  async function saveAll() {
    setSaving(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      // Find rows where title actually changed
      const changed = programs.filter((p) => {
        const original = originalPrograms.find((o) => o.id === p.id);
        if (!original) return false;
        const origTitle = original.title ?? "";
        const newTitle = p.title ?? "";
        return origTitle !== newTitle;
      });

      if (changed.length === 0) {
        setSuccessMsg("No changes to save.");
        setSaving(false);
        return;
      }

      // IMPORTANT:
      // We ONLY update the "title" column for the changed rows.
      // We NEVER touch mp4_url or any storage/bucket objects here.
      const results = await Promise.all(
        changed.map((p) =>
          supabase
            .from("programs")
            .update({ title: p.title })
            .eq("id", p.id)
        )
      );

      const firstError = results.find((r) => r.error)?.error;
      if (firstError) {
        console.error("Save error:", firstError);
        setErrorMsg(firstError.message);
      } else {
        setSuccessMsg(`Updated ${changed.length} title${changed.length === 1 ? "" : "s"} successfully!`);
        // refresh snapshot so further edits compare correctly
        setOriginalPrograms(programs);
      }
    } catch (e: any) {
      console.error("Unexpected save error:", e);
      setErrorMsg(e?.message || "Unexpected error saving titles.");
    }

    setSaving(false);
  }

  useEffect(() => {
    loadPrograms();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-screen bg-black text-white p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Program Title Editor</h1>

        <Link href="/admin">
          <Button variant="outline" className="border-gray-600 bg-gray-900">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Admin
          </Button>
        </Link>
      </div>

      {/* Alerts */}
      {errorMsg && (
        <div className="mb-4 p-3 rounded bg-red-900/50 border border-red-500 text-red-200 text-sm">
          {errorMsg}
        </div>
      )}

      {successMsg && (
        <div className="mb-4 p-3 rounded bg-green-900/40 border border-green-500 text-green-200 text-sm">
          {successMsg}
        </div>
      )}

      {/* Loading */}
      {loading ? (
        <div className="text-center py-10 text-gray-300">
          <Loader2 className="h-6 w-6 animate-spin mx-auto mb-3" />
          Loading programs…
        </div>
      ) : (
        <div className="space-y-6">
          {programs.map((program) => (
            <div
              key={program.id}
              className="border border-gray-700 bg-gray-900/60 rounded p-4"
            >
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                <div>
                  <p className="text-xs text-gray-400 mb-1">
                    Channel {program.channel_id} •{" "}
                    {new Date(program.start_time).toLocaleString()}
                  </p>
                  <p className="text-xs text-blue-300 break-all">
                    {program.mp4_url}
                  </p>
                </div>

                <input
                  type="text"
                  value={program.title || ""}
                  onChange={(e) => updateTitle(program.id, e.target.value)}
                  className="w-full md:w-80 rounded-md border border-gray-600 bg-gray-950 px-3 py-2 text-sm text-white focus:border-amber-400 focus:ring-1 focus:ring-amber-400"
                  placeholder="Enter program title"
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Save Button */}
      <div className="mt-10 flex justify-end">
        <Button
          onClick={saveAll}
          disabled={saving || loading}
          className="bg-amber-600 hover:bg-amber-700"
        >
          {saving ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              Saving…
            </>
          ) : (
            <>
              <Save className="h-4 w-4 mr-2" />
              Save All Changes
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
