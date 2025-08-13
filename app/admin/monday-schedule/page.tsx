"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Calendar, Clock, RefreshCw, CheckCircle, XCircle, AlertTriangle } from "lucide-react";

export default function MondaySchedulePage() {
  const getNextMonday = () => {
    const today = new Date();
    const day = today.getDay(); // 0=Sun
    const daysUntilNextMonday = day === 0 ? 1 : 8 - day;
    const nextMonday = new Date(today);
    nextMonday.setDate(today.getDate() + daysUntilNextMonday);
    nextMonday.setHours(0, 0, 0, 0);
    return nextMonday.toISOString().split("T")[0]; // YYYY-MM-DD
  };

  const [targetDate, setTargetDate] = useState<string>(getNextMonday());
  const [isLoading, setIsLoading] = useState(false);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);
  const [previewData, setPreviewData] = useState<any[] | null>(null);
  const [affectedPrograms, setAffectedPrograms] = useState<number | null>(null);
  const [channels, setChannels] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedChannelId, setSelectedChannelId] = useState<string>("all");

  // Load channels for optional per-channel reschedule
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase.from("channels").select("id, name").order("id", { ascending: true });
      if (!cancelled) setChannels((data ?? []).map((c: any) => ({ id: String(c.id), name: c.name })));
    })();
    return () => { cancelled = true; };
  }, []);

  // Preview (exact new times from SQL, UTC)
  const previewScheduleChanges = async () => {
    if (!targetDate) {
      setResult({ success: false, message: "Please select a target Monday date" });
      return;
    }
    setIsPreviewLoading(true);
    setResult(null);
    setPreviewData(null);

    try {
      const { count } = await supabase.from("programs").select("*", { count: "exact", head: true });
      setAffectedPrograms(count || 0);

      const channelIdForPreview =
        selectedChannelId === "all" && channels.length ? channels[0].id : selectedChannelId;

      if (!channelIdForPreview || channelIdForPreview === "all") {
        setPreviewData([]);
        setResult({ success: false, message: "Select a channel to preview, or pick a specific channel." });
        setIsPreviewLoading(false);
        return;
      }

      const res = await fetch("/api/admin/monday-schedule/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channelId: channelIdForPreview, date: targetDate }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || "Failed to preview");

      const rows = json.rows as Array<any>;
      const grouped = [{
        channel_id: channelIdForPreview,
        channel_name: channels.find(c => c.id === channelIdForPreview)?.name ?? channelIdForPreview,
        programs: rows.slice(0, 10).map(r => ({
          id: r.id,
          title: r.title,
          original_start_time: r.old_start_time,
          new_start_time: r.new_start_time,
        })),
      }];

      setPreviewData(grouped);
      if (grouped[0].programs.length === 0) {
        setResult({ success: false, message: "No programs found for that channel." });
      }
    } catch (err: any) {
      console.error(err);
      setResult({ success: false, message: err.message || "Preview failed" });
    } finally {
      setIsPreviewLoading(false);
    }
  };

  // Apply (one or all channels) — UTC Monday 00:00
  const applyScheduleChanges = async () => {
    if (!targetDate) {
      setResult({ success: false, message: "Please select a target Monday date" });
      return;
    }
    setIsLoading(true);
    setResult(null);

    try {
      const res = await fetch("/api/admin/monday-schedule/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: targetDate,
          channelId: selectedChannelId === "all" ? undefined : selectedChannelId,
        }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || "Apply failed");

      setResult({
        success: true,
        message:
          selectedChannelId === "all"
            ? `Updated ${json.updated} program(s) across all channels from Monday ${targetDate} 00:00 UTC.`
            : `Updated ${json.updated} program(s) for channel ${selectedChannelId} from Monday ${targetDate} 00:00 UTC.`,
      });
    } catch (err: any) {
      console.error(err);
      setResult({ success: false, message: err.message || "Apply failed" });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="container mx-auto py-8 max-w-4xl">
      <div className="bg-gray-800 p-6 rounded-lg w-full">
        <div className="flex items-center mb-6">
          <Link href="/admin" className="mr-4">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Admin
            </Button>
          </Link>
          <h1 className="text-2xl font-bold">Monday Schedule Helper</h1>
        </div>

        <div className="mb-6">
          <p className="mb-4">
            This tool reschedules programs to begin at <strong>Monday 00:00 UTC</strong>, chaining each item by its{" "}
            <code>duration</code> in the current order per channel.
          </p>

          <div className="bg-gray-900 p-4 rounded mb-6">
            <h3 className="font-semibold mb-4 flex items-center">
              <Calendar className="h-5 w-5 mr-2 text-red-500" />
              Select Date & Channel
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="targetDate" className="block text-sm font-medium mb-1">
                  Monday (UTC) Date:
                </label>
                <input
                  id="targetDate"
                  type="date"
                  value={targetDate}
                  onChange={(e) => setTargetDate(e.target.value)}
                  className="w-full p-2 bg-gray-800 border border-gray-700 rounded-md"
                />
                <p className="text-xs text-gray-400 mt-1">
                  Programs will begin at <strong>00:00 UTC</strong> for the selected Monday.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Channel:</label>
                <select
                  value={selectedChannelId}
                  onChange={(e) => setSelectedChannelId(e.target.value)}
                  className="w-full p-2 bg-gray-800 border border-gray-700 rounded-md"
                >
                  <option value="all">All Channels</option>
                  {channels.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.id} — {c.name}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-400 mt-1">
                  Preview requires a specific channel; Apply can target one or all channels.
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-4">
              <Button
                onClick={previewScheduleChanges}
                disabled={isPreviewLoading || selectedChannelId === "all"}
                className="bg-blue-600 hover:bg-blue-700"
                title={selectedChannelId === "all" ? "Pick a channel to preview" : ""}
              >
                {isPreviewLoading ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Previewing...
                  </>
                ) : (
                  "Preview Changes"
                )}
              </Button>

              <Button onClick={applyScheduleChanges} disabled={isLoading} className="bg-red-600 hover:bg-red-700">
                {isLoading ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Updating Schedule...
                  </>
                ) : (
                  "Apply Schedule Changes"
                )}
              </Button>
            </div>
          </div>

          {previewData && previewData.length > 0 && (
            <div className="bg-gray-900 p-4 rounded mb-6">
              <h3 className="font-semibold mb-4">Preview of Schedule Changes</h3>

              <div className="mb-4 bg-yellow-900/30 p-3 rounded-md flex items-start">
                <AlertTriangle className="h-5 w-5 text-yellow-500 mr-2 mt-0.5 flex-shrink-0" />
                <p className="text-sm">
                  This will update approximately <strong>{affectedPrograms ?? "?"}</strong> programs.
                  Below is an exact preview for the selected channel.
                </p>
              </div>

              <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2">
                {previewData.map((channel, index) => (
                  <div key={index} className="border border-gray-700 rounded-md p-3">
                    <h4 className="font-medium mb-2">
                      Channel {channel.channel_id}: {channel.channel_name}
                    </h4>

                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-700">
                          <th className="text-left py-2">Program</th>
                          <th className="text-left py-2">Original Start</th>
                          <th className="text-left py-2">New Start (UTC)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {channel.programs.map((program: any, pIndex: number) => (
                          <tr key={pIndex} className="border-b border-gray-800">
                            <td className="py-2">{program.title}</td>
                            <td className="py-2">{new Date(program.original_start_time).toLocaleString()}</td>
                            <td className="py-2 text-green-400">{new Date(program.new_start_time).toLocaleString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ))}
              </div>
            </div>
          )}

          {result && (
            <div
              className={`mt-6 p-4 rounded-md ${
                result.success ? "bg-green-900/30 text-green-400" : "bg-red-900/30 text-red-400"
              }`}
            >
              <div className="flex items-center gap-2">
                {result.success ? <CheckCircle className="h-5 w-5" /> : <XCircle className="h-5 w-5" />}
                <p>{result.message}</p>
              </div>
              {result.success && (
                <div className="mt-4 text-center">
                  <Link href="/admin">
                    <Button className="bg-green-600 hover:bg-green-700">Return to Admin Dashboard</Button>
                  </Link>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
