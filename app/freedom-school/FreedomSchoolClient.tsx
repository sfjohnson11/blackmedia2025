// app/freedom-school/FreedomSchoolClient.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import {
  PlayCircle,
  Headphones,
  Video as VideoIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";

type ProgramRow = {
  id: number;
  channel_id: number;
  title: string | null;
  mp4_url: string | null;
  duration: number | null;
  start_time: string | null;
};

type MediaType = "video" | "audio" | "other";

type FSAsset = {
  id: number;
  title: string;
  url: string;
  type: MediaType;
};

function classifyTypeFromUrl(url: string): MediaType {
  const lower = url.toLowerCase();
  if (
    lower.endsWith(".mp4") ||
    lower.endsWith(".mov") ||
    lower.endsWith(".m4v") ||
    lower.endsWith(".webm")
  ) {
    return "video";
  }
  if (
    lower.endsWith(".mp3") ||
    lower.endsWith(".wav") ||
    lower.endsWith(".m4a") ||
    lower.endsWith(".aac")
  ) {
    return "audio";
  }
  // (If you later store PDFs or other links in mp4_url, they'll fall to "other")
  return "other";
}

function filenameFromUrl(url: string): string {
  try {
    const u = new URL(url);
    const last = u.pathname.split("/").pop() || url;
    return last;
  } catch {
    return url;
  }
}

function titleFromRow(row: ProgramRow): string {
  if (row.title && row.title.trim().length > 0) return row.title.trim();

  if (row.mp4_url) {
    // fallback: derive a readable title from the URL filename
    let base = filenameFromUrl(row.mp4_url);
    base = base.replace(/\.[^/.]+$/, ""); // strip extension
    base = base.replace(/[_-]+/g, " ").trim();
    return base || "Untitled Lesson";
  }

  return "Untitled Lesson";
}

export default function FreedomSchoolClient() {
  const supabase = createClientComponentClient();
  const playerRef = useRef<HTMLDivElement | null>(null);

  const [assets, setAssets] = useState<FSAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const playableAssets = useMemo(
    () => assets.filter((a) => a.type === "video" || a.type === "audio"),
    [assets]
  );

  const [selectedMedia, setSelectedMedia] = useState<FSAsset | null>(null);

  const featuredMedia = useMemo<FSAsset | null>(() => {
    return playableAssets[0] ?? null;
  }, [playableAssets]);

  // 🔗 Load from programs table for channel 30 (Freedom School)
  useEffect(() => {
    let cancelled = false;

    async function loadPrograms() {
      setLoading(true);
      setError(null);

      try {
        const { data, error } = await supabase
          .from("programs")
          .select("id, channel_id, title, mp4_url, duration, start_time")
          .eq("channel_id", 30) // Channel 30 = Freedom School
          .order("start_time", { ascending: true });

        if (error) {
          console.error("Error loading Freedom School programs", error);
          if (!cancelled) {
            setError("Freedom School content is temporarily unavailable.");
          }
          return;
        }

        if (!data || data.length === 0) {
          if (!cancelled) {
            setAssets([]);
            setSelectedMedia(null);
          }
          return;
        }

        const mapped: FSAsset[] = (data as ProgramRow[])
          .filter((row) => row.mp4_url && row.mp4_url.trim().length > 0)
          .map((row) => {
            const url = row.mp4_url!.trim();
            const type = classifyTypeFromUrl(url);

            return {
              id: row.id,
              title: titleFromRow(row),
              url,
              type,
            } as FSAsset;
          });

        if (!cancelled) {
          setAssets(mapped);
          setSelectedMedia(mapped.find((m) => m.type === "video" || m.type === "audio") ?? null);
        }
      } catch (e: any) {
        console.error("Unexpected Freedom School load error", e);
        if (!cancelled) {
          setError("Could not load Freedom School content.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadPrograms();
    return () => {
      cancelled = true;
    };
  }, [supabase]);

  function scrollPlayerIntoView() {
    if (playerRef.current) {
      playerRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  function handlePlayFeatured() {
    if (!featuredMedia) return;
    setSelectedMedia(featuredMedia);
    scrollPlayerIntoView();
  }

  function handleSelectMedia(asset: FSAsset) {
    setSelectedMedia(asset);
    scrollPlayerIntoView();
  }

  // 🔁 Loop through only playable (video + audio) assets
  function handleMediaEnded() {
    if (!selectedMedia || playableAssets.length === 0) return;

    const currentIndex = playableAssets.findIndex(
      (v) => v.id === selectedMedia.id
    );
    if (currentIndex === -1) return;

    const nextIndex = (currentIndex + 1) % playableAssets.length;
    setSelectedMedia(playableAssets[nextIndex]);
    scrollPlayerIntoView();
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#040814] via-[#050b1a] to-black text-white pb-10">
      <div className="mx-auto max-w-6xl px-4 pt-8 space-y-8">
        {/* Header */}
        <header className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Freedom School</h1>
            <p className="mt-1 text-sm text-slate-300">
              Our virtual classroom is always open — lessons, lectures, and study
              resources on demand.
            </p>
          </div>

          <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center">
            <Button
              onClick={handlePlayFeatured}
              disabled={!featuredMedia}
              className="bg-emerald-600 hover:bg-emerald-700 text-sm inline-flex items-center gap-2"
            >
              <PlayCircle className="h-4 w-4" />
              Play Featured Lesson
            </Button>
            <p className="text-[11px] text-slate-400">
              Uses the first video/audio in the Freedom School programs list and
              loops through all lessons.
            </p>
          </div>
        </header>

        {/* Error / loading */}
        {error && (
          <div className="mx-auto max-w-4xl rounded-md border border-red-500/60 bg-red-950/50 px-3 py-2 text-xs text-red-100">
            {error}
          </div>
        )}

        {/* Player + playlist */}
        <section
          id="player"
          ref={playerRef}
          className="grid gap-6 md:grid-cols-[minmax(0,2fr),minmax(0,1.2fr)] items-start"
        >
          <div className="rounded-lg border border-slate-700 bg-slate-900/70 p-3">
            <h2 className="text-sm font-semibold mb-2 text-slate-100">
              Now Playing (Video / Audio)
            </h2>

            {loading ? (
              <div className="py-10 text-center text-sm text-slate-400">
                Loading Freedom School programs…
              </div>
            ) : playableAssets.length === 0 ? (
              <div className="py-10 text-center text-sm text-slate-400">
                No video or audio lessons are scheduled for channel 30 (Freedom
                School) yet.
              </div>
            ) : !selectedMedia ? (
              <div className="py-10 text-center text-sm text-slate-400">
                Select a lesson from the playlist on the right.
              </div>
            ) : (
              <div className="space-y-3">
                {selectedMedia.type === "audio" ? (
                  <audio
                    key={selectedMedia.url}
                    controls
                    className="w-full rounded-md border border-slate-700 bg-slate-950"
                    onEnded={handleMediaEnded}
                  >
                    <source src={selectedMedia.url} />
                    Your browser does not support the audio tag.
                  </audio>
                ) : (
                  <video
                    key={selectedMedia.url}
                    controls
                    className="w-full rounded-md border border-slate-700 bg-black"
                    onEnded={handleMediaEnded}
                  >
                    <source src={selectedMedia.url} />
                    Your browser does not support the video tag.
                  </video>
                )}

                <div className="mt-2">
                  <h3 className="text-sm font-semibold text-slate-100">
                    {selectedMedia.title}
                  </h3>
                  <p className="mt-1 text-xs text-slate-400">
                    Freedom School lesson. When this finishes, the next playable
                    program for channel 30 will start automatically.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Playlist */}
          <aside className="space-y-3">
            <div className="rounded-lg border border-slate-700 bg-slate-900/70 p-3 text-xs text-slate-300">
              <h2 className="text-sm font-semibold mb-1 text-slate-100">
                How This Page Works
              </h2>
              <ul className="list-disc list-inside space-y-1">
                <li>Loads all programs from the <code>programs</code> table where <code>channel_id = 30</code>.</li>
                <li>Uses the saved <code>title</code> from your Program Title Editor (no more filename titles).</li>
                <li>Plays and loops only video/audio URLs stored in <code>mp4_url</code>.</li>
              </ul>
            </div>

            <div className="rounded-lg border border-slate-700 bg-slate-900/70 p-3">
              <h3 className="text-sm font-semibold mb-2 text-slate-100">
                Playlist (Channel 30 Programs)
              </h3>
              {loading ? (
                <p className="text-xs text-slate-400">Loading playlist…</p>
              ) : playableAssets.length === 0 ? (
                <p className="text-xs text-slate-400">
                  No playable programs found for channel 30 yet.
                </p>
              ) : (
                <div className="space-y-2 max-h-80 overflow-y-auto">
                  {playableAssets.map((asset) => {
                    const isActive =
                      selectedMedia && selectedMedia.id === asset.id;
                    const Icon =
                      asset.type === "audio" ? Headphones : VideoIcon;

                    return (
                      <button
                        key={asset.id}
                        type="button"
                        onClick={() => handleSelectMedia(asset)}
                        className={`w-full text-left rounded-md border px-2 py-1.5 text-[11px] transition 
                          ${
                            isActive
                              ? "border-emerald-500 bg-emerald-900/40"
                              : "border-slate-700 bg-slate-900/70 hover:bg-slate-800/70"
                          }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-semibold text-slate-100 line-clamp-2">
                            {asset.title}
                          </span>
                          <div className="flex items-center gap-1 flex-shrink-0">
                            <Icon className="h-3 w-3 text-sky-300" />
                            <PlayCircle className="h-3 w-3 text-emerald-400" />
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </aside>
        </section>

        {/* (Optional) Downloads section:
            If later you decide to store PDFs/other links in a separate column/table,
            we can wire those here for download only.
        */}
      </div>
    </div>
  );
}
