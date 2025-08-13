// app/admin/schedule/page.tsx
"use client";

import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { format } from "date-fns";

type Program = {
  id: number;
  channel_id: string;
  title: string;
  mp4_url: string;    // filename/key only
  start_time: string; // UTC ISO
  duration: number;   // seconds
};

type Channel = {
  id: string;
  name: string;
  bucket: string;         // ✅ per-channel storage bucket
  program_table: string;  // ✅ per-channel program table
};

const COLS = "id, channel_id, title, mp4_url, start_time, duration";

// Convert <input type="datetime-local"> to UTC ISO
const toUtcIso = (local: string) => {
  if (!local) return "";
  const d = new Date(local);
  return isNaN(d.getTime()) ? "" : d.toISOString();
};

// Resolve a public URL for preview from a specific bucket + key
const publicUrl = (bucket: string, key: string) => {
  const cleanKey = (key || "").replace(/^\/+/, "");
  const { data } = supabase.storage.from(bucket).getPublicUrl(cleanKey);
  return data?.publicUrl || "";
};

export default function ProgramScheduler() {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [selectedChannelId, setSelectedChannelId] = useState<string>("");
  const [programs, setPrograms] = useState<Program[]>([]);

  const [newProgram, setNewProgram] = useState({
    title: "",
    mp4_url: "",            // filename only (e.g., "folder/video.mp4")
    start_time_local: "",   // from datetime-local
    duration_seconds: 1800, // seconds
  });

  const selectedChannel = useMemo(
    () => channels.find(c => c.id === selectedChannelId) || null,
    [channels, selectedChannelId]
  );

  // Load channels (must include bucket + program_table)
  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("channels")
        .select("id, name, bucket, program_table")
        .order("name", { ascending: true });

      if (error) {
        console.error("Channels load error:", error);
        return;
      }
      if (data?.length) {
        setChannels(data as Channel[]);
        setSelectedChannelId(prev => prev || data[0].id);
      }
    })();
  }, []);

  // Load programs for the selected channel from its program_table
  useEffect(() => {
    if (!selectedChannel) return;
    (async () => {
      const table = selectedChannel.program_table;
      const { data, error } = await supabase
        .from(table)
        .select(COLS)
        .eq("channel_id", selectedChannel.id)
        .order("start_time", { ascending: true });

      if (error) {
        console.error("Programs load error:", error);
        setPrograms([]);
      } else {
        setPrograms((data || []) as Program[]);
      }
    })();
  }, [selectedChannel]);

  const handleInput = (field: keyof typeof newProgram, value: string | number) =>
    setNewProgram(prev => ({ ...prev, [field]: value as any }));

  const refreshPrograms = async () => {
    if (!selectedChannel) return;
    const table = selectedChannel.program_table;
    const { data, error } = await supabase
      .from(table)
      .select(COLS)
      .eq("channel_id", selectedChannel.id)
      .order("start_time", { ascending: true });

    if (error) {
      console.error("Refresh error:", error);
      return;
    }
    setPrograms((data || []) as Program[]);
  };

  const handleAddProgram = async () => {
    if (!selectedChannel) return alert("Pick a channel first.");
    if (!newProgram.title.trim() || !newProgram.mp4_url.trim() || !newProgram.start_time_local)
      return alert("Title, MP4 filename, and Start Time are required.");

    const startUtc = toUtcIso(newProgram.start_time_local); // ✅ store UTC
    if (!startUtc) return alert("Invalid start time.");

    const table = selectedChannel.program_table;
    const payload = {
      title: newProgram.title.trim(),
      mp4_url: newProgram.mp4_url.trim(),                 // ✅ keep filename in DB
      start_time: startUtc,                               // ✅ UTC
      duration: Number(newProgram.duration_seconds) || 1800, // ✅ seconds
      channel_id: selectedChannel.id,
    };

    const { data, error } = await supabase.from(table).insert([payload]).select().single();
    if (error) return alert(`Failed to add program: ${error.message}`);

    setPrograms(prev =>
      [...prev, data as Program].sort(
        (a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
      )
    );
    setNewProgram({ title: "", mp4_url: "", start_time_local: "", duration_seconds: 1800 });
  };

  const channelPrograms = useMemo(
    () => programs.filter(p => p.channel_id === selectedChannelId),
    [programs, selectedChannelId]
  );

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Program Scheduler</h1>

      {channels.length === 0 ? (
        <div className="text-slate-400">No channels found. Add channels first.</div>
      ) : (
        <Tabs value={selectedChannelId} onValueChange={setSelectedChannelId}>
          <TabsList className="overflow-x-auto whitespace-nowrap mb-6">
            {channels.map(ch => (
              <TabsTrigger key={ch.id} value={ch.id}>
                {ch.name}
              </TabsTrigger>
            ))}
          </TabsList>

          {channels.map(ch => (
            <TabsContent key={ch.id} value={ch.id}>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h2 className="font-bold">Add New Program</h2>
                    <Button variant="outline" onClick={refreshPrograms}>Refresh</Button>
                  </div>
                  <Input
                    placeholder="Title"
                    value={newProgram.title}
                    onChange={(e) => handleInput("title", e.target.value)}
                    className="mb-2"
                  />
                  <Input
                    placeholder="MP4 filename (e.g., folder/video.mp4)"
                    value={newProgram.mp4_url}
                    onChange={(e) => handleInput("mp4_url", e.target.value)}
                    className="mb-2"
                  />
                  <Input
                    type="datetime-local"
                    placeholder="Start Time (local → stored as UTC)"
                    value={newProgram.start_time_local}
                    onChange={(e) => handleInput("start_time_local", e.target.value)}
                    className="mb-2"
                  />
                  <Input
                    type="number"
                    placeholder="Duration (seconds)"
                    value={newProgram.duration_seconds}
                    onChange={(e) => handleInput("duration_seconds", parseInt(e.target.value || "0", 10))}
                    className="mb-4"
                  />
                  <Button onClick={handleAddProgram} className="w-full">
                    Add Program
                  </Button>
                </Card>

                <Card className="p-4">
                  <h2 className="font-bold mb-2">Upcoming Programs</h2>
                  <div className="space-y-2 max-h-[420px] overflow-y-auto">
                    {channelPrograms.length === 0 ? (
                      <div className="text-slate-400">No programs scheduled for this channel.</div>
                    ) : (
                      channelPrograms.map((program) => (
                        <div key={program.id} className="p-2 border-b border-gray-700">
                          <div className="font-semibold">{program.title}</div>
                          <div className="text-sm text-gray-400">
                            {format(new Date(program.start_time), "PPP p")} · {Math.round((program.duration || 0) / 60)}m
                          </div>
                          {program.mp4_url && selectedChannel && (
                            <video
                              // Resolve filename from THIS channel's bucket for preview
                              src={publicUrl(selectedChannel.bucket, program.mp4_url)}
                              controls
                              preload="metadata"
                              className="mt-2 w-full max-w-md rounded"
                              muted
                            />
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </Card>
              </div>
            </TabsContent>
          ))}
        </Tabs>
      )}
    </div>
  );
}
