// app/freedom-school/FreedomSchoolClient.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import { PlayCircle, Loader2, FileText, Headphones } from "lucide-react";
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
  const [selected, setSelected] = useState<FSAsset | null>(null);
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

          // Auto-select a default featured: first video, else first anything
          const firstVideo = mapped.find((a) => a.type === "video");
          const fallback = mapped[0] ?? null;
          setSelected(firstVideo || fallback || null);
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

  const featured = useMemo<FSAsset | null>(() => {
    if (assets.length === 0) return null;
    const firstVideo = assets.find((a) => a.type === "video");
    return firstVideo || assets[0];
  }, [assets]);

  function handlePlayFeatured() {
    if (!featured) return;
    setSelected(featured);

    // Scroll the player into view so it feels "alive"
    if (playerRef.current) {
      playerRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  function handleSelect(asset: FSAsset) {
    setSelected(asset);
    if (playerRef.current) {
      playerRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#040814] via-[#050b1a] to-black text-white pb-10">
      <div className="mx-auto max-w-6xl px-4 pt-8 space-y-8">
        {/* Header */}
        <header className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Freedom School</h1>
            <p className="mt-1 text-sm text-slate-300">
              Our virtual classroom is always open — lessons, lectures, and study resources on demand.
            </p>
          </div>

          <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center">
            <Button
              onClick={handlePlayFeatured}
              disabled={!featured}
              className="bg-emerald-600 hover:bg-emerald-700 text-sm inline-flex items-center gap-2"
            >
              <PlayCircle className="h-4 w-4" />
              Play Featured Lesson
            </Button>
            <p className="text-[11px] text-slate-400">
              Plays the first video in the Freedom School library.
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
              Now Playing
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
            ) : !selected ? (
              <div className="py-10 text-center text-sm text-slate-400">
                No media is currently selected.
              </div>
            ) : (
              <div className="space-y-3">
                {selected.type === "video" && (
                  <video
                    key={selected.publicUrl}
                    controls
                    className="w-full rounded-md border border-slate-700 bg-black"
                  >
                    <source src={selected.publicUrl} />
                    Your browser does not support the video tag.
                  </video>
                )}

                {selected.type === "audio" && (
                  <div className="rounded-md border border-slate-700 bg-slate-950 p-4">
                    <div className="flex items-center gap-2 text-slate-100 mb-3 text-sm">
                      <Headphones className="h-4 w-4 text-emerald-400" />
                      <span>Audio Lesson</span>
                    </div>
                    <audio controls className="w-full">
                      <source src={selected.publicUrl} />
                      Your browser does not support the audio element.
                    </audio>
                  </div>
                )}

                {selected.type === "pdf" && (
                  <div className="rounded-md border border-slate-700 bg-slate-950 p-4 space-y-3">
                    <div className="flex items-center gap-2 text-slate-100 text-sm">
                      <FileText className="h-4 w-4 text-amber-400" />
                      <span>PDF Lesson / Handout</span>
                    </div>
                    <a
                      href={selected.publicUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center text-xs text-emerald-300 hover:text-emerald-200 underline"
                    >
                      Open PDF in new tab
                    </a>
                    <div className="h-72 rounded border border-slate-800 bg-black/40 flex items-center justify-center text-xs text-slate-400">
                      PDF preview not embedded. Click &ldquo;Open PDF in new tab&rdquo; above to view.
                    </div>
                  </div>
                )}

                {selected.type === "other" && (
                  <div className="rounded-md border border-slate-700 bg-slate-950 p-4 text-xs text-slate-300">
                    This file type is not directly previewable here. You can open it in a new tab:
                    <div className="mt-2">
                      <a
                        href={selected.publicUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-emerald-300 hover:text-emerald-200 underline"
                      >
                        Open file
                      </a>
                    </div>
                  </div>
                )}

                <div className="mt-2">
                  <h3 className="text-sm font-semibold text-slate-100">
                    {makeTitleFromFilename(selected.name)}
                  </h3>
                  <p className="mt-1 text-xs text-slate-400">
                    From the Freedom School media library ({selected.type.toUpperCase()}).
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Sidebar: Quick Info */}
          <aside className="space-y-3">
            <div className="rounded-lg border border-slate-700 bg-slate-900/70 p-3 text-xs text-slate-300">
              <h2 className="text-sm font-semibold mb-1 text-slate-100">
                How Freedom School Works
              </h2>
              <ul className="list-disc list-inside space-y-1">
                <li>Lessons, lectures, and study handouts are stored in the Freedom School bucket.</li>
                <li>Click any item in the library below to play or open it.</li>
                <li>
                  Use <span className="font-semibold">Play Featured Lesson</span> for a quick-start
                  video.
                </li>
              </ul>
            </div>
          </aside>
        </section>

        {/* Library List */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-100">
              Freedom School Library
            </h2>
            <p className="text-xs text-slate-400">
              {assets.length} item{assets.length === 1 ? "" : "s"} loaded from the freedom-school bucket.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
            {loading ? (
              <div className="col-span-full flex items-center justify-center py-10 text-slate-300 text-sm">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Loading Freedom School library…
              </div>
            ) : assets.length === 0 ? (
              <div className="col-span-full text-xs text-slate-400">
                No media has been published to Freedom School yet.
              </div>
            ) : (
              assets.map((asset) => {
                const isActive = selected && selected.name === asset.name;
                const title = makeTitleFromFilename(asset.name);

                return (
                  <button
                    key={asset.name}
                    type="button"
                    onClick={() => handleSelect(asset)}
                    className={`text-left rounded-lg border px-3 py-2 text-xs transition 
                      ${
                        isActive
                          ? "border-emerald-500 bg-emerald-900/40"
                          : "border-slate-700 bg-slate-900/70 hover:bg-slate-800/70"
                      }`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="font-semibold text-slate-100 line-clamp-2">
                        {title}
                      </span>
                      {asset.type === "video" && (
                        <PlayCircle className="h-4 w-4 text-emerald-400 flex-shrink-0" />
                      )}
                      {asset.type === "audio" && (
                        <Headphones className="h-4 w-4 text-sky-400 flex-shrink-0" />
                      )}
                      {asset.type === "pdf" && (
                        <FileText className="h-4 w-4 text-amber-400 flex-shrink-0" />
                      )}
                    </div>
                    <div className="text-[11px] text-slate-400 capitalize">
                      {asset.type} resource
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
