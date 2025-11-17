"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  PlayCircle,
  BookOpen,
  Headphones,
  FileText,
  GraduationCap,
  Clock,
  Tag,
} from "lucide-react";

type MediaType = "video" | "audio" | "pdf" | "other";

type Lesson = {
  id: string;
  title: string;
  subtitle?: string;
  type: MediaType;
  length?: string;
  topicTag?: string;
  level?: "Beginner" | "Intermediate" | "Advanced" | string;
  description: string;
  watchHref?: string; // for video/audio
  resourceHref?: string; // for PDF / extra
  isFeatured?: boolean;
  rawName: string;
};

function inferTypeFromName(name: string): MediaType {
  const ext = name.split(".").pop()?.toLowerCase() || "";

  if (["mp4", "mov", "m4v", "webm"].includes(ext)) return "video";
  if (["mp3", "wav", "aac", "ogg"].includes(ext)) return "audio";
  if (ext === "pdf") return "pdf";

  return "video"; // default so it *shows* and can play
}

function prettyTitleFromFile(name: string): string {
  const withoutExt = name.replace(/\.[^.]+$/, "");
  const withSpaces = withoutExt.replace(/[_-]+/g, " ").trim();
  if (!withSpaces) return name;
  return withSpaces
    .split(" ")
    .map((w) => (w.length ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");
}

function asSeconds(v: unknown): number {
  if (v == null) return 0;
  if (typeof v === "number" && Number.isFinite(v)) return v;

  const s = String(v).trim();
  const m = /^(\d{1,3}):([0-5]?\d)(?::([0-5]?\d))?$/.exec(s);
  if (m) {
    const hh = m[3] ? Number(m[1]) : 0;
    const mm = Number(m[3] ? m[2] : m[1]);
    const ss = Number(m[3] ? m[3] : m[2]);
    return hh * 3600 + mm * 60 + ss;
  }

  const num = Number(s.replace(/[^\d.]+/g, ""));
  return Number.isFinite(num) && num > 0 ? Math.round(num) : 0;
}

function formatDurationFancy(v: unknown): string {
  const sec = asSeconds(v);
  if (!sec) return "";
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m} min`;
}

function typeBadge(type: MediaType) {
  switch (type) {
    case "video":
      return {
        icon: <PlayCircle className="h-3.5 w-3.5 mr-1" />,
        label: "Video Lesson",
        color: "bg-red-600/90 text-white",
      };
    case "audio":
      return {
        icon: <Headphones className="h-3.5 w-3.5 mr-1" />,
        label: "Audio Lesson",
        color: "bg-blue-600/90 text-white",
      };
    case "pdf":
      return {
        icon: <FileText className="h-3.5 w-3.5 mr-1" />,
        label: "Reading / PDF",
        color: "bg-emerald-600/90 text-white",
      };
    default:
      return {
        icon: <BookOpen className="h-3.5 w-3.5 mr-1" />,
        label: "Resource",
        color: "bg-amber-600/90 text-black",
      };
  }
}

export default function FreedomSchoolClient() {
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadLessons() {
      setLoading(true);
      setErr(null);

      const combined: Lesson[] = [];

      // 1️⃣ Try bucket: freedom-school
      try {
        const { data, error } = await supabase.storage
          .from("freedom-school")
          .list("", { limit: 1000 });

        if (!error && data) {
          const files =
            data.filter(
              (f) =>
                !f.name.startsWith(".") &&
                !f.name.endsWith("/") // ignore folder marker entries
            ) || [];

          for (const f of files) {
            const { data: urlData } = supabase.storage
              .from("freedom-school")
              .getPublicUrl(f.name);
            const publicUrl = urlData?.publicUrl;
            if (!publicUrl) continue;

            const type = inferTypeFromName(f.name);
            const title = prettyTitleFromFile(f.name);

            const baseLesson: Lesson = {
              id: `bucket-${f.name}`,
              rawName: f.name,
              title,
              type,
              description:
                type === "video"
                  ? "Freedom School video lesson from your library."
                  : type === "audio"
                  ? "Audio teaching from your Freedom School collection."
                  : type === "pdf"
                  ? "Printable reading or handout for your virtual classroom."
                  : "Freedom School resource.",
            };

            if (type === "pdf") {
              combined.push({
                ...baseLesson,
                resourceHref: publicUrl,
              });
            } else {
              combined.push({
                ...baseLesson,
                watchHref: publicUrl,
              });
            }
          }
        }
      } catch (e) {
        console.error("Error loading from freedom-school bucket", e);
        // we’ll fall back to programs, so no hard error here
      }

      // 2️⃣ Fallback: use programs for the Freedom School channel
      try {
        const { data: channelRow, error: chErr } = await supabase
          .from("channels")
          .select("id, name, slug")
          .or("slug.eq.freedom-school,name.ilike.freedom%school%")
          .maybeSingle();

        if (!chErr && channelRow) {
          const channelIdNum = Number(channelRow.id);
          if (!Number.isNaN(channelIdNum)) {
            const { data: progs, error: pErr } = await supabase
              .from("programs")
              .select("channel_id, title, mp4_url, start_time, duration")
              .eq("channel_id", channelIdNum)
              .not("mp4_url", "is", null)
              .order("start_time", { ascending: false })
              .limit(100);

            if (!pErr && progs) {
              for (const p of progs) {
                const rawFile =
                  (p.mp4_url || "").split("/").pop() || p.title || "Program";
                const title =
                  (p.title && p.title.trim()) || prettyTitleFromFile(rawFile);
                const type = inferTypeFromName(rawFile);

                const id = `prog-${p.channel_id}-${p.start_time}-${rawFile}`;

                // Avoid duplicates if same URL already came from bucket
                if (combined.some((l) => l.id === id)) continue;

                combined.push({
                  id,
                  rawName: rawFile,
                  title,
                  type,
                  description:
                    "Scheduled Freedom School broadcast, now available on demand.",
                  watchHref: p.mp4_url || undefined,
                  length: p.duration ? formatDurationFancy(p.duration) : undefined,
                });
              }
            }
          }
        }
      } catch (e) {
        console.error("Error loading Freedom School programs", e);
        if (!combined.length) {
          setErr("We’re having trouble loading Freedom School right now.");
        }
      }

      combined.sort((a, b) => a.rawName.localeCompare(b.rawName));

      if (!cancelled) {
        setLessons(combined);
        setSelectedId((prev) => prev ?? combined[0]?.id ?? null);
        setLoading(false);
      }
    }

    loadLessons();
    return () => {
      cancelled = true;
    };
  }, []);

  const selectedLesson = useMemo(() => {
    if (!lessons.length) return undefined;
    if (!selectedId) return lessons[0];
    return lessons.find((l) => l.id === selectedId) ?? lessons[0];
  }, [lessons, selectedId]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#050814] via-black to-black text-white">
      {/* Hero */}
      <section className="border-b border-slate-800 bg-[radial-gradient(circle_at_top,_rgba(239,68,68,0.18),_transparent_60%)] px-4 py-8 md:px-10">
        <div className="mx-auto max-w-5xl">
          <div className="flex flex-wrap items-center gap-3 text-xs font-semibold uppercase tracking-wide text-amber-300">
            <span className="inline-flex items-center rounded-full bg-amber-500/10 px-2.5 py-1 ring-1 ring-amber-400/40">
              <GraduationCap className="mr-1.5 h-3.5 w-3.5" />
              Freedom School
            </span>
            <span className="text-slate-300">
              Virtual classroom • History, power & Black liberation
            </span>
          </div>

          <h1 className="mt-4 text-3xl font-extrabold leading-tight md:text-4xl">
            The classroom is always open.
          </h1>
          <p className="mt-3 max-w-2xl text-sm text-slate-300 md:text-base">
            Stream Freedom School lessons on demand — lectures, documentaries,
            audio series, and readings curated by you.
          </p>

          <div className="mt-5 flex flex-wrap gap-3">
            {selectedLesson?.watchHref && (
              <a
                href="#player"
                className="inline-flex items-center rounded-md bg-red-600 px-4 py-2 text-sm font-semibold shadow-lg shadow-red-900/40 hover:bg-red-700"
              >
                <PlayCircle className="mr-2 h-4 w-4" />
                Play Featured Lesson
              </a>
            )}
            <a
              href="#lessons"
              className="inline-flex items-center rounded-md border border-slate-600 bg-slate-900/70 px-4 py-2 text-sm font-semibold text-slate-100 hover:bg-slate-800"
            >
              <BookOpen className="mr-2 h-4 w-4" />
              Browse All Lessons
            </a>
          </div>
        </div>
      </section>

      {/* Error / loading states */}
      {err && (
        <div className="mx-auto max-w-5xl px-4 pt-4 text-sm text-red-300 md:px-10">
          {err}
        </div>
      )}
      {loading && (
        <div className="mx-auto max-w-5xl px-4 pt-4 text-sm text-slate-300 md:px-10">
          Loading Freedom School lessons…
        </div>
      )}

      {/* Main content: Selected lesson + list */}
      <section
        id="lessons"
        className="mx-auto flex max-w-6xl flex-col gap-6 px-4 pb-10 pt-6 md:flex-row md:px-10"
      >
        {/* Left: Selected lesson detail + PLAYER */}
        <div className="w-full md:w-[60%]" id="player">
          {lessons.length === 0 && !loading && !err ? (
            <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4 text-sm text-slate-200">
              Freedom School lessons will appear here as they are added.
              <br />
              <br />
              Check back soon for new programs in the virtual classroom.
            </div>
          ) : selectedLesson ? (
            <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4 shadow-lg shadow-black/40">
              {/* Media area */}
              <div className="relative mb-4 overflow-hidden rounded-lg border border-slate-800 bg-black pt-[56.25%]">
                <div className="absolute inset-0">
                  {selectedLesson.type === "video" && selectedLesson.watchHref && (
                    <video
                      controls
                      className="h-full w-full rounded-lg bg-black"
                    >
                      <source src={selectedLesson.watchHref} />
                      Your browser does not support the video tag.
                    </video>
                  )}

                  {selectedLesson.type === "audio" && selectedLesson.watchHref && (
                    <div className="flex h-full flex-col items-center justify-center bg-black/80 px-4">
                      <p className="mb-3 text-sm text-slate-100">
                        {selectedLesson.title}
                      </p>
                      <audio controls className="w-full max-w-md">
                        <source src={selectedLesson.watchHref} />
                        Your browser does not support the audio element.
                      </audio>
                    </div>
                  )}

                  {selectedLesson.type === "pdf" && selectedLesson.resourceHref && (
                    <div className="flex h-full flex-col items-center justify-center bg-black/80 px-4 text-center text-sm text-slate-100">
                      <FileText className="mb-2 h-6 w-6 text-emerald-400" />
                      <p className="mb-2">
                        This is a Freedom School reading / handout.
                      </p>
                      <a
                        href={selectedLesson.resourceHref}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center rounded-md border border-emerald-400 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-100 hover:bg-emerald-500/20"
                      >
                        <FileText className="mr-1.5 h-3.5 w-3.5" />
                        Open PDF in New Tab
                      </a>
                    </div>
                  )}

                  {!selectedLesson.watchHref &&
                    !selectedLesson.resourceHref && (
                      <div className="flex h-full flex-col items-center justify-center bg-black/80 px-4 text-center text-xs text-slate-300">
                        <p>No media URL is configured for this lesson yet.</p>
                      </div>
                    )}
                </div>
              </div>

              {/* Text details */}
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-lg font-bold md:text-xl">
                    {selectedLesson.title}
                  </h2>
                  <span
                    className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                      typeBadge(selectedLesson.type).color
                    }`}
                  >
                    {typeBadge(selectedLesson.type).icon}
                    {typeBadge(selectedLesson.type).label}
                  </span>
                </div>

                <p className="mt-1 text-xs font-medium text-slate-300 md:text-sm">
                  File:{" "}
                  <span className="font-mono text-slate-200">
                    {selectedLesson.rawName}
                  </span>
                </p>

                <div className="flex flex-wrap gap-2 text-[11px] text-slate-300 md:text-xs">
                  {selectedLesson.length && (
                    <span className="inline-flex items-center rounded-full bg-slate-900 px-2 py-0.5">
                      <Clock className="mr-1 h-3 w-3" />
                      {selectedLesson.length}
                    </span>
                  )}
                  {selectedLesson.topicTag && (
                    <span className="inline-flex items-center rounded-full bg-slate-900 px-2 py-0.5">
                      <Tag className="mr-1 h-3 w-3" />
                      {selectedLesson.topicTag}
                    </span>
                  )}
                </div>

                <p className="mt-2 text-sm leading-relaxed text-slate-200">
                  {selectedLesson.description}
                </p>

                <p className="mt-3 text-[11px] text-slate-400">
                  Use Freedom School lessons for self-study or to anchor
                  classroom discussions, writing prompts, and research projects.
                </p>
              </div>
            </div>
          ) : null}
        </div>

        {/* Right: Lesson list */}
        <div className="w-full md:w-[40%]">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-200">
              Lesson Library
            </h3>
            <span className="text-[11px] text-slate-400">
              {lessons.length} lesson{lessons.length === 1 ? "" : "s"}
            </span>
          </div>

          {lessons.length === 0 && !loading && !err ? (
            <p className="text-[11px] text-slate-500">
              Freedom School lessons are being prepared. When new videos,
              audios, and readings are added, they will appear here.
            </p>
          ) : (
            <div className="space-y-2">
              {lessons.map((lesson) => {
                const active = lesson.id === selectedLesson?.id;
                const badge = typeBadge(lesson.type);

                return (
                  <button
                    key={lesson.id}
                    type="button"
                    onClick={() => setSelectedId(lesson.id)}
                    className={`w-full rounded-lg border px-3 py-2 text-left text-xs transition 
                      ${
                        active
                          ? "border-red-500/70 bg-red-950/40"
                          : "border-slate-800 bg-slate-900/60 hover:bg-slate-800/80"
                      }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-slate-50">
                          {lesson.title}
                        </p>
                        <p className="mt-0.5 truncate font-mono text-[10px] text-slate-400">
                          {lesson.rawName}
                        </p>

                        <div className="mt-1 flex flex-wrap gap-1 text-[10px] text-slate-300">
                          <span
                            className={`inline-flex items-center rounded-full px-2 py-0.5 ${badge.color}`}
                          >
                            {badge.icon}
                            {badge.label}
                          </span>
                          {lesson.length && (
                            <span className="inline-flex items-center rounded-full bg-slate-900 px-2 py-0.5">
                              <Clock className="mr-1 h-3 w-3" />
                              {lesson.length}
                            </span>
                          )}
                        </div>
                      </div>

                      {(lesson.watchHref || lesson.resourceHref) && (
                        <div className="ml-1 flex items-center">
                          {lesson.type === "pdf" ? (
                            <FileText className="h-4 w-4 text-emerald-400" />
                          ) : (
                            <PlayCircle className="h-4 w-4 text-red-400" />
                          )}
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          <p className="mt-4 text-[11px] text-slate-500">
            Build out Freedom School with series on desegregation, voting
            rights, policing, labor, and more — all in one dedicated library.
          </p>
        </div>
      </section>
    </div>
  );
}
