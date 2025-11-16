"use client";

import { useState } from "react";
import Link from "next/link";
import { RefreshCw, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function RefreshProgramsPage() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  async function runScheduler() {
    setLoading(true);
    setResult(null);

    try {
      const res = await fetch("/api/admin/refresh-programs", {
        method: "POST",
      });

      const json = await res.json();

      if (!res.ok || json.error) {
        setResult(`❌ Error: ${json.error || "Unknown error"}`);
      } else {
        setResult(
          `✅ Rebuilt schedule. Inserted ${json.programsInserted ?? 0} programs starting at ${json.dayStart || ""}`
        );
      }
    } catch (err: any) {
      console.error("Scheduler error:", err);
      setResult(`❌ Error: ${err?.message || "Unknown error"}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="mx-auto max-w-2xl px-4 py-8">
        <div className="mb-4 flex items-center gap-3">
          <Link
            href="/admin"
            className="inline-flex items-center text-sm text-gray-300 hover:text-white"
          >
            <ArrowLeft className="mr-1 h-4 w-4" />
            Back to Admin
          </Link>
        </div>

        <h1 className="text-2xl font-bold mb-2">Rebuild Channel Schedules</h1>
        <p className="text-sm text-gray-300 mb-6">
          This will scan your channel buckets (<code>channel1</code>–<code>channel29</code>, <code>freedom-school</code> for channel 30),
          compute start times from midnight UTC, and rewrite the <code>programs</code> table.
        </p>

        <Button
          onClick={runScheduler}
          disabled={loading}
          className="inline-flex items-center gap-2 bg-red-600 hover:bg-red-700"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          {loading ? "Rebuilding Schedule…" : "Run Scheduler"}
        </Button>

        {result && (
          <div className="mt-6 rounded-md border border-slate-700 bg-slate-900/70 px-4 py-3 text-sm">
            {result}
          </div>
        )}
      </div>
    </div>
  );
}
