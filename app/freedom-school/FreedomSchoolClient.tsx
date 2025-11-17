"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  PlayCircle,
  BookOpen,
  Headphones,
  FileText,
  GraduationCap,
  Clock,
  Tag,
} from "lucide-react";

type LessonType = "video" | "audio" | "pdf" | "mixed";

type Lesson = {
  id: string;
  title: string;
  subtitle?: string;
  type: LessonType;
  length?: string;          // e.g. "56 min"
  topicTag?: string;        // e.g. "Civil Rights", "Reconstruction"
  level?: "Beginner" | "Intermediate" | "Advanced";
  description: string;
  watchHref?: string;       // e.g. /watch/16 or external link
  resourceHref?: string;    // extra PDF / notes
  isFeatured?: boolean;
};

const LESSONS: Lesson[] = [
  {
    id: "1968-winter",
    title: "1968: The Year That Changed America — Winter",
    subtitle: "Protest, power, and the struggle for justice.",
    type: "video",
    length: "56 min",
    topicTag: "Civil Rights",
    level: "Intermediate",
    description:
      "Explore how 1968 reshaped politics, protest, and Black freedom movements in the United States. Use this lesson to connect past struggles to the headlines your students see today.",
    watchHref: "/watch/16",
    isFeatured: true,
  },
  {
    id: "negro-american-slavery",
    title: "The Negro American: Slavery — Decline and Renewal",
    subtitle: "Lecture & discussion audio lesson.",
    type: "audio",
    length: "15 min",
    topicTag: "Slavery & Reconstruction",
    level: "Intermediate",
    description:
      "A focused audio lesson on the changing economic and social systems around slavery and its so-called 'decline'. Ideal for short homework assignments or in-class listening.",
    watchHref: "#", // replace with real audio URL or page later
  },
  {
    id: "atomic-veterans",
    title: "Atomic Veterans",
    subtitle: "Black servicemembers, sacrifice, and state power.",
    type: "video",
    length: "52 min",
    topicTag: "Military & State Power",
    level: "Intermediate",
    description:
      "Stories of veterans exposed to nuclear testing and the decades-long fight for recognition. Connects questions of patriotism, health, and government responsibility.",
    watchHref: "/watch/15",
  },
  {
    id: "freedom-school-reading-pack",
    title: "Freedom School Reading Pack",
    subtitle: "Printable readings & discussion prompts.",
    type: "pdf",
    length: "5–10 pages",
    topicTag: "Teacher Toolkit",
    level: "Beginner",
    description:
      "A starter pack concept for teachers: primary sources, discussion questions, and short writing prompts you can pair with any Freedom School video.",
    resourceHref: "#", // later: link to Supabase PDF or Squarespace URL
  },
];

function typeBadge(type: LessonType) {
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
    case "mixed":
    default:
      return {
        icon: <BookOpen className="h-3.5 w-3.5 mr-1" />,
        label: "Mixed Media",
        color: "bg-amber-600/90 text-black",
      };
  }
}

export default function FreedomSchoolClient() {
  const [selectedId, setSelectedId] = useState<string | null>(
    () => LESSONS.find((l) => l.isFeatured)?.id ?? LESSONS[0]?.id ?? null
  );

  const selectedLesson = useMemo(
    () => LESSONS.find((l) => l.id === selectedId) ?? LESSONS[0],
    [selectedId]
  );

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
            Use these lessons for family study, youth circles, or community
            classrooms. Watch the feature, then dive into discussion and
            reflection together.
          </p>

          <div className="mt-5 flex flex-wrap gap-3">
            {selectedLesson?.watchHref && (
              <Link
                href={selectedLesson.watchHref}
                className="inline-flex items-center rounded-md bg-red-600 px-4 py-2 text-sm font-semibold shadow-lg shadow-red-900/40 hover:bg-red-700"
              >
                <PlayCircle className="mr-2 h-4 w-4" />
                Start Featured Lesson
              </Link>
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

      {/* Main content: Selected lesson + list */}
      <section
        id="lessons"
        className="mx-auto flex max-w-6xl flex-col gap-6 px-4 pb-10 pt-6 md:flex-row md:px-10"
      >
        {/* Left: Selected lesson detail */}
        <div className="w-full md:w-[60%]">
          {selectedLesson ? (
            <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4 shadow-lg shadow-black/40">
              {/* Media mock / thumbnail area */}
              <div className="relative mb-4 overflow-hidden rounded-lg border border-slate-800 bg-black/80 pt-[56.25%]">
                {/* Simple overlay text instead of a real player (safe, non-breaking) */}
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-center">
                  <div className="inline-flex items-center rounded-full bg-black/80 px-3 py-1 text-xs font-semibold text-slate-200 ring-1 ring-white/20">
                    <PlayCircle className="mr-1.5 h-3.5 w-3.5" />
                    Preview
                  </div>
                  <p className="max-w-sm text-xs text-slate-300">
                    This is a visual placeholder. Click{" "}
                    <span className="font-semibold">Watch Lesson</span> below to
                    open the real stream or audio.
                  </p>
                </div>
              </div>

              {/* Text details */}
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-lg font-bold md:text-xl">
                    {selectedLesson.title}
                  </h2>
                  {selectedLesson.type && (
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                        typeBadge(selectedLesson.type).color
                      }`}
                    >
                      {typeBadge(selectedLesson.type).icon}
                      {typeBadge(selectedLesson.type).label}
                    </span>
                  )}
                </div>

                {selectedLesson.subtitle && (
                  <p className="text-xs font-medium text-slate-300 md:text-sm">
                    {selectedLesson.subtitle}
                  </p>
                )}

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
                  {selectedLesson.level && (
                    <span className="inline-flex items-center rounded-full bg-slate-900 px-2 py-0.5">
                      Level: {selectedLesson.level}
                    </span>
                  )}
                </div>

                <p className="mt-2 text-sm leading-relaxed text-slate-200">
                  {selectedLesson.description}
                </p>

                <div className="mt-4 flex flex-wrap gap-3">
                  {selectedLesson.watchHref && (
                    <Link
                      href={selectedLesson.watchHref}
                      className="inline-flex items-center rounded-md bg-red-600 px-3 py-1.5 text-sm font-semibold shadow hover:bg-red-700"
                    >
                      <PlayCircle className="mr-1.5 h-4 w-4" />
                      Watch Lesson
                    </Link>
                  )}

                  {selectedLesson.resourceHref && (
                    <Link
                      href={selectedLesson.resourceHref}
                      target="_blank"
                      className="inline-flex items-center rounded-md border border-slate-600 bg-slate-900 px-3 py-1.5 text-xs font-semibold text-slate-100 hover:bg-slate-800"
                    >
                      <FileText className="mr-1.5 h-3.5 w-3.5" />
                      View Handouts / PDF
                    </Link>
                  )}
                </div>

                <p className="mt-3 text-[11px] text-slate-400">
                  Teacher tip: Pair this lesson with 2–3 reflection questions
                  and one short writing prompt so learners can connect history
                  to their own lives.
                </p>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4 text-sm text-slate-200">
              No lessons are configured yet. Once you add lessons, the selected
              one will appear here.
            </div>
          )}
        </div>

        {/* Right: Lesson list */}
        <div className="w-full md:w-[40%]">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-200">
              Lesson Library
            </h3>
            <span className="text-[11px] text-slate-400">
              {LESSONS.length} lesson{LESSONS.length === 1 ? "" : "s"}
            </span>
          </div>

          <div className="space-y-2">
            {LESSONS.map((lesson) => {
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
                      <div className="flex items-center gap-1.5">
                        <p className="truncate text-sm font-semibold text-slate-50">
                          {lesson.title}
                        </p>
                        {lesson.isFeatured && (
                          <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold text-amber-300 ring-1 ring-amber-400/50">
                            Featured
                          </span>
                        )}
                      </div>

                      {lesson.subtitle && (
                        <p className="mt-0.5 line-clamp-2 text-[11px] text-slate-300">
                          {lesson.subtitle}
                        </p>
                      )}

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
                        {lesson.topicTag && (
                          <span className="inline-flex items-center rounded-full bg-slate-900 px-2 py-0.5">
                            <Tag className="mr-1 h-3 w-3" />
                            {lesson.topicTag}
                          </span>
                        )}
                      </div>
                    </div>

                    {lesson.watchHref && (
                      <div className="ml-1 flex items-center">
                        <PlayCircle className="h-4 w-4 text-red-400" />
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          <p className="mt-4 text-[11px] text-slate-500">
            As you build out Freedom School, you can expand this list with new
            series (Civil Rights, Reconstruction, Political Education, Economics
            & Labor, and more).
          </p>
        </div>
      </section>
    </div>
  );
}
