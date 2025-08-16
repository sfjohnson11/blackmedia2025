// components/continue-watching.tsx
"use client";

import { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";
import Link from "next/link";
import Image from "next/image";
import { Play } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { getWatchProgress } from "@/lib/supabase";

interface WatchHistoryItem {
  channelId: number;
  timestamp: number;
  progress: number;
  duration: number;
}

type ChannelRow = Record<string, any>;

function toPublicUrl(raw?: string | null) {
  if (!raw) return null;
  // already a URL (http/https/data:)
  if (/^(https?:)?\/\//i.test(raw) || raw.startsWith("data:")) return raw;
  // treat as storage path
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!base) return null;
  const clean = raw.replace(/^\/+/, "");
  return `${base}/storage/v1/object/public/${clean}`;
}

function pickImage(row: ChannelRow): string | null {
  const candidate =
    row.image_url ??
    row.image ??
    row.img_url ??
    row.image_path ??
    row.logo_url ??
    row.thumbnail_url ??
    null;

  return toPublicUrl(candidate);
}

export function ContinueWatching() {
  const [history, setHistory] = useState<WatchHistoryItem[]>([]);
  const [channels, setChannels] = useState<Record<number, ChannelRow>>({});
  const [loading, setLoading] = useState(true);

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const supabase = createClient(supabaseUrl, supabaseAnon);

  useEffect(() => {
    const loadHistory = async () => {
      try {
        // 1) read local watch history
        const watchHistory = getWatchProgress() as Record<
          string,
          { timestamp: number; progress: number; duration: number }
        >;

        if (!watchHistory || Object.keys(watchHistory).length === 0) {
          setLoading(false);
          return;
        }

        // 2) normalize + sort
        const historyArray: WatchHistoryItem[] = Object.entries(watchHistory)
          .map(([channelId, data]) => ({
            channelId: Number.parseInt(channelId, 10),
            timestamp: Number(data.timestamp || 0),
            progress: Number(data.progress || 0),
            duration: Number(data.duration || 0),
          }))
          .filter((h) => Number.isFinite(h.channelId) && h.channelId > 0)
          .sort((a, b) => b.timestamp - a.timestamp);

        const recentHistory = historyArray.slice(0, 10);
        setHistory(recentHistory);

        // 3) fetch channel details (defensive: select("*") to avoid column errors)
        const uniqueIds = Array.from(new Set(recentHistory.map((i) => i.channelId)));
        if (uniqueIds.length === 0) {
          setLoading(false);
          return;
        }

        const { data, error } = await supabase
          .from("channels")
          .select("*")
          .in("id", uniqueIds);

        if (error) {
          // Don’t crash the UI; just log and continue with names missing
          console.error("Supabase channels query failed:", error);
        }

        const rec: Record<number, ChannelRow> = {};
        (data || []).forEach((row: ChannelRow) => {
          // assume numeric ids; if UUIDs, adapt by keeping as string keys
          const id: number = typeof row.id === "number" ? row.id : Number(row.id);
          if (Number.isFinite(id)) rec[id] = row;
        });

        setChannels(rec);
      } catch (e) {
        console.error("Error loading watch history:", e);
      } finally {
        setLoading(false);
      }
    };

    loadHistory();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading || history.length === 0) return null;

  return (
    <div className="mb-12">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl md:text-2xl font-bold text-white">Continue Watching</h2>
        <Link href="/history" className="text-sm text-gray-400 hover:text-white">
          See all
        </Link>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
        {history.map((item) => {
          const channel = channels[item.channelId];
          if (!channel) return null;

          const img = pickImage(channel) || "/placeholder.svg?height=180&width=320&query=channel";
          const pct =
            item.duration > 0 ? Math.max(0, Math.min(100, (item.progress / item.duration) * 100)) : 0;

          const name =
            channel.name ??
            channel.title ??
            `Channel ${String(channel.id ?? item.channelId)}`;

          return (
            <div key={item.channelId} className="group relative">
              <div className="aspect-video relative rounded-md overflow-hidden">
                <Image
                  src={img}
                  alt={name}
                  fill
                  className="object-cover"
                  // If your images are external and not in next.config.js images.domains, you can uncomment:
                  // unoptimized
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
                <Link
                  href={`/watch/${item.channelId}`}
                  className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <div className="bg-red-600 rounded-full p-3">
                    <Play className="h-6 w-6 text-white" fill="white" />
                  </div>
                </Link>
              </div>

              <Progress value={pct} className="h-1 bg-gray-700 mt-1" />

              <h3 className="text-sm font-medium text-white mt-2 truncate">{name}</h3>
            </div>
          );
        })}
      </div>
    </div>
  );
}
