// app/on-demand/[channelId]/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { supabase } from "@/lib/supabase";
import VideoPlayer from "@/components/video-player";
import {
  ArrowLeft,
  Film,
  Loader2,
  Tv2,
  AlertCircle,
  Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";

type Channel = {
  id: string;
  name: string | null;
  logo_url: string | null;
};

type FileItem = {
  name: string;
  url: string;
  displayTitle: string;
};

type ProgramTitleRow = {
  title: string | null;
  mp4_url: string | null;
};

function toNumericId(v: string | null | undefined): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : NaN;
}

// Map channel → bucket name (matches your auto-schedule buckets)
function getBucketForChannel(channelId: number): string | null {
  if (!Number.isFinite(channelId)) return null;
  if (channelId === 30) return "freedom-school";
  // Default: channel1..channel29, channel31, etc.
  return `channel${channelId}`;
}

function prettifyFileName(name: string): string {
  // Strip extension
  const withoutExt = name.replace(/\.[^.]+$/, "");
  // Replace underscores & dashes with spaces
  const withSpaces = withoutExt.replace(/[_\-]+/g, " ");
  // Collapse multiple spaces
  const collapsed = withSpaces.replace(/\s+/g, " ").trim();
  if (!collapsed) return name;

  // Title case-ish
  return collapsed
    .split(" ")
    .map((word) =>
      word.length === 0
        ? word
        : word[0].toUpperCase() + word.slice(1)
    )
    .join(" ");
}

export default function OnDemandChannelPage() {
  const params = useParams();
  const channelIdParam = params.channelId as string;

  const [channel, setChannel] = useState<Channel | null>(null);
  const [files, setFiles] = useState<FileItem[]>([]);
  const [selected, setSelected] = useState<FileItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const numericChannelId = useMemo(
    () => toNumericId(channelIdParam),
    [channelIdParam]
  );

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setErr(null);

      try {
        if (!channelIdParam) {
          throw new Error("No channel ID in URL.");
        }

        const chIdNum = numericChannelId;
        if (!Number.isFinite(chIdNum)) {
          throw new Error("Channel ID must be numeric (e.g. 1, 16, 30).");
        }

        // 1) Load channel details
        const { data: chData, error: chErr } = await supabase
          .from("channels")
          .select("id, name, logo_url")
          .eq("id", channelIdParam)
          .maybeSingle();

        if (chErr) throw chErr;
        if (!chData) {
          throw new Error("Channel not found.");
        }

        if (cancelled) return;
        setChannel(chData as Channel);

        // 2) Decide bucket
        const bucketName = getBucketForChannel(chIdNum);
        if (!bucketName) {
          throw new Error(
            `No storage bucket mapping found for channel ${chIdNum}.`
          );
        }

        // 3) List MP4 files in bucket
        const { data: storageFiles, error: storageErr } = await supabase.storage
          .from(bucketName)
          .list("", { limit: 1000 });

        if (storageErr) throw storageErr;

        const mp4s = (storageFiles || []).filter((f) =>
          f.name.toLowerCase().endsWith(".mp4")
        );

        // 4) Load program titles for this channel
        const { data: programRows, error: progErr } = await supabase
          .from("programs")
          .select("title, mp4_url")
          .eq("channel_id", chIdNum);

        if (progErr) throw progErr;

        const titleRows = (programRows || []) as ProgramTitleRow[];

        // 5) Build map from file name → title
        const titleByFile = new Map<string, string>();
        for (const row of titleRows) {
          if (!row.mp4_url) continue;
          try {
            // Extract the last path segment from the URL (file name)
            const urlStr = row.mp4_url;
            const parts = urlStr.split("/");
            const fileName = parts[parts.length - 1];
            if (fileName && row.title) {
              titleByFile.set(fileName, row.title);
            }
          } catch {
            // ignore parse issues
          }
        }

        // 6) Convert storage files into FileItem[] with public URLs
        const items: FileItem[] = [];
        for (const f of mp4s) {
          const { data: pub } = supabase.storage
            .from(bucketName)
            .getPublicUrl(f.name);

          const url = pub?.publicUrl;
          if (!url) continue;

          const titleFromPrograms = titleByFile.get(f.name);
          const displayTitle = titleFromPrograms || prettifyFileName(f.name);

          items.push({
            name: f.name,
            url,
            displayTitle,
          });
        }

        if (!cancelled) {
          // Sort alphabetically by displayTitle
          items.sort((a, b) =>
            a.displayTitle.localeCompare(b.displayTitle)
          );
          setFiles(items);
          setSelected(items[0] || null);
        }
      } catch (e: any) {
        if (!cancelled) {
          console.error("Error loading on-demand channel", e);
          setErr(e?.message || "Failed to load on-demand programs.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [channelIdParam, numericChannelId]);

  const channelLabel = channel
    ? channel.name || `Channel ${numericChannelId || channel.id}`
    : `Channel ${numericChannelId || channelIdParam}`;

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#040814] via-[#050b1a] to-black text-white pb-10">
      <div className="mx-auto max-w-6xl px-4 pt-8 space-y-6">
        {/* Header / breadcrumb */}
        <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <Link href="/on-demand">
              <Button
                variant="outline"
                className="border-slate-600 bg-slate-900 text-sm"
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                On-Demand
              </Button>
            </Link>
            <div className="flex items-center gap-3">
              <div className="relative h-10 w-10 rounded-md bg-black/40 overflow-hidden">
                {channel?.logo_url ? (
                  <Image
                    src={channel.logo_url}
                    alt={channelLabel}
                    fill
                    sizes="40px"
                    className="object-contain"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-[10px] text-slate-500">
                    No Logo
                  </div>
                )}
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight flex items-center gap-2">
                  <Tv2 className="h-6 w-6 text-amber-400" />
                  {channelLabel}
                </h1>
                <p className="mt-0.5 text-xs text-slate-300">
                  On-Demand programs from this channel&apos;s bucket.
                </p>
              </div>
            </div>
          </div>
        </header>

        {/* Error / loading */}
        {err && (
          <div className="flex items-start gap-2 rounded-md border border-red-500/60 bg-red-950/50 px-3 py-2 text-xs text-red-200">
            <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
            <p>{err}</p>
          </div>
        )}
        {loading && (
          <div className="py-10 text-center text-sm text-slate-300">
            <Loader2 className="mr-2 inline-block h-4 w-4 animate-spin" />{" "}
            Loading on-demand programs…
          </div>
        )}

        {/* Layout: player on top, list below on mobile; side-by-side on desktop */}
        {!loading && !err && (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1.3fr)]">
            {/* Player area */}
            <section className="rounded-xl border border-slate-700 bg-slate-900/80 p-3 sm:p-4 flex flex-col">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <Film className="h-4 w-4 text-amber-300" />
                  <span>Now Playing</span>
                </div>
                {selected && (
                  <div className="flex items-center gap-1 text-[11px] text-slate-400">
                    <Clock className="h-3 w-3" />
                    <span>{selected.name}</span>
                  </div>
                )}
              </div>

              <div className="aspect-video w-full bg-black rounded-lg overflow-hidden mb-3">
                {selected ? (
                  <VideoPlayer
                    src={selected.url}
                    programTitle={selected.displayTitle}
                    isStandby={false}
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-sm text-slate-400">
                    No program selected.
                  </div>
                )}
              </div>

              {selected && (
                <div>
                  <h2 className="text-base font-semibold mb-1">
                    {selected.displayTitle}
                  </h2>
                  <p className="text-xs text-slate-400 break-all">
                    File: {selected.name}
                  </p>
                </div>
              )}
            </section>

            {/* List of videos */}
            <section className="rounded-xl border border-slate-700 bg-slate-900/80 p-3 sm:p-4 flex flex-col">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-sm font-semibold text-slate-100">
                  On-Demand Programs
                </h2>
                <span className="text-[11px] text-slate-400">
                  Total: {files.length}
                </span>
              </div>

              <div className="max-h-[460px] overflow-y-auto rounded-lg border border-slate-800 bg-slate-950/60">
                {files.length === 0 ? (
                  <div className="py-8 text-center text-xs text-slate-400">
                    No MP4 files found in this channel&apos;s bucket.
                  </div>
                ) : (
                  <ul className="divide-y divide-slate-800 text-xs">
                    {files.map((file) => {
                      const isActive = selected && selected.name === file.name;
                      return (
                        <li
                          key={file.name}
                          className={`flex cursor-pointer items-center gap-3 px-3 py-2 hover:bg-slate-800/80 ${
                            isActive
                              ? "bg-slate-800/80 border-l-2 border-l-amber-400"
                              : ""
                          }`}
                          onClick={() => setSelected(file)}
                        >
                          <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md bg-slate-800">
                            <Film className="h-4 w-4 text-amber-300" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-slate-100">
                              {file.displayTitle}
                            </div>
                            <div className="truncate text-[11px] text-slate-400">
                              {file.name}
                            </div>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
