"use client";

import { useEffect, useState } from "react";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";

type LibraryRow = {
  id: number;
  title: string | null;
  description: string | null;
  type: string | null;
  url: string | null;
  thumbnail: string | null;
  channel_id: number | null;
  channel_name: string | null;
  date_added?: string | null;
  file_size: string | null;
  duration: number | null;
  content: string | null;
};

type Lesson = {
  id: number;
  title: string;
  description: string | null;
  url: string;
  thumbnail: string | null;
  kind: "video" | "audio" | "pdf" | "other";
};

const FREEDOM_CHANNEL_ID = 30;

function detectKindFromRow(row: LibraryRow): Lesson["kind"] {
  if (row.type) {
    const t = row.type.toLowerCase();
    if (t.includes("video")) return "video";
    if (t.includes("audio")) return "audio";
    if (t.includes("pdf")) return "pdf";
  }

  const url = row.url?.toLowerCase() || "";
  if (url.endsWith(".mp4") || url.endsWith(".m4v")) return "video";
  if (url.endsWith(".mp3") || url.endsWith(".wav")) return "audio";
  if (url.endsWith(".pdf")) return "pdf";

  return "other";
}

function cleanTitle(row: LibraryRow): string {
  if (row.title && row.title.trim().length > 0) return row.title.trim();
  if (!row.url) return "Untitled Lesson";

  try {
    const url = new URL(row.url);
    const file = url.pathname.split("/").pop() || "";
    const withoutExt = file.replace(/\.[^/.]+$/, "");
    return withoutExt.replace(/[_-]+/g, " ");
  } catch {
    return "Untitled Lesson";
  }
}

export default function FreedomSchoolClient() {
  const supabase = createClientComponentClient();

  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [softError, setSoftError] = useState<string | null>(null);

  async function loadLessons() {
    setLoading(true);
    setSoftError(null);

    try {
      const { data, error } = await supabase
        .from("freedom_school_library")
        .select(
          "id, title, description, type, url, thumbnail, channel_id, channel_name, date_added, file_size, duration, content"
        )
        .eq("channel_id", FREEDOM_CHANNEL_ID)
        .order("date_added", { ascending: true });

      if (error) {
        console.error("Freedom School library error:", error);
        setSoftError("Freedom School content is temporarily unavailable.");
        setLessons([]);
        setLoading(false);
        return;
      }

      const rows = (data || []) as LibraryRow[];

      const validRows = rows.filter((r) => r.url && r.url.trim().length > 0);

      if (!validRows.length) {
        setSoftError("Freedom School lessons are coming soon. Please check back.");
        setLessons([]);
        setLoading(false);
        return;
      }

      const mapped: Lesson[] = validRows.map((r) => ({
        id: r.id,
        title: cleanTitle(r),
        description: r.description,
        url: r.url as string,
        thumbnail: r.thumbnail,
        kind: detectKindFromRow(r),
      }));

      setLessons(mapped);
      setActiveIndex(0);
    } catch (e: any) {
      console.error("Unexpected Freedom School error:", e);
      setSoftError("Freedom School content is temporarily unavailable.");
      setLessons([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadLessons();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const active = lessons[activeIndex];

  function handlePlayFeatured() {
    if (!lessons.length) return;
    setActiveIndex(0);
    const el = document.getElementById("freedom-school-player");
    if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  // Loop through video/audio only
  function goToNextPlayable() {
    if (!lessons.length) return;

    const playableIndexes = lessons
      .map((l, i) => (l.kind === "video" || l.kind === "audio" ? i : null))
      .filter((i) => i !== null) as number[];

    if (!playableIndexes.length) return;

    const currentPos = playableIndexes.indexOf(activeIndex);
    const nextIndex =
      currentPos === -1
        ? playableIndexes[0]
        : playableIndexes[(currentPos + 1) % playableIndexes.length];

    setActiveIndex(nextIndex);
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-black via-[#050b1a] to-black text-white">
      <div className="max-w-6xl mx-auto px-4 py-10 space-y-10">
        {/* HERO */}
        <section className="rounded-2xl border border-slate-800 bg-slate-900/70 px-6 py-6 md:px-8 md:py-8 shadow-xl">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight">
                Freedom School
              </h1>
              <p className="mt-2 text-sm md:text-base text-slate-300 max-w-2xl">
                Our virtual classroom is always open. Watch lessons, listen to audio,
                and download study packets from the Freedom School library.
              </p>
            </div>
            <div className="flex flex-col items-start md:items-end gap-2">
              <button
                type="button"
                onClick={handlePlayFeatured}
                disabled={loading || !lessons.length}
                className="inline-flex items-center rounded-full bg-amber-600 px-4 py-2 text-sm font-semibold hover:bg-amber-700 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                ▶ Play Featured Lesson
              </button>
            </div>
          </div>
        </section>

        {/* MAIN: PLAYER + LIST */}
        <section className="grid gap-6 md:grid-cols-[minmax(0,2fr)_minmax(0,1.4fr)] items-start">
          {/* PLAYER */}
          <div
            id="freedom-school-player"
            className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4 md:p-5 shadow-lg min-h-[260px]"
          >
            {loading && (
              <div className="h-64 flex items-center justify-center text-slate-300 text-sm">
                Loading Freedom School lessons…
              </div>
            )}

            {!loading && softError && !lessons.length && (
              <div className="h-64 flex flex-col items-center justify-center text-center text-slate-300 text-sm px-4">
                <p className="font-semibold mb-1">{softError}</p>
              </div>
            )}

            {!loading && !softError && active && (
              <div className="space-y-4">
                <div>
                  <p className="text-xs uppercase tracking-wide text-slate-400 mb-1">
                    Now Playing
                  </p>
                  <h2 className="text-lg font-semibold text-amber-300">
                    {active.title}
                  </h2>
                  {active.description && (
                    <p className="mt-1 text-xs text-slate-300">
                      {active.description}
                    </p>
                  )}
                  <p className="text-[11px] text-slate-400 mt-1">
                    {active.kind === "video"
                      ? "Video Lesson"
                      : active.kind === "audio"
                      ? "Audio Lesson"
                      : active.kind === "pdf"
                      ? "Downloadable PDF"
                      : "Lesson"}
                  </p>
                </div>

                {active.kind === "video" && (
                  <video
                    key={active.url}
                    src={active.url}
                    controls
                    autoPlay
                    onEnded={goToNextPlayable}
                    className="w-full rounded-xl border border-slate-700 bg-black max-h-[480px]"
                  />
                )}

                {active.kind === "audio" && (
                  <div className="space-y-3">
                    <audio
                      key={active.url}
                      src={active.url}
                      controls
                      autoPlay
                      onEnded={goToNextPlayable}
                      className="w-full"
                    />
                    <p className="text-xs text-slate-400">
                      Audio lesson — listen while you work or study.
                    </p>
                  </div>
                )}

                {active.kind === "pdf" && (
                  <div className="space-y-3">
                    <p className="text-sm text-slate-200">
                      This is a downloadable study packet.
                    </p>
                    <a
                      href={active.url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center rounded-full bg-amber-600 px-4 py-2 text-sm font-semibold hover:bg-amber-700"
                    >
                      ⬇ Download PDF
                    </a>
                  </div>
                )}

                {active.kind === "other" && (
                  <p className="text-sm text-slate-300">
                    This file type can&apos;t be played directly, but you can open it in
                    a new tab:
                    <br />
                    <a
                      href={active.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-amber-300 underline text-xs"
                    >
                      Open resource
                    </a>
                  </p>
                )}
              </div>
            )}
          </div>

          {/* LESSON LIST */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4 md:p-5 shadow-lg">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-base font-semibold">Lesson Library</h3>
                <p className="text-[11px] text-slate-400">
                  Click a lesson to play it or open downloads.
                </p>
              </div>
              {!loading && lessons.length > 0 && (
                <span className="text-[11px] text-slate-400">
                  {lessons.length} item{lessons.length === 1 ? "" : "s"}
                </span>
              )}
            </div>

            {loading && (
              <div className="text-slate-300 text-sm py-8 text-center">
                Loading library…
              </div>
            )}

            {!loading && lessons.length === 0 && !softError && (
              <div className="text-slate-400 text-sm py-8 text-center">
                No lessons are available yet.
              </div>
            )}

            {!loading && lessons.length > 0 && (
              <ul className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
                {lessons.map((lesson, i) => {
                  const isActive = i === activeIndex;
                  const tagLabel =
                    lesson.kind === "video"
                      ? "Video"
                      : lesson.kind === "audio"
                      ? "Audio"
                      : lesson.kind === "pdf"
                      ? "PDF"
                      : "File";

                  return (
                    <li key={lesson.id}>
                      <button
                        type="button"
                        onClick={() => setActiveIndex(i)}
                        className={`w-full text-left rounded-lg border px-3 py-2 text-sm transition ${
                          isActive
                            ? "border-amber-400 bg-amber-400/10"
                            : "border-slate-700 bg-slate-900 hover:bg-slate-800"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium truncate">
                            {lesson.title}
                          </span>
                          <span
                            className={`ml-2 inline-flex items-center rounded-full border px-2 py-[2px] text-[10px] uppercase tracking-wide ${
                              isActive
                                ? "border-amber-400 text-amber-300"
                                : "border-slate-500 text-slate-300"
                            }`}
                          >
                            {tagLabel}
                          </span>
                        </div>

                        {lesson.description && (
                          <p className="mt-1 text-[11px] text-slate-400 line-clamp-2">
                            {lesson.description}
                          </p>
                        )}

                        {lesson.kind === "pdf" && (
                          <div className="mt-1">
                            <a
                              href={lesson.url}
                              target="_blank"
                              rel="noreferrer"
                              className="text-[11px] text-amber-300 hover:underline"
                              onClick={(e) => e.stopPropagation()}
                            >
                              Open / Download PDF
                            </a>
                          </div>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
