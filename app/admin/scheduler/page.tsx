"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ArrowLeft, ArrowUp, ArrowDown, Plus, Trash2, Save, Upload, Play } from "lucide-react";

type DraftRow = {
  id?: string;
  title: string;
  mp4_url: string;
  duration: number; // seconds
  poster_url?: string | null;
  sort_index: number;
};

function isoAtUtc(date: string, time = "00:00:00"): string {
  return `${date}T${time}Z`;
}

export default function SchedulerPage() {
  const [channels, setChannels] = useState<Array<{ id: string; name: string }>>([]);
  const [channelId, setChannelId] = useState<string>("");
  const [day, setDay] = useState<string>(() => new Date().toISOString().split("T")[0]); // today UTC
  const [rows, setRows] = useState<DraftRow[]>([]);
  const [baseTime, setBaseTime] = useState<string>("00:00:00"); // chain from this time at publish/save
  const [loading, setLoading] = useState(false);
  const [note, setNote] = useState<string>("");

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("channels").select("id,name").order("id", { ascending: true });
      const list = (data ?? []).map((c: any) => ({ id: String(c.id), name: c.name }));
      setChannels(list);
      if (list.length && !channelId) setChannelId(list[0].id);
    })();
  }, []); // eslint-disable-line

  const canAct = useMemo(() => !!channelId && !!day, [channelId, day]);

  function move(i: number, dir: -1 | 1) {
    setRows(prev => {
      const next = [...prev];
      const j = i + dir;
      if (j < 0 || j >= next.length) return prev;
      [next[i], next[j]] = [next[j], next[i]];
      return next.map((r, idx) => ({ ...r, sort_index: idx }));
    });
  }

  function remove(i: number) {
    setRows(prev => prev.filter((_, idx) => idx !== i).map((r, idx) => ({ ...r, sort_index: idx })));
  }

  function addEmpty() {
    setRows(prev => [
      ...prev,
      { title: "New Program", mp4_url: "", duration: 1800, poster_url: null, sort_index: prev.length }
    ]);
  }

  async function loadFromPublished() {
    if (!canAct) return;
    setLoading(true); setNote("");
    try {
      const res = await fetch("/api/admin/scheduler/load-from-published", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channelId, day })
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || "Failed to copy");
      await refreshDraft();
      setNote(`Copied ${json.copied} item(s) from published into draft.`);
    } catch (e: any) {
      setNote(`Error: ${e.message}`);
    } finally {
      setLoading(false);
    }
  }

  async function refreshDraft() {
    const qs = new URLSearchParams({ channelId, day }).toString();
    const res = await fetch(`/api/admin/scheduler/draft?${qs}`);
    const json = await res.json();
    if (!json.ok) throw new Error(json.error || "Failed to load draft");
    const list = (json.rows ?? []).map((r: any, idx: number) => ({
      id: r.id,
      title: r.title,
      mp4_url: r.mp4_url,
      duration: r.duration,
      poster_url: r.poster_url,
      sort_index: r.sort_index ?? idx
    })) as DraftRow[];
    list.sort((a, b) => (a.sort_index ?? 0) - (b.sort_index ?? 0));
    setRows(list);
  }

  async function saveDraft() {
    if (!canAct) return;
    setLoading(true); setNote("");
    try {
      const baseIso = isoAtUtc(day, baseTime);
      const res = await fetch("/api/admin/scheduler/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channelId, day, baseTimeUtc: baseIso, rows })
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || "Failed to save draft");
      await refreshDraft();
      setNote(`Saved ${json.count} draft item(s).`);
    } catch (e: any) {
      setNote(`Error: ${e.message}`);
    } finally {
      setLoading(false);
    }
  }

  async function publish() {
    if (!canAct) return;
    setLoading(true); setNote("");
    try {
      // ensure we’ve saved so start_time is chained from base
      await saveDraft();
      const res = await fetch("/api/admin/scheduler/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channelId, day })
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || "Failed to publish");
      setNote(`Published ${json.published} item(s) to live for ${channelId} on ${day}.`);
    } catch (e: any) {
      setNote(`Error: ${e.message}`);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (channelId && day) { refreshDraft().catch(() => {}); }
  }, [channelId, day]);

  return (
    <div className="container mx-auto py-8 max-w-5xl">
      <div className="bg-gray-800 p-6 rounded-lg">
        <div className="flex items-center mb-6">
          <Link href="/admin" className="mr-4">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Admin
            </Button>
          </Link>
          <h1 className="text-2xl font-bold">Day Scheduler (Draft → Publish)</h1>
        </div>

        <div className="grid gap-4 md:grid-cols-4 mb-4">
          <div>
            <label className="block text-sm mb-1">Channel</label>
            <select
              className="w-full p-2 bg-gray-900 border border-gray-700 rounded"
              value={channelId}
              onChange={e => setChannelId(e.target.value)}
            >
              {channels.map(c => (
                <option key={c.id} value={c.id}>
                  {c.id} — {c.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm mb-1">Day (UTC)</label>
            <input
              type="date"
              className="w-full p-2 bg-gray-900 border border-gray-700 rounded"
              value={day}
              onChange={e => setDay(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm mb-1">Base time (UTC)</label>
            <input
              type="time"
              step={1}
              className="w-full p-2 bg-gray-900 border border-gray-700 rounded"
              value={baseTime}
              onChange={e => setBaseTime(e.target.value)}
            />
            <p className="text-xs text-gray-400 mt-1">Start chaining from this time.</p>
          </div>
          <div className="flex items-end gap-2">
            <Button onClick={loadFromPublished} disabled={!canAct || loading} className="bg-sky-600 hover:bg-sky-700">
              <Upload className="h-4 w-4 mr-2" />
              Load from Published
            </Button>
            <Button onClick={addEmpty} disabled={loading} variant="outline">
              <Plus className="h-4 w-4 mr-2" />
              Add Row
            </Button>
          </div>
        </div>

        <div className="border border-gray-700 rounded overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-900">
              <tr>
                <th className="p-2 w-12">#</th>
                <th className="p-2">Title</th>
                <th className="p-2">MP4 Path</th>
                <th className="p-2 w-24">Duration (s)</th>
                <th className="p-2 w-28">Move</th>
                <th className="p-2 w-16">Del</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} className="border-t border-gray-700">
                  <td className="p-2 text-center">{i + 1}</td>
                  <td className="p-2">
                    <input
                      className="w-full bg-gray-900 border border-gray-700 rounded px-2 py-1"
                      value={r.title}
                      onChange={e =>
                        setRows(prev => prev.map((x, idx) => (idx === i ? { ...x, title: e.target.value } : x)))
                      }
                    />
                  </td>
                  <td className="p-2">
                    <input
                      className="w-full bg-gray-900 border border-gray-700 rounded px-2 py-1"
                      value={r.mp4_url}
                      onChange={e =>
                        setRows(prev => prev.map((x, idx) => (idx === i ? { ...x, mp4_url: e.target.value } : x)))
                      }
                    />
                  </td>
                  <td className="p-2">
                    <input
                      type="number"
                      min={1}
                      className="w-full bg-gray-900 border border-gray-700 rounded px-2 py-1"
                      value={r.duration}
                      onChange={e =>
                        setRows(prev =>
                          prev.map((x, idx) => (idx === i ? { ...x, duration: Number(e.target.value) || 0 } : x))
                        )
                      }
                    />
                  </td>
                  <td className="p-2">
                    <div className="flex gap-2 justify-center">
                      <Button size="icon" variant="outline" onClick={() => move(i, -1)} disabled={i === 0}>
                        <ArrowUp className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="outline" onClick={() => move(i, +1)} disabled={i === rows.length - 1}>
                        <ArrowDown className="h-4 w-4" />
                      </Button>
                    </div>
                  </td>
                  <td className="p-2 text-center">
                    <Button size="icon" variant="destructive" onClick={() => remove(i)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td className="p-6 text-center text-gray-400" colSpan={6}>
                    No draft rows yet — load from published or add rows.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-4 flex justify-end gap-2">
          <Button onClick={saveDraft} disabled={!canAct || loading} className="bg-amber-600 hover:bg-amber-700">
            <Save className="h-4 w-4 mr-2" />
            Save Draft (chain from base)
          </Button>
          <Button onClick={publish} disabled={!canAct || loading} className="bg-green-600 hover:bg-green-700">
            <Play className="h-4 w-4 mr-2" />
            Publish to Live
          </Button>
        </div>

        {!!note && <p className="mt-3 text-sm text-gray-300">{note}</p>}
      </div>
    </div>
  );
}
