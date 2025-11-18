// app/freedom-school/FreedomSchoolClient.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import { PlayCircle, Loader2, FileText, Headphones, Download } from "lucide-react";
import { Button } from "@/components/ui/button";

type FSAsset = {
  name: string;
  publicUrl: string;
  type: "video" | "audio" | "pdf" | "other";
};

function classifyType(name: string): FSAsset["type"] {
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

export default function FreedomSchoolClient() {
  const supabase = createClientComponentClient();

  const [assets, setAssets] = useState<FSAsset[]>([]);
  const [selectedVideo, setSelectedVideo] = useState<FSAsset | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const playerRef = useRef<HTMLDivElement | null>(null);

  // Load assets from the freedom-school bucket
  useEffect(() => {
    let cancelled = false;

    async function loadAssets() {
      setLoading(true);
      setErr(null);
      try {
        const { data, error } = await supabase.storage
          .from("freedom-school")
          .list("", { limit: 1000 });

        if (error) {
          console.error("Error listing freedom-school bucket", error);
          if (!cancelled) setErr(error.message);
          return;
        }

        const files = (data || []).filter((f) => !f.name.startsWith("."));

        const mapped: FSAsset[] = files.map((f) => {
          const { data: urlData } = supabase.storage
            .from("freedom-school")
            .getPublicUrl(f.name);

          return {
            name: f.name,
            publicUrl: urlData.publicUrl,
            type: classifyType(f.name),
          };
        });

        if (!cancelled) {
          setAssets(mapped);

          // Default featured: first video if available
          const firstVideo = mapped.find((a) => a.type === "video") ?? null;
          setSelectedVideo(firstVideo);
        }
      } catch (e: any) {
        console.error("Unexpected error loading Freedom School assets", e);
        if (!cancelled) {
          setErr(e?.message || "Unexpected error loading Freedom School assets.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadAssets();

    return () => {
      cancelled = true;
    };
  }, [supabase]);

  // Separate into video playlist + downloadables
  const videoAssets = useMemo(
    () => assets.filter((a) => a.type === "video"),
    [assets]
  );

  const downloadAssets = useMemo(
    () => assets.filter((a) => a.type !== "video"),
    [assets]
  );

  const featuredVideo = useMemo<FSAsset | null>(() => {
    return videoAssets[0] ?? null;
  }, [videoAssets]);

  function scrollPlayerIntoView() {
    if (playerRef.current) {
      playerRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  function handlePlayFeatured() {
    if (!featuredVideo) return;
    setSelectedVideo(featuredVideo);
    scrollPlayerIntoView();
  }

  function handleSelectVideo(asset: FSAsset) {
    setSelectedVideo(asset);
    scrollPlayerIntoView();
  }

  // Loop through only the video playlist when one ends
  function handleVideoEnded() {
    if (!selectedVideo || videoAssets.length === 0) return;

    const currentIndex = videoAssets.findIndex(
      (v) => v.name === selectedVideo.name
    );
    if (currentIndex === -1) return;

    const nextIndex = (currentIndex + 1) % videoAssets.length;
    setSelectedVideo(videoAssets[nextIndex]);
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
              disabled={!featuredVideo}
              className="bg-emerald-600 hover:bg-emerald-700 text-sm inline-flex items-center gap-2"
            >
              <PlayCircle className="h-4 w-4" />
              Play Featured Lesson
            </Button>
            <p className="text-[11px] text-slate-400">
              Plays the first MP4 in the Freedom School library and loops through all MP4s.
            </p>
          </div>
        </header>

        {/* Player + Info */}
        <section
          ref={playerRef}
          className="grid gap-6 md:grid-cols-[minmax(0,2fr),minmax(0,1.2fr)] items-start"
        >
          <div className="rounded-lg border border-slate-700 bg-slate-900/70 p-3">
            <h2 className="text-sm font-semibold mb-2 text-slate-100">
              Now Playing (Video Playlist)
            </h2>

            {loading ? (
              <div className="flex items-center justify-center py-16 text-slate-300 text-sm">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Loading Freedom School media…
              </div>
            ) : err ? (
              <div className="rounded-md border border-red-500/60 bg-red-950/50 px-3 py-2 text-xs text-red-100">
                {err}
              </div>
            ) : videoAssets.length === 0 ? (
              <div className="py-10 text-center text-sm text-slate-400">
                No MP4 videos have been published to Freedom School yet.
              </div>
            ) : !selectedVideo ? (
              <div className="py-10 text-center text-sm text-slate-400">
                Select a lesson from the playlist on the right.
              </div>
            ) : (
              <div className="space-y-3">
                <video
                  key={selectedVideo.publicUrl}
                  controls
                  className="w-full rounded-md border border-slate-700 bg-black"
                  onEnded={handleVideoEnded}
                >
                  <source src={selectedVideo.publicUrl} />
                  Your browser does not support the video tag.
                </video>

                <div className="mt-2">
                  <h3 className="text-sm font-semibold text-slate-100">
                    {makeTitleFromFilename(selectedVideo.name)}
                  </h3>
                  <p className="mt-1 text-xs text-slate-400">
                    Freedom School video lesson. When this finishes, the next MP4
                    in the list will play automatically.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Sidebar: Video playlist + How it works */}
          <aside className="space-y-3">
            <div className="rounded-lg border border-slate-700 bg-slate-900/70 p-3 text-xs text-slate-300">
              <h2 className="text-sm font-semibold mb-1 text-slate-100">
                How Freedom School Works
              </h2>
              <ul className="list-disc list-inside space-y-1">
                <li>MP4s appear in the video playlist and will auto-loop.</li>
                <li>PDFs and other files appear below as downloadable resources.</li>
                <li>Click any video in the playlist to jump to that lesson.</li>
              </ul>
            </div>

            {/* Video Playlist */}
            <div className="rounded-lg border border-slate-700 bg-slate-900/70 p-3">
              <h3 className="text-sm font-semibold mb-2 text-slate-100">
                Video Playlist (MP4 Only)
              </h3>
              {videoAssets.length === 0 ? (
                <p className="text-xs text-slate-400">
                  No MP4 videos found in the freedom-school bucket.
                </p>
              ) : (
                <div className="space-y-2 max-h-80 overflow-y-auto">
                  {videoAssets.map((asset) => {
                    const isActive =
                      selectedVideo && selectedVideo.name === asset.name;
                    const title = makeTitleFromFilename(asset.name);

                    return (
                      <button
                        key={asset.name}
                        type="button"
                        onClick={() => handleSelectVideo(asset)}
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
                          <PlayCircle className="h-3 w-3 text-emerald-400 flex-shrink-0" />
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </aside>
        </section>

        {/* Downloadable Resources (non-video) */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-100">
              Downloads & Study Resources
            </h2>
            <p className="text-xs text-slate-400">
              {downloadAssets.length} downloadable item
              {downloadAssets.length === 1 ? "" : "s"} from the freedom-school bucket.
            </p>
          </div>

          {downloadAssets.length === 0 ? (
            <p className="text-xs text-slate-400">
              No additional handouts or audio files uploaded yet.
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
                      {asset.type === "pdf" && (
                        <FileText className="h-4 w-4 text-amber-400 flex-shrink-0" />
                      )}
                      {asset.type === "audio" && (
                        <Headphones className="h-4 w-4 text-sky-400 flex-shrink-0" />
                      )}
                      {asset.type === "other" && (
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
