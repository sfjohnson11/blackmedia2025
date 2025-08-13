// app/admin/schedule/page.tsx
"use client";

import { useState, useEffect } from "react";
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
  mp4_url: string;
  start_time: string;
  duration: number;
};

type Channel = { id: string; name: string };

const PROGRAM_SELECT = "id, channel_id, title, mp4_url, start_time, duration";

export default function ProgramScheduler() {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [selectedChannel, setSelectedChannel] = useState<string>("");

  const [newProgram, setNewProgram] = useState({
    title: "",
    mp4_url: "",
    start_time: "",
    duration: 1800,
  });

  useEffect(() => {
    (async () => {
      const { data: channelsData, error: chErr } = await supabase
        .from("channels")
        .select("id, name")
        .order("name", { ascending: true });

      if (!chErr && channelsData?.length) {
        setChannels(channelsData);
        setSelectedChannel((prev) => prev || channelsData[0].id);
      }

      const { data: programsData, error: prErr } = await supabase
        .from("programs")
        .select(PROGRAM_SELECT)
        .order("start_time", { ascending: true });

      if (!prErr && programsData) setPrograms(programsData as Program[]);
    })();
  }, []);

  const handleAddProgram = async () => {
    if (!selectedChannel) return alert("Pick a channel first.");
    if (!newProgram.title.trim() || !newProgram.mp4_url.trim() || !newProgram.start_time)
      return alert("Title, MP4 URL, and Start Time are required.");

    const payload = {
      title: newProgram.title.trim(),
      mp4_url: newProgram.mp4_url.trim(),
      start_time: newProgram.start_time,
      duration: Number(newProgram.duration) || 1800,
      channel_id: selectedChannel,
    };

    const { data, error } = await supabase.from("programs").insert([payload]).select().single();
    if (error) return alert(`Failed to add program: ${error.message}`);

    setPrograms((prev) => [...prev, data as Program].sort((a, b) => a.start_time.localeCompare(b.start_time)));
    setNewProgram({ title: "", mp4_url: "", start_time: "", duration: 1800 });
  };

  const handleInput = (field: keyof typeof newProgram, value: string | number) =>
    setNewProgram((prev) => ({ ...prev, [field]: value as any }));

  const channelPrograms = programs.filter((p) => p.channel_id === selectedChannel);

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Program Scheduler</h1>

      {channels.length === 0 ? (
        <div className="text-slate-400">No channels found. Add channels first.</div>
      ) : (
        <Tabs value={selectedChannel} onValueChange={setSelectedChannel}>
          <TabsList className="overflow-x-auto whitespace-nowrap mb-6">
            {channels.map((ch) => (
              <TabsTrigger key={ch.id} value={ch.id}>
                {ch.name}
              </TabsTrigger>
            ))}
          </TabsList>

          {channels.map((ch) => (
            <TabsContent key={ch.id} value={ch.id}>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card className="p-4">
                  <h2 className="font-bold mb-2">Add New Program</h2>
                  <Input
                    placeholder="Title"
                    value={newProgram.title}
                    onChange={(e) => handleInput("title", e.target.value)}
                    className="mb-2"
                  />
                  <Input
                    placeholder="MP4 URL (https://.../file.mp4)"
                    value={newProgram.mp4_url}
                    onChange={(e) => handleInput("mp4_url", e.target.value)}
                    className="mb-2"
                  />
                  <Input
                    type="datetime-local"
                    placeholder="Start Time"
                    value={newProgram.start_time}
                    onChange={(e) => handleInput("start_time", e.target.value)}
                    className="mb-2"
                  />
                  <Input
                    type="number"
                    placeholder="Duration (seconds)"
                    value={newProgram.duration}
                    onChange={(e) => handleInput("duration", parseInt(e.target.value || "0", 10))}
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
                            {format(new Date(program.start_time), "PPP p")} · {program.duration}s
                          </div>
                          {program.mp4_url ? (
                            <video
                              src={program.mp4_url}
                              controls
                              preload="metadata"
                              className="mt-2 w-full max-w-md rounded"
                            />
                          ) : (
                            <div className="text-xs text-red-400 mt-2">No MP4 URL set.</div>
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
