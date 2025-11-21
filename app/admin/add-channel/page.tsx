"use client";

import { useState, useEffect, FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import { Button } from "@/components/ui/button";
import { ArrowLeft, PlusCircle, Info } from "lucide-react";

type InsertStatus = "idle" | "saving" | "success" | "error";

export default function AddChannelPage() {
  const router = useRouter();
  const supabase = createClientComponentClient();

  const [channelId, setChannelId] = useState<string>("");
  const [name, setName] = useState<string>("");
  const [bucket, setBucket] = useState<string>("");
  const [status, setStatus] = useState<InsertStatus>("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

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

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setErrorMsg(null);
    setStatus("saving");

    const n = Number(channelId);
    if (Number.isNaN(n) || n <= 0) {
      setErrorMsg("Channel ID must be a positive number.");
      setStatus("error");
      return;
    }
    if (!name.trim()) {
      setErrorMsg("Please enter a channel name.");
      setStatus("error");
      return;
    }
    if (!bucket.trim()) {
      setErrorMsg("Please enter a storage bucket.");
      setStatus("error");
      return;
    }

    // ACTUAL CHANNEL CREATION
    const { error } = await supabase.from("channels").insert({
      id: n,
      name: name.trim(),
      bucket: bucket.trim(),
    });

    if (error) {
      console.error("Insert error:", error);
      setErrorMsg(`Supabase error: ${error.message}`);
      setStatus("error");
      return;
    }

    setStatus("success");
    router.push("/admin/channel-manager");
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#040814] via-[#050b1a] to-black text-white pb-10">
      <div className="mx-auto max-w-3xl px-4 pt-8 space-y-6">

        {/* HEADER */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Add Channel</h1>
            <p className="mt-1 text-sm text-slate-300">
              Create a new Black Truth TV channel directly in the database.
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

        {/* INFO BOX */}
        <div className="flex gap-2 rounded-lg border border-slate-700 bg-slate-900/70 px-4 py-3 text-xs text-slate-200">
          <Info className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-300" />
          <p>
            This saves a row directly into the <code className="text-amber-300">channels</code> table.<br />
            No redirect tricks. No hidden logic. This is the real creation.
          </p>
        </div>

        {/* STATUS / ERRORS */}
        {(status === "error" || status === "success") && (
          <div
            className={`rounded-lg border px-4 py-3 text-xs ${
              status === "error"
                ? "border-red-500 bg-red-950/60 text-red-100"
                : "border-emerald-500 bg-emerald-950/60 text-emerald-100"
            }`}
          >
            {status === "error" && errorMsg && <p>{errorMsg}</p>}
            {status === "success" && (
              <p>Channel created. Redirecting to Channel Manager…</p>
            )}
          </div>
        )}

        {/* FORM */}
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
              min={1}
              placeholder="1, 6, 12, 25..."
              required
            />
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
              placeholder="Resistance TV, Politics Live, etc."
              required
            />
          </div>

          {/* Bucket */}
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-200">
              Storage Bucket
            </label>
            <input
              type="text"
              value={bucket}
              onChange={(e) => setBucket(e.target.value)}
              className="w-full rounded-md border border-slate-600 bg-slate-950 px-3 py-1.5 text-sm text-white focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400"
              placeholder="channel5, channel20, freedom-school"
              required
            />
          </div>

          <div className="pt-2">
            <Button
              type="submit"
              className="bg-emerald-600 text-sm hover:bg-emerald-700"
              disabled={status === "saving"}
            >
              <PlusCircle className="mr-2 h-4 w-4" />
              {status === "saving" ? "Creating…" : "Create Channel"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
