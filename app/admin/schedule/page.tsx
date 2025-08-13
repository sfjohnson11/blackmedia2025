// File: app/admin/schedule/page.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { format } from 'date-fns';

type Program = {
  id: number;
  channel_id: string;
  title: string;
  mp4_url: string;
  start_time: string; // ISO string in DB
  duration: number;   // seconds
};

type Channel = { id: string; name: string };

export default function ProgramScheduler() {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [selectedChannel, setSelectedChannel] = useState<string>('');
  const [programs, setPrograms] = useState<Program[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [newProgram, setNewProgram] = useState<{
    title: string;
    mp4_url: string;
    start_time: string; // from <input type="datetime-local">
    duration: number;   // seconds
  }>({
    title: '',
    mp4_url: '',
    start_time: '',
    duration: 1800,
  });

  // Load channels + programs
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setErr(null);
      try {
        const [chRes, progRes] = await Promise.all([
          supabase.from('channels').select('id,name').order('name', { ascending: true }),
          supabase.from('programs').select('*').order('start_time', { ascending: true }),
        ]);

        if (cancelled) return;

        if (chRes.error) throw chRes.error;
        if (progRes.error) throw progRes.error;

        const ch = chRes.data ?? [];
        setChannels(ch);
        // Pick first channel once channels arrive
        if (ch.length && !selectedChannel) setSelectedChannel(ch[0].id);

        setPrograms((progRes.data as Program[]) || []);
      } catch (e: any) {
        setErr(e?.message || 'Failed to load schedule');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const channelPrograms = useMemo(
    () =>
      programs
        .filter((p) => p.channel_id === selectedChannel)
        .slice()
        .sort((a, b) => +new Date(a.start_time) - +new Date(b.start_time)),
    [programs, selectedChannel]
  );

  const computeNextStartLocalValue = () => {
    // Find the last program for the selected channel and return a local datetime string for the next slot
    const last = channelPrograms[channelPrograms.length - 1];
    const start = last ? new Date(last.start_time) : new Date();
    const next = new Date(start.getTime() + (last ? last.duration * 1000 : 0));
    // Round to next 30 minutes
    const rounded = new Date(Math.ceil(next.getTime() / (30 * 60 * 1000)) * (30 * 60 * 1000));
    // Convert to <input type="datetime-local"> format: YYYY-MM-DDTHH:mm
    const y = rounded.getFullYear();
    const m = String(rounded.getMonth() + 1).padStart(2, '0');
    const d = String(rounded.getDate()).padStart(2, '0');
    const hh = String(rounded.getHours()).padStart(2, '0');
    const mm = String(rounded.getMinutes()).padStart(2, '0');
    return `${y}-${m}-${d}T${hh}:${mm}`;
  };

  const handleInputChange = (field: keyof typeof newProgram, value: string | number) => {
    setNewProgram((prev) => ({ ...prev, [field]: value as any }));
  };

  const normalizeToISO = (localValue: string) => {
    // localValue is e.g. "2025-08-12T14:30"
    // Create a Date in local time, then toISOString for the DB (timestamptz friendly)
    const d = new Date(localValue);
    if (Number.isNaN(d.getTime())) return null;
    return d.toISOString();
  };

  const refetchProgramsForChannel = async (channelId: string) => {
    const { data, error } = await supabase
      .from('programs')
      .select('*')
      .eq('channel_id', channelId)
      .order('start_time', { ascending: true });
    if (!error) {
      setPrograms((prev) => {
        // Replace only that channel's slice to avoid reloading all
        const others = prev.filter((p) => p.channel_id !== channelId);
        return [...others, ...(data as Program[])];
      });
    }
  };

  const handleAddProgram = async () => {
    if (!selectedChannel) return;
    if (!newProgram.title.trim() || !newProgram.mp4_url.trim() || !newProgram.start_time) {
      setErr('Please fill Title, MP4 URL, and Start Time.');
      return;
    }

    const iso = normalizeToISO(newProgram.start_time);
    if (!iso) {
      setErr('Invalid start time.');
      return;
    }

    setSaving(true);
    setErr(null);
    try {
      const payload = {
        title: newProgram.title.trim(),
        mp4_url: newProgram.mp4_url.trim(),
        start_time: iso,
        duration: Number.isFinite(newProgram.duration) ? newProgram.duration : 1800,
        channel_id: selectedChannel,
      };

      // Insert and return the created row
      const { data, error } = await supabase
        .from('programs')
        .insert([payload])
        .select('*')
        .single();

      if (error) throw error;

      // Option 1: optimistic push using returned row:
      setPrograms((prev) => [...prev, data as Program]);

      // Option 2 (safer): refetch that channel
      // await refetchProgramsForChannel(selectedChannel);

      // Reset form but keep duration for convenience
      setNewProgram((prev) => ({
        title: '',
        mp4_url: '',
        start_time: '',
        duration: prev.duration,
      }));
    } catch (e: any) {
      setErr(e?.message || 'Failed to add program');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-6 text-white">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Program Scheduler</h1>
        {err && (
          <div className="ml-4 rounded border border-red-700 bg-red-900/30 px-3 py-1 text-sm text-red-200">
            {err}
          </div>
        )}
      </div>

      {loading ? (
        <div className="text-slate-300">Loading channels & programs…</div>
      ) : (
        <Tabs value={selectedChannel} onValueChange={setSelectedChannel} className="w-full">
          <TabsList className="mb-6 flex max-w-full overflow-x-auto whitespace-nowrap">
            {channels.map((c) => (
              <TabsTrigger key={c.id} value={c.id}>
                {c.name}
              </TabsTrigger>
            ))}
          </TabsList>

          {channels.map((channel) => (
            <TabsContent key={channel.id} value={channel.id} className="mt-0">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Add Program */}
                <Card className="p-4 bg-gray-900 border border-gray-800">
                  <h2 className="font-bold mb-3">Add New Program</h2>

                  <Input
                    placeholder="Title"
                    value={newProgram.title}
                    onChange={(e) => handleInputChange('title', e.target.value)}
                    className="mb-2"
                  />

                  <Input
                    placeholder="MP4 URL (filename.mp4)"
                    value={newProgram.mp4_url}
                    onChange={(e) => handleInputChange('mp4_url', e.target.value)}
                    className="mb-2"
                  />

                  <div className="flex gap-2">
                    <Input
                      type="datetime-local"
                      placeholder="Start Time"
                      value={newProgram.start_time}
                      onChange={(e) => handleInputChange('start_time', e.target.value)}
                      className="mb-2"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setNewProgram((p) => ({ ...p, start_time: computeNextStartLocalValue() }))}
                    >
                      Next Slot
                    </Button>
                  </div>

                  <Input
                    type="number"
                    min={60}
                    step={60}
                    placeholder="Duration (seconds)"
                    value={newProgram.duration}
                    onChange={(e) => handleInputChange('duration', parseInt(e.target.value || '0', 10))}
                    className="mb-4"
                  />

                  <Button onClick={handleAddProgram} disabled={saving || !selectedChannel} className="w-full">
                    {saving ? 'Saving…' : 'Add Program'}
                  </Button>
                </Card>

                {/* Upcoming list */}
                <Card className="p-4 bg-gray-900 border border-gray-800">
                  <h2 className="font-bold mb-3">Upcoming Programs</h2>
                  {channelPrograms.length === 0 ? (
                    <div className="text-slate-400">No programs yet for {channel.name}.</div>
                  ) : (
                    <div className="space-y-2 max-h-[460px] overflow-y-auto pr-1">
                      {channelPrograms.map((p) => {
                        const start = new Date(p.start_time);
                        const end = new Date(start.getTime() + p.duration * 1000);
                        return (
                          <div key={p.id} className="p-2 border-b border-gray-800">
                            <div className="font-semibold">{p.title}</div>
                            <div className="text-sm text-gray-400">
                              {format(start, 'PPP p')} → {format(end, 'p')} • {Math.round(p.duration / 60)} min
                            </div>
                            <div className="text-xs text-gray-500 truncate">{p.mp4_url}</div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </Card>
              </div>
            </TabsContent>
          ))}
        </Tabs>
      )}
    </div>
  );
}
