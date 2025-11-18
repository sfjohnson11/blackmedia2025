"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import {
  ArrowLeft,
  BookOpen,
  Loader2,
  PlusCircle,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";

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

export default function FreedomSchoolLibraryAdminPage() {
  const supabase = createClientComponentClient();

  const [rows, setRows] = useState<LibraryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Form state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState<LibraryRow["type"]>("video");
  const [url, setUrl] = useState("");
  const [thumbnail, setThumbnail] = useState("");
  const [channelId, setChannelId] = useState<number | "">(
    30 // default Freedom School
  );
  const [channelName, setChannelName] = useState("Freedom School");
  const [fileSize, setFileSize] = useState("");
  const [duration, setDuration] = useState<string>("");
  const [content, setContent] = useState("");

  async function loadLibrary() {
    setLoading(true);
    setErr(null);

    try {
      const { data, error } = await supabase
        .from("freedom_school_library")
        .select(
          "id, title, description, type, url, thumbnail, channel_id, channel_name, date_added, file_size, duration, content"
        )
        .order("date_added", { ascending: true });

      if (error) {
        console.error("Error loading Freedom School library:", error);
        setErr(error.message);
        setRows([]);
      } else {
        setRows((data || []) as LibraryRow[]);
      }
    } catch (e: any) {
      console.error("Unexpected error loading library:", e);
      setErr(e?.message || "Unexpected error loading library.");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadLibrary();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setSuccess(null);

    if (!url.trim()) {
      setErr("URL is required.");
      return;
    }

    if (!title.trim()) {
      setErr("Title is required.");
      return;
    }

    if (!channelId || Number.isNaN(Number(channelId))) {
      setErr("Channel ID must be a number (e.g. 30).");
      return;
    }

    const durationNumber =
      duration && !Number.isNaN(Number(duration)) ? Number(duration) : null;

    setSaving(true);
    try {
      const { error } = await supabase.from("freedom_school_library").insert({
        title: title.trim(),
        description: description.trim() || null,
        type: type || null,
        url: url.trim(),
        thumbnail: thumbnail.trim() || null,
        channel_id: Number(channelId),
        channel_name: channelName.trim() || null,
        file_size: fileSize.trim() || null,
        duration: durationNumber,
        content: content.trim() || null,
        // date_added: let DB default or trigger handle this
      });

      if (error) {
        console.error("Error inserting library row:", error);
        setErr(error.message);
        return;
      }

      setSuccess("Lesson added to Freedom School library.");
      setTitle("");
      setDescription("");
      setType("video");
      setUrl("");
      setThumbnail("");
      setChannelId(30);
      setChannelName("Freedom School");
      setFileSize("");
      setDuration("");
      setContent("");

      await loadLibrary();
    } catch (e: any) {
      console.error("Unexpected insert error:", e);
      setErr(e?.message || "Unexpected error adding lesson.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#040814] via-[#050b1a] to-black text-white pb-10">
      <div className="mx-auto max-w-6xl px-4 pt-8 space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-amber-400" />
              Freedom School Library
            </h1>
            <p className="mt-1 text-sm text-slate-300">
              Manage lessons for the Freedom School page — video, audio, and PDF
              resources.
            </p>
          </div>
          <div className="flex gap-2">
            <Link href="/admin">
              <Button
                variant="outline"
                className="border-slate-600 bg-slate-900 text-sm"
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Admin
              </Button>
            </Link>
          </div>
        </div>

        {/* Alerts */}
        {err && (
          <div className="flex items-start gap-2 rounded-md border border-red-500/60 bg-red-950/60 px-3 py-2 text-xs text-red-100">
            <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
            <p>{err}</p>
          </div>
        )}
        {success && (
          <div className="flex items-start gap-2 rounded-md border border-emerald-500/60 bg-emerald-950/60 px-3 py-2 text-xs text-emerald-100">
            <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0" />
            <p>{success}</p>
          </div>
        )}

        {/* Form + List */}
        <div className="grid gap-6 md:grid-cols-[minmax(0,1.3fr)_minmax(0,1.7fr)] items-start">
          {/* Form */}
          <section className="rounded-lg border border-slate-700 bg-slate-900/70 p-4 space-y-4">
            <div className="flex items-center gap-2 mb-1">
              <PlusCircle className="h-4 w-4 text-amber-400" />
              <h2 className="text-sm font-semibold">Add New Lesson</h2>
            </div>

            <form className="space-y-3" onSubmit={handleCreate}>
              {/* Title */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Title
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full rounded-md border border-slate-600 bg-slate-950 px-3 py-1.5 text-sm text-white focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400"
                  placeholder="Lesson title"
                  required
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Short Description
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full rounded-md border border-slate-600 bg-slate-950 px-3 py-1.5 text-sm text-white focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400"
                  rows={2}
                  placeholder="Optional — what this lesson covers"
                />
              </div>

              {/* Type + URL */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Type
                  </label>
                  <select
                    value={type || ""}
                    onChange={(e) => setType(e.target.value || null)}
                    className="w-full rounded-md border border-slate-600 bg-slate-950 px-3 py-1.5 text-sm text-white focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400"
                  >
                    <option value="video">Video</option>
                    <option value="audio">Audio</option>
                    <option value="pdf">PDF</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Channel ID
                  </label>
                  <input
                    type="number"
                    value={channelId}
                    onChange={(e) =>
                      setChannelId(
                        e.target.value === "" ? "" : Number(e.target.value)
                      )
                    }
                    className="w-full rounded-md border border-slate-600 bg-slate-950 px-3 py-1.5 text-sm text-white focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400"
                    placeholder="30"
                  />
                  <p className="mt-1 text-[10px] text-slate-400">
                    Freedom School is channel 30 — you can use other IDs if you
                    expand this table later.
                  </p>
                </div>
              </div>

              {/* URL */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  File URL (MP4, MP3, PDF, etc.)
                </label>
                <input
                  type="text"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  className="w-full rounded-md border border-slate-600 bg-slate-950 px-3 py-1.5 text-sm text-white focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400"
                  placeholder="https://.../freedom-school/lesson.mp4"
                  required
                />
              </div>

              {/* Thumbnail + Channel Name */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Thumbnail URL (optional)
                  </label>
                  <input
                    type="text"
                    value={thumbnail}
                    onChange={(e) => setThumbnail(e.target.value)}
                    className="w-full rounded-md border border-slate-600 bg-slate-950 px-3 py-1.5 text-sm text-white focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400"
                    placeholder="https://.../thumb.jpg"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Channel Name
                  </label>
                  <input
                    type="text"
                    value={channelName}
                    onChange={(e) => setChannelName(e.target.value)}
                    className="w-full rounded-md border border-slate-600 bg-slate-950 px-3 py-1.5 text-sm text-white focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400"
                    placeholder="Freedom School"
                  />
                </div>
              </div>

              {/* File size + duration */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    File Size (optional)
                  </label>
                  <input
                    type="text"
                    value={fileSize}
                    onChange={(e) => setFileSize(e.target.value)}
                    className="w-full rounded-md border border-slate-600 bg-slate-950 px-3 py-1.5 text-sm text-white focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400"
                    placeholder="e.g. 450 MB"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Duration (seconds, optional)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={duration}
                    onChange={(e) => setDuration(e.target.value)}
                    className="w-full rounded-md border border-slate-600 bg-slate-950 px-3 py-1.5 text-sm text-white focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400"
                    placeholder="e.g. 1800"
                  />
                </div>
              </div>

              {/* Content / notes */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Notes / Content (optional)
                </label>
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  className="w-full rounded-md border border-slate-600 bg-slate-950 px-3 py-1.5 text-sm text-white focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400"
                  rows={3}
                  placeholder="Internal notes, instructor content, etc."
                />
              </div>

              <div className="pt-2">
                <Button
                  type="submit"
                  disabled={saving}
                  className="bg-amber-600 hover:bg-amber-700 text-sm"
                >
                  {saving ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving lesson…
                    </>
                  ) : (
                    <>
                      <PlusCircle className="mr-2 h-4 w-4" />
                      Add Lesson to Library
                    </>
                  )}
                </Button>
              </div>
            </form>
          </section>

          {/* Existing entries */}
          <section className="rounded-lg border border-slate-700 bg-slate-900/70 p-4 space-y-3">
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-sm font-semibold">Existing Lessons</h2>
              <span className="text-[11px] text-slate-400">
                {loading ? "Loading…" : `${rows.length} item(s)`}
              </span>
            </div>

            <div className="max-h-[520px] overflow-y-auto rounded-md border border-slate-800 bg-slate-950/50">
              {loading ? (
                <div className="py-10 text-center text-xs text-slate-300">
                  <Loader2 className="mr-1 h-4 w-4 animate-spin inline" /> Loading
                  lessons…
                </div>
              ) : rows.length === 0 ? (
                <div className="py-10 text-center text-xs text-slate-400">
                  No lessons in the Freedom School library yet.
                </div>
              ) : (
                <table className="min-w-full text-[11px]">
                  <thead>
                    <tr className="bg-slate-900/90 text-slate-300">
                      <th className="px-3 py-2 text-left">Title</th>
                      <th className="px-3 py-2 text-left">Type</th>
                      <th className="px-3 py-2 text-left">Channel</th>
                      <th className="px-3 py-2 text-left">URL</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr
                        key={r.id}
                        className="border-t border-slate-800 hover:bg-slate-900/80"
                      >
                        <td className="px-3 py-2 align-top max-w-[200px]">
                          <div className="font-medium text-slate-100 truncate">
                            {r.title || "(untitled)"}
                          </div>
                          {r.description && (
                            <div className="text-[10px] text-slate-400 line-clamp-2">
                              {r.description}
                            </div>
                          )}
                        </td>
                        <td className="px-3 py-2 align-top text-slate-200">
                          {r.type || "—"}
                        </td>
                        <td className="px-3 py-2 align-top text-slate-300">
                          <div>{r.channel_name || "Freedom School"}</div>
                          <div className="text-[10px] text-slate-500">
                            ID: {r.channel_id ?? "—"}
                          </div>
                        </td>
                        <td className="px-3 py-2 align-top max-w-[260px]">
                          {r.url ? (
                            <a
                              href={r.url}
                              target="_blank"
                              rel="noreferrer"
                              className="text-amber-300 hover:underline break-all"
                            >
                              Open
                            </a>
                          ) : (
                            <span className="text-slate-500">No URL</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
