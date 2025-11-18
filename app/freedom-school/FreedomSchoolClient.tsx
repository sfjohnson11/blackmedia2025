// app/freedom-school/FreedomSchoolClient.tsx
"use client";

import { useMemo, useRef, useState } from "react";
import {
  PlayCircle,
  FileText,
  Headphones,
  Download,
  Video as VideoIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";

export type FSAsset = {
  name: string;
  publicUrl: string;
  type: "video" | "audio" | "pdf" | "other";
};

// Re-export so page.tsx can reuse it
export function classifyType(name: string): FSAsset["type"] {
  const lower = name.toLowerCase();
  if (lower.endsWith(".mp4") || lower.endsWith(".mov") || lower.endsWith(".m4v")) {
    return "video";
  }
  if (lower.endsWith(".mp3") || lower.endsWith(".wav") || lower.endsWith(".m4a")) {
    return "audio";
  }
  if (lower.endsWith(".pdf")) {
    return "pdf";
  }
  return "other";
}

function makeTitleFromFilename(name: string): string {
  let base = name.replace(/\.[^/.]+$/, ""); // strip extension
  base = base.replace(/_+/g, " ").trim();
  return base || name;
}

type Props = {
  initialAssets: FSAsset[];
  storageError?: string | null;
};

export default function FreedomSchoolClient({
  initialAssets,
  storageError,
}: Props) {
  const playerRef = useRef<HTMLDivElement | null>(null);

  const playableAssets = useMemo(
    () => initialAssets.filter((a) => a.type === "video" || a.type === "audio"),
    [initialAssets]
  );

  const downloadAssets = useMemo(
    () => initialAssets.filter((a) => a.type === "pdf" || a.type === "other"),
    [initialAssets]
  );

  const [selectedMedia, setSelectedMedia] = useState<FSAsset | null>(() => {
    return (
      playableAssets.find(
        (a) => a.type === "video" || a.type === "audio"
      ) ?? null
    );
  });

  const featuredMedia = useMemo<FSAsset | null>(() => {
    return playableAssets[0] ?? null;
  }, [playableAssets]);

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

  // Loop only through the playable list
  function handleMediaEnded() {
    if (!selectedMedia || playableAssets.length === 0) return;

    const currentIndex = playableAssets.findIndex(
      (v) => v.name === selectedMedia.name
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
              Plays the first video or audio in the Freedom School library and
              loops through all playable files.
            </p>
          </div>
        </header>

        {/* Optional error from storage */}
        {storageError && (
          <div className="mx-auto max-w-4xl rounded-md border border-red-500/60 bg-red-950/50 px-3 py-2 text-xs text-red-100">
            {storageError}
          </div>
        )}

        {/* Player + Info */}
        <section
          id="player"
          ref={playerRef}
          className="grid gap-6 md:grid-cols-[minmax(0,2fr),minmax(0,1.2fr)] items-start"
        >
          <div className="rounded-lg border border-slate-700 bg-slate-900/70 p-3">
            <h2 className="text-sm font-semibold mb-2 text-slate-100">
              Now Playing (Video / Audio Playlist)
            </h2>

            {playableAssets.length === 0 ? (
              <div className="py-10 text-center text-sm text-slate-400">
                No MP4 video or audio lessons have been published to Freedom School
                yet.
              </div>
            ) : !selectedMedia ? (
              <div className="py-10 text-center text-sm text-slate-400">
                Select a lesson from the playlist on the right.
              </div>
            ) : (
              <div className="space-y-3">
                {selectedMedia.type === "video" ? (
                  <video
                    key={selectedMedia.publicUrl}
                    controls
                    className="w-full rounded-md border border-slate-700 bg-black"
                    onEnded={handleMediaEnded}
                  >
                    <source src={selectedMedia.publicUrl} />
                    Your browser does not support the video tag.
                  </video>
                ) : (
                  <audio
                    key={selectedMedia.publicUrl}
                    controls
                    className="w-full rounded-md border border-slate-700 bg-slate-950"
                    onEnded={handleMediaEnded}
                  >
                    <source src={selectedMedia.publicUrl} />
                    Your browser does not support the audio tag.
                  </audio>
                )}

                <div className="mt-2">
                  <h3 className="text-sm font-semibold text-slate-100">
                    {makeTitleFromFilename(selectedMedia.name)}
                  </h3>
                  <p className="mt-1 text-xs text-slate-400">
                    Freedom School lesson. When this finishes, the next playable file
                    (video or audio) in the list will play automatically.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Sidebar: Playlist + How it works */}
          <aside className="space-y-3">
            <div className="rounded-lg border border-slate-700 bg-slate-900/70 p-3 text-xs text-slate-300">
              <h2 className="text-sm font-semibold mb-1 text-slate-100">
                How Freedom School Works
              </h2>
              <ul className="list-disc list-inside space-y-1">
                <li>Videos and audio files appear in the main playlist and loop.</li>
                <li>PDFs and other files appear below as downloadable resources.</li>
                <li>Click any item in the playlist to jump to that lesson.</li>
              </ul>
            </div>

            {/* Playable Playlist */}
            <div className="rounded-lg border border-slate-700 bg-slate-900/70 p-3">
              <h3 className="text-sm font-semibold mb-2 text-slate-100">
                Playlist (Video + Audio)
              </h3>
              {playableAssets.length === 0 ? (
                <p className="text-xs text-slate-400">
                  No playable media found in the freedom-school library.
                </p>
              ) : (
                <div className="space-y-2 max-h-80 overflow-y-auto">
                  {playableAssets.map((asset) => {
                    const isActive =
                      selectedMedia && selectedMedia.name === asset.name;
                    const title = makeTitleFromFilename(asset.name);
                    const Icon =
                      asset.type === "audio" ? Headphones : VideoIcon;

                    return (
                      <button
                        key={asset.name}
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
                            {title}
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

        {/* Downloadable Resources (PDF + other only) */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-100">
              Downloads & Study Resources (PDF / Other)
            </h2>
            <p className="text-xs text-slate-400">
              {downloadAssets.length} downloadable item
              {downloadAssets.length === 1 ? "" : "s"} from the Freedom School library.
            </p>
          </div>

          {downloadAssets.length === 0 ? (
            <p className="text-xs text-slate-400">
              No additional handouts uploaded yet.
            </p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
              {downloadAssets.map((asset) => {
                const title = makeTitleFromFilename(asset.name);

                return (
                  <a
                    key={asset.name}
                    href={asset.publicUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2 text-xs 
                               text-slate-100 hover:bg-slate-800/70 flex flex-col gap-1"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold line-clamp-2">
                        {title}
                      </span>
                      {asset.type === "pdf" ? (
                        <FileText className="h-4 w-4 text-amber-400 flex-shrink-0" />
                      ) : (
                        <Download className="h-4 w-4 text-slate-300 flex-shrink-0" />
                      )}
                    </div>
                    <span className="text-[11px] text-slate-400 capitalize">
                      {asset.type} — click to open/download
                    </span>
                  </a>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
