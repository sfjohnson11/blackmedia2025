'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';

type ResumeItem = {
  key: string;          // full localStorage key
  baseUrl: string;      // media base URL used for resume
  seconds: number;      // saved position
  title?: string | null;
  channelId?: number | null;
};

function parseChannelIdFromUrl(u: string): number | null {
  // try /channel{N}/something.mp4
  const m1 = u.match(/channel(\d+)\b/i);
  if (m1) return parseInt(m1[1], 10);
  // try .../channels/{N}/...
  const m2 = u.match(/\/channels\/(\d+)\b/i);
  if (m2) return parseInt(m2[1], 10);
  return null;
}

export default function ContinueAdminPage() {
  const router = useRouter();
  const [items, setItems] = useState<ResumeItem[]>([]);
  const [ready, setReady] = useState(false);

  // read localStorage resume entries created by the Watch page
  useEffect(() => {
    try {
      const found: ResumeItem[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)!;
        if (!key.startsWith('btv:resume:')) continue;

        const secondsRaw = localStorage.getItem(key) ?? '0';
        const seconds = Math.max(0, parseFloat(secondsRaw) || 0);

        const baseUrl = key.replace('btv:resume:', '');

        // look for optional metadata (if present)
        let title: string | null = null;
        let channelId: number | null = null;
        try {
          const metaRaw = localStorage.getItem(`btv:resume-meta:${baseUrl}`);
          if (metaRaw) {
            const meta = JSON.parse(metaRaw);
            if (typeof meta?.title === 'string') title = meta.title;
            if (typeof meta?.channel_id === 'number') channelId = meta.channel_id;
          }
        } catch {
          /* ignore bad meta JSON */
        }

        if (channelId == null) channelId = parseChannelIdFromUrl(baseUrl);

        found.push({ key, baseUrl, seconds, title, channelId });
      }

      // no timestamps in LS; just sort by key for stability
      found.sort((a, b) => a.baseUrl.localeCompare(b.baseUrl));
      setItems(found);
    } catch {
      setItems([]);
    } finally {
      setReady(true);
    }
  }, []);

  const clearOne = (k: string, baseUrl: string) => {
    try {
      localStorage.removeItem(k);
      localStorage.removeItem(`btv:resume-meta:${baseUrl}`);
    } catch {}
    setItems((prev) => prev.filter((x) => x.key !== k));
  };

  const clearAll = () => {
    try {
      items.forEach(({ key, baseUrl }) => {
        localStorage.removeItem(key);
        localStorage.removeItem(`btv:resume-meta:${baseUrl}`);
      });
    } catch {}
    setItems([]);
  };

  const fmt = (s: number) => {
    const hh = Math.floor(s / 3600);
    const mm = Math.floor((s % 3600) / 60);
    const ss = Math.floor(s % 60);
    return hh > 0 ? `${hh}:${String(mm).padStart(2,'0')}:${String(ss).padStart(2,'0')}` : `${mm}:${String(ss).padStart(2,'0')}`;
    };

  return (
    <main className="max-w-4xl mx-auto p-6 text-white">
      <h1 className="text-2xl font-bold mb-4">▶️ Continue Watching (Admin)</h1>

      {!ready ? (
        <p className="text-slate-300">Loading…</p>
      ) : items.length === 0 ? (
        <p className="text-slate-400">No saved positions found on this device.</p>
      ) : (
        <>
          <div className="flex justify-end mb-3">
            <Button className="bg-red-600 hover:bg-red-500" onClick={clearAll}>
              Clear All
            </Button>
          </div>
          <ul className="space-y-3">
            {items.map((it) => (
              <li key={it.key} className="rounded border border-slate-700 bg-slate-900 p-4">
                <div className="text-sm text-slate-400 mb-1">
                  {it.title ? <span className="font-medium text-white">{it.title}</span> : <span>{it.baseUrl}</span>}
                </div>
                <div className="text-slate-300 mb-3">Saved at {fmt(it.seconds)}</div>
                <div className="flex gap-2">
                  {typeof it.channelId === 'number' ? (
                    <Button
                      className="bg-yellow-500 text-black hover:bg-yellow-400"
                      onClick={() => router.push(`/watch/${it.channelId}`)}
                    >
                      Resume on Channel {it.channelId}
                    </Button>
                  ) : (
                    <Button
                      className="bg-slate-700"
                      onClick={() => alert('Could not infer channel from URL. Open the last channel manually, playback should resume.')}
                    >
                      Open Player
                    </Button>
                  )}
                  <Button variant="outline" onClick={() => clearOne(it.key, it.baseUrl)}>
                    Remove
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}

      <div className="mt-6">
        <Button className="bg-gray-700" onClick={() => router.push('/admin')}>
          ← Back to Admin
        </Button>
      </div>
    </main>
  );
}
