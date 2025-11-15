// app/admin/add-channel/page.tsx
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowLeft, PlusCircle, Info } from "lucide-react";

export default function AddChannelPage() {
  const router = useRouter();

  const [channelId, setChannelId] = useState<string>("");
  const [name, setName] = useState<string>("");
  const [bucket, setBucket] = useState<string>("");

  // Automatically suggest bucket as "channel{n}" when channelId changes
  useEffect(() => {
    if (!channelId) {
      setBucket("");
      return;
    }
    const n = Number(channelId);
    if (!Number.isNaN(n) && n > 0) {
      setBucket(`channel${n}`);
    }
  }, [channelId]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const n = Number(channelId);
    if (Number.isNaN(n) || n <= 0) {
      alert("Channel ID must be a positive number (e.g. 1, 16, 29).");
      return;
    }
    if (!name.trim()) {
      alert("Please enter a channel name.");
      return;
    }
    if (!bucket.trim()) {
      alert("Please enter a storage bucket.");
      return;
    }

    const params = new URLSearchParams({
      create: String(n),
      name: name.trim(),
      bucket: bucket.trim(),
    });

    // Let the existing Channel Manager handle creation logic
    router.push(`/admin/channel-manager?${params.toString()}`);
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#040814] via-[#050b1a] to-black text-white pb-10">
      <div className="mx-auto max-w-3xl px-4 pt-8 space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Add Channel</h1>
            <p className="mt-1 text-sm text-slate-300">
              Quickly create a new Black Truth TV channel by sending details to
              your existing Channel Manager.
            </p>
          </div>
          <div className="flex gap-2">
            <Link href="/admin/channel-manager">
              <Button
                variant="outline"
                className="border-slate-600 bg-slate-900 text-sm"
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Channel Manager
              </Button>
            </Link>
            <Link href="/admin">
              <Button
                variant="outline"
                className="border-slate-600 bg-slate-900 text-sm"
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Admin Home
              </Button>
            </Link>
          </div>
        </div>

        {/* Info box */}
        <div className="flex gap-2 rounded-lg border border-slate-700 bg-slate-900/70 px-4 py-3 text-xs text-slate-200">
          <Info className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-300" />
          <p>
            This page does not talk to the database directly. It builds a URL
            like{" "}
            <code className="text-amber-300">
              /admin/channel-manager?create=16&amp;name=My%20Channel&amp;bucket=channel16
            </code>{" "}
            and lets your existing Channel Manager do the actual creation.
          </p>
        </div>

        {/* Form */}
        <form
          onSubmit={handleSubmit}
          className="space-y-5 rounded-lg border border-slate-700 bg-slate-900/70 p-5"
        >
          {/* Channel ID */}
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-200">
              Channel ID (number)
            </label>
            <input
              type="number"
              value={channelId}
              onChange={(e) => setChannelId(e.target.value)}
              className="w-full rounded-md border border-slate-600 bg-slate-950 px-3 py-1.5 text-sm text-white focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400"
              placeholder="e.g. 1, 16, 29"
              min={1}
              required
            />
            <p className="mt-1 text-[10px] text-slate-400">
              This should match the numeric channel ID you use in your guide /
              viewer (1–29, etc.).
            </p>
          </div>

          {/* Channel Name */}
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-200">
              Channel Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-md border border-slate-600 bg-slate-950 px-3 py-1.5 text-sm text-white focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400"
              placeholder="e.g. Black Truth TV – Politics, Freedom School, etc."
              required
            />
            <p className="mt-1 text-[10px] text-slate-400">
              This is what viewers will see as the channel title.
            </p>
          </div>

          {/* Storage Bucket */}
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-200">
              Storage Bucket
            </label>
            <input
              type="text"
              value={bucket}
              onChange={(e) => setBucket(e.target.value)}
              className="w-full rounded-md border border-slate-600 bg-slate-950 px-3 py-1.5 text-sm text-white focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400"
              placeholder="e.g. channel16, freedom-school"
              required
            />
            <p className="mt-1 text-[10px] text-slate-400">
              Supabase bucket where this channel&apos;s MP4s live. For regular
              channels, use <span className="text-amber-300">channel&lt;id&gt;</span>{" "}
              (like <code>channel16</code>).
            </p>
          </div>

          <div className="pt-2">
            <Button
              type="submit"
              className="bg-emerald-600 text-sm hover:bg-emerald-700"
            >
              <PlusCircle className="mr-2 h-4 w-4" />
              Create Channel via Channel Manager
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
