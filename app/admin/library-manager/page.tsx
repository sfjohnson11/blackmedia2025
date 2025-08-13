// app/admin/library-manager/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, ArrowLeft, Trash2, Pencil, Check, X } from "lucide-react";
import { format } from "date-fns";

type Channel = { id: string; name: string };
type Program = {
  id: number;
  channel_id: string;
  title: string;
  mp4_url: string;
  start_time: string; // timestamptz/string in DB
  duration: number;
};

export default function LibraryManagerPage() {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [selectedChannelId, setSelectedChannelId] = useState<string>("");
  const [programs, setPrograms] = useState<Program[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  // New/Editing program form state
  const [title, setTitle] = useState("");
  const [mp4Url, setMp4Url] = useState("");
  const [startTime, setStartTime] = useState(""); // datetime-local string
  const [duration, setDuration] = useState<number>(1800);

  const [editingId, setEditingId] = useState<number | null>(null);

  const selectedChannelName = useMemo(
    () => channels.find(c => c.id === selectedChannelId)?.name || "",
    [channels, selectedChannelId]
  );

  useEffect(() => {
    (async () => {
      setLoading(true);
      setErr(null);
      try {
        const { data: ch, error: chErr } = await supabase
          .from("channels")
          .select("id, name")
          .order("name", { ascending: true });
        if (chErr) throw chErr;
        setChannels(ch || []);
        if (!selectedChannelId && ch && ch.length) setSelectedChannelId(ch[0].id);
      } catch (e: any) {
        setErr(e?.message || "Failed to load channels.");
      } finally {
        setLoading(false);
      }
    })();
  }, []); // load channels once

  // Load programs when channel changes
  useEffect(() => {
    if (!selectedChannelId) return;
    (async () => {
      setLoading(true);
      setErr(null);
      try {
        const { data: pr, error: prErr } = await supabase
          .from("programs")
          .select("id, channel_id, title, mp4_url, start_time, duration")
          .eq("channel_id", selectedChannelId)
          .order("start_time", { ascending: true });
        if (prErr) throw prErr;
        setPrograms((pr || []) as Program[]);
      } catch (e: any) {
        setErr(e?.message || "Failed to load programs.");
      } finally {
        setLoading(false);
      }
    })();
  }, [selectedChannelId]);

  const resetForm = () => {
    setTitle("");
    setMp4Url("");
    setStartTime("");
    setDuration(1800);
    setEditingId(null);
    setErr(null);
    setMsg(null);
  };

  const startEdit = (p: Program) => {
    setEditingId(p.id);
    setTitle(p.title || "");
    setMp4Url(p.mp4_url || "");
    // Convert DB ISO/timestamp into datetime-local value (YYYY-MM-DDTHH:mm)
    try {
      const dt = new Date(p.start_time);
      const local = new Date(dt.getTime() - dt.getTimezoneOffset() * 60000)
        .toISOString()
        .slice(0, 16);
      setStartTime(local);
    } catch {
      setStartTime("");
    }
    setDuration(p.duration || 1800);
    setMsg(null);
    setErr(null);
  };

  const cancelEdit = () => resetForm();

  const saveProgram = async () => {
    if (!selectedChannelId) return setErr("Pick a channel first.");
    if (!title.trim() || !mp4Url.trim() || !startTime) {
      return setErr("Title, MP4 URL, and Start Time are required.");
    }
    setSaving(true);
    setErr(null);
    setMsg(null);
    try {
      // For consistency with your existing code: store the datetime-local string directly.
      const payload = {
        title: title.trim(),
        mp4_url: mp4Url.trim(),
        start_time: startTime, // your app already stores string/timestamptz; do not transform
        duration: Number(duration) || 1800,
        channel_id: selectedChannelId,
      };

      if (editingId) {
        const { error } = await supabase.from("programs").update(payload).eq("id", editingId);
        if (error) throw error;
        setMsg("Program updated.");
      } else {
        const { error } = await supabase.from("programs").insert([payload]);
        if (error) throw error;
        setMsg("Program added.");
      }

      // Refresh list
      const { data: pr, error: prErr } = await supabase
        .from("programs")
        .select("id, channel_id, title, mp4_url, start_time, duration")
        .eq("channel_id", selectedChannelId)
        .order("start_time", { ascending: true });
      if (prErr) throw prErr;
      setPrograms((pr || []) as Program[]);
      resetForm();
    } catch (e: any) {
      setErr(e?.message || "Save failed.");
    } finally {
      setSaving(false);
    }
  };

  const deleteProgram = async (id: number) => {
    if (!confirm("Delete this program?")) return;
    setSaving(true);
    setErr(null);
    setMsg(null);
    try {
      const { error } = await supabase.from("programs").delete().eq("id", id);
      if (error) throw error;
      setPrograms(prev => prev.filter(p => p.id !== id));
      setMsg("Program deleted.");
    } catch (e: any) {
      setErr(e?.message || "Delete failed.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Link href="/admin">
            <Button variant="outline" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <h1 className="text-2xl font-bold">Program Library Manager</h1>
        </div>

        <div className="min-w-[240px]">
          <Label className="text-sm">Channel</Label>
          <Select value={selectedChannelId} onValueChange={setSelectedChannelId}>
            <SelectTrigger>
              <SelectValue placeholder="Pick a channel" />
            </SelectTrigger>
            <SelectContent>
              {channels.map(c => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {err && (
        <div className="mb-4 rounded border border-red-500 bg-red-900/30 p-3 text-red-200">
          {err}
        </div>
      )}
      {msg && (
        <div className="mb-4 rounded border border-green-600 bg-green-900/30 p-3 text-green-200">
          {msg}
        </div>
      )}

      {/* Form */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>{editingId ? "Edit Program" : "Add New Program"}</CardTitle>
          <CardDescription>
            {selectedChannelName ? `Channel: ${selectedChannelName}` : "Pick a channel to add programs."}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label>Title</Label>
            <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Program title" />
          </div>
          <div>
            <Label>MP4 URL</Label>
            <Input
              value={mp4Url}
              onChange={e => setMp4Url(e.target.value)}
              placeholder="https://…/video.mp4"
            />
          </div>
          <div>
            <Label>Start Time</Label>
            <Input
              type="datetime-local"
              value={startTime}
              onChange={e => setStartTime(e.target.value)}
            />
          </div>
          <div>
            <Label>Duration (seconds)</Label>
            <Input
              type="number"
              value={duration}
              onChange={e => setDuration(parseInt(e.target.value || "0", 10))}
              placeholder="1800"
            />
          </div>
          <div className="md:col-span-2">
            <Label>Notes (optional)</Label>
            <Textarea placeholder="Optional notes for admins…" />
          </div>
        </CardContent>
        <CardFooter className="flex gap-2 justify-end">
          {editingId ? (
            <>
              <Button variant="outline" onClick={cancelEdit}>
                <X className="h-4 w-4 mr-2" /> Cancel
              </Button>
              <Button onClick={saveProgram} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Check className="h-4 w-4 mr-2" />}
                Save Changes
              </Button>
            </>
          ) : (
            <Button onClick={saveProgram} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Add Program
            </Button>
          )}
        </CardFooter>
      </Card>

      {/* List */}
      <Card>
        <CardHeader>
          <CardTitle>Programs</CardTitle>
          <CardDescription>
            {selectedChannelName ? `Scheduled for ${selectedChannelName}` : "Pick a channel"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center gap-2 text-slate-400">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading…
            </div>
          ) : programs.length === 0 ? (
            <div className="text-slate-400">No programs scheduled.</div>
          ) : (
            <div className="space-y-3">
              {programs.map(p => (
                <div key={p.id} className="rounded border border-slate-700 bg-slate-900 p-3">
                  <div className="flex items-center justify-between">
                    <div className="font-semibold">{p.title}</div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => startEdit(p)}>
                        <Pencil className="h-4 w-4 mr-1" /> Edit
                      </Button>
                      <Button size="sm" variant="destructive" onClick={() => deleteProgram(p.id)}>
                        <Trash2 className="h-4 w-4 mr-1" /> Delete
                      </Button>
                    </div>
                  </div>
                  <div className="text-sm text-slate-300 mt-1 break-all">
                    {p.mp4_url || <span className="text-red-400">No MP4 URL</span>}
                  </div>
                  <div className="text-xs text-slate-400 mt-1">
                    {(() => {
                      try {
                        return `${format(new Date(p.start_time), "PPP p")} • ${p.duration}s`;
                      } catch {
                        return `${p.start_time} • ${p.duration}s`;
                      }
                    })()}
                  </div>
                  {/* Inline test player (does not alter your main player) */}
                  {p.mp4_url && (
                    <video
                      className="mt-2 w-full max-w-xl rounded"
                      src={p.mp4_url}
                      controls
                      preload="metadata"
                    />
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
