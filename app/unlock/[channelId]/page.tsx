"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Lock, AlertCircle, CheckCircle, ArrowLeft } from "lucide-react";
import { PROTECTED_CHANNELS } from "@/lib/protected-channels";

export default function UnlockPage({ params }: { params: { channelId: string } }) {
  const router = useRouter();
  const qs = useSearchParams();
  const from = qs.get("from") || `/watch/${params.channelId}`;

  const [passcode, setPasscode] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const channelIdNum = Number.parseInt(params.channelId, 10);

  useEffect(() => {
    if (!PROTECTED_CHANNELS.has(channelIdNum)) {
      // If not actually protected, just bounce to watch
      router.replace(`/watch/${params.channelId}`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channelIdNum]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);
    setLoading(true);
    try {
      const res = await fetch("/api/channel-access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channelId: channelIdNum, passcode }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setMsg({ ok: false, text: json?.error || "Invalid passcode" });
      } else {
        setMsg({ ok: true, text: "Access granted" });
        // small delay then go back to the watch page
        setTimeout(() => router.replace(from), 400);
      }
    } catch (err: any) {
      setMsg({ ok: false, text: err?.message || "Something went wrong" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-950 px-4">
      <div className="max-w-md w-full bg-gray-900 rounded-lg shadow-lg p-8 border border-gray-800">
        <div className="flex items-center justify-between mb-6">
          <Link href="/" className="text-sm text-gray-400 hover:text-white">
            <ArrowLeft className="inline h-4 w-4 mr-1" />
            Home
          </Link>
          <span className="text-xs text-gray-500">Channel {params.channelId}</span>
        </div>

        <div className="text-center mb-6">
          <Lock className="h-10 w-10 text-red-500 mx-auto mb-2" />
          <h1 className="text-2xl font-bold">This channel is password protected</h1>
          <p className="text-gray-400 mt-1">Enter the passcode to continue.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Passcode</label>
            <input
              type="password"
              value={passcode}
              onChange={(e) => setPasscode(e.target.value)}
              className="w-full px-4 py-2 bg-gray-950 border border-gray-800 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
              placeholder="Enter passcode"
              required
            />
          </div>

          {msg && (
            <div
              className={`p-3 rounded-md flex items-start text-sm ${
                msg.ok ? "bg-green-900/30 text-green-300" : "bg-red-900/30 text-red-300"
              }`}
            >
              {msg.ok ? <CheckCircle className="h-4 w-4 mr-2 mt-0.5" /> : <AlertCircle className="h-4 w-4 mr-2 mt-0.5" />}
              <p>{msg.text}</p>
            </div>
          )}

          <Button
            type="submit"
            disabled={loading || !passcode}
            className="w-full bg-red-600 hover:bg-red-700"
          >
            {loading ? "Checking…" : "Unlock"}
          </Button>

          <div className="text-center mt-2">
            <Link href={`/channels`} className="text-sm text-gray-400 hover:text-white">
              Back to Channels
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
