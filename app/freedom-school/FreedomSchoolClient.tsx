"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
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
  watchHref?: string;   // for video/audio
  resourceHref?: string; // for PDF / extra
  isFeatured?: boolean;
  rawName: string;
};

function inferTypeFromName(name: string): MediaType {
  const ext = name.split(".").pop()?.toLowerCase() || "";
  if (["mp4", "mov", "m4v", "webm"].includes(ext)) return "video";
  if (["mp3", "wav", "aac", "ogg"].includes(ext)) return "audio";
  if (ext === "pdf") return "pdf";
  return "other";
}

function prettyTitleFromFile(name: string): string {
  const withoutExt = name.replace(/\.[^.]+$/, "");
  const withSpaces = withoutExt.replace(/[_-]+/g, " ").trim();
  if (!withSpaces) return name;
  // Simple title-case
  return withSpaces
    .split(" ")
    .map((w) => (w.length ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");
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

  // Load from `freedom-school` bucket
  useEffect(() => {
    let cancelled = false;

    async function loadBucket() {
      setLoading(true);
      setErr(null);

      try {
        const { data, error } = await supabase
          .storage
          .from("freedom-school")
          .list("", { limit: 1000 });

        if (error) {
          console.error("Error listing freedom-school bucket", error);
          if (!cancelled) {
            setErr(error.message);
            setLessons([]);
          }
          return;
        }

        const files = (data || []).filter(
          (f) =>
            !f.name.startsWith(".") && // ignore hidden
            !f.name.endsWith("/") // ignore folders if any
        );

        const mapped: Lesson[] = [];

        for (const f of files) {
          const type = inferTypeFromName(f.name);
          if (type === "other") continue; // skip weird files

          const { data: urlData } = supabase
            .storage
            .from("freedom-school")
            .getPublicUrl(f.name);

          const publicUrl = urlData?.publicUrl;
          if (!publicUrl) continue;

          const title = prettyTitleFromFile(f.name);

          const baseLesson: Lesson = {
            id: f.name,
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
            mapped.push({
              ...baseLesson,
              resourceHref: publicUrl,
            });
          } else {
            mapped.push({
              ...baseLesson,
              watchHref: publicUrl,
            });
          }
        }

        // Sort by name so things are predictable
        mapped.sort((a, b) => a.rawName.localeCompare(b.rawName));

        if (!cancelled) {
          setLessons(mapped);
          setSelectedId((prev) => prev ?? mapped[0]?.id ?? null);
        }
      } catch (e: any) {
        console.error("Unexpected error loading Freedom School bucket", e);
        if (!cancelled) {
          setErr(e?.message || "Unexpected error loading media.");
          setLessons([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadBucket();
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
            This page now pulls real content from your{" "}
            <span className="font-semibold text-amber-300">
              freedom-school
            </span>{" "}
            bucket. Drop in videos, audio, and PDFs, and they’ll appear in your
            lesson library.
          </p>

          <div className="mt-5 flex flex-wrap gap-3">
            {selectedLesson?.watchHref && (
              <a
                href={selectedLesson.watchHref}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center rounded-md bg-red-600 px-4 py-2 text-sm font-semibold shadow-lg shadow-red-900/40 hover:bg-red-700"
              >
                <PlayCircle className="mr-2 h-4 w-4" />
                Start Featured Lesson
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
          Error loading Freedom School media: {err}
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
        {/* Left: Selected lesson detail */}
        <div className="w-full md:w-[60%]">
          {lessons.length === 0 ? (
            <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4 text-sm text-slate-200">
              No media found in the{" "}
              <span className="font-semibold text-amber-300">
                freedom-school
              </span>{" "}
              bucket yet.
              <br />
              <br />
              Upload MP4s, MP3s, or PDFs to that bucket in Supabase and refresh
              this page — they will appear here automatically.
            </div>
          ) : selectedLesson ? (
            <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4 shadow-lg shadow-black/40">
              {/* Media mock / thumbnail area */}
              <div className="relative mb-4 overflow-hidden rounded-lg border border-slate-800 bg-black/80 pt-[56.25%]">
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-center">
                  <div className="inline-flex items-center rounded-full bg-black/80 px-3 py-1 text-xs font-semibold text-slate-200 ring-1 ring-white/20">
                    <PlayCircle className="mr-1.5 h-3.5 w-3.5" />
                    {selectedLesson.type === "pdf"
                      ? "Reading / Handout"
                      : "Preview"}
                  </div>
                  <p className="max-w-sm text-xs text-slate-300">
                    This is a visual placeholder. Use{" "}
                    <span className="font-semibold">
                      {selectedLesson.type === "pdf"
                        ? "View PDF"
                        : "Watch Lesson"}
                    </span>{" "}
                    below to open the real file in a new tab.
                  </p>
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

                <div className="mt-4 flex flex-wrap gap-3">
                  {selectedLesson.watchHref && (
                    <a
                      href={selectedLesson.watchHref}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center rounded-md bg-red-600 px-3 py-1.5 text-sm font-semibold shadow hover:bg-red-700"
                    >
                      <PlayCircle className="mr-1.5 h-4 w-4" />
                      Watch Lesson
                    </a>
                  )}

                  {selectedLesson.resourceHref && (
                    <a
                      href={selectedLesson.resourceHref}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center rounded-md border border-slate-600 bg-slate-900 px-3 py-1.5 text-xs font-semibold text-slate-100 hover:bg-slate-800"
                    >
                      <FileText className="mr-1.5 h-3.5 w-3.5" />
                      View PDF / Handout
                    </a>
                  )}
                </div>

                <p className="mt-3 text-[11px] text-slate-400">
                  Teacher tip: Pair each file with 2–3 questions or a short
                  writing prompt so learners can connect history to their own
                  lives.
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

          {lessons.length === 0 ? (
            <p className="text-[11px] text-slate-500">
              Once you upload MP4s, MP3s, or PDFs to the{" "}
              <span className="font-semibold text-amber-300">
                freedom-school
              </span>{" "}
              bucket, they’ll appear here automatically.
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
            You can keep dropping in new Freedom School media anytime — this
            library will grow with you.
          </p>
        </div>
      </section>
    </div>
  );
}
