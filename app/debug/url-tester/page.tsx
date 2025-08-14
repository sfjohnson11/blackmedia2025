// app/debug/url-tester/page.tsx
"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Link2, Loader2 } from "lucide-react";

export default function UrlTesterPage() {
  const [url, setUrl] = useState("");
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<null | {
    ok: boolean;
    status?: number;
    statusText?: string;
    error?: string;
  }>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const runTest = useCallback(async () => {
    setTesting(true);
    setResult(null);
    setPreviewUrl(null);
    try {
      const u = url.trim();
      if (!u) throw new Error("Enter a URL to test.");
      const normalized = u.startsWith("http://") || u.startsWith("https://") ? u : `https://${u}`;

      let headOk = false;
      let status: number | undefined;
      let statusText: string | undefined;

      try {
        const res = await fetch(normalized, { method: "HEAD" });
        headOk = res.ok;
        status = res.status;
        statusText = res.statusText;
      } catch (e: any) {
        headOk = false;
        statusText = e?.message;
      }

      setResult({
        ok: Boolean(headOk),
        status,
        statusText,
        error: headOk ? undefined : (statusText || "HEAD failed (maybe CORS). Try the preview below."),
      });
      setPreviewUrl(normalized);
    } catch (e: any) {
      setResult({ ok: false, error: e?.message || "Failed to test URL." });
    } finally {
      setTesting(false);
    }
  }, [url]);

  return (
    <div className="pt-24 px-4 md:px-10 min-h-screen">
      <div className="max-w-4xl mx-auto bg-gray-800 border border-gray-700 rounded-lg p-6">
        <div className="flex items-center mb-6">
          <Link href="/debug" className="mr-4">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
          </Link>
          <h1 className="text-2xl font-bold">URL Tester</h1>
        </div>

        <div className="flex flex-col gap-3">
          <label className="text-sm text-gray-300" htmlFor="url">Enter a media URL (MP4/HLS, etc.)</label>
          <div className="flex gap-2 items-center">
            <div className="relative flex-1">
              <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-500">
                <Link2 className="h-4 w-4" />
              </span>
              <input
                id="url"
                className="w-full bg-gray-900 border border-gray-700 rounded pl-8 pr-3 py-2"
                placeholder="https://example.com/video.mp4"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
              />
            </div>
            <Button onClick={runTest} disabled={testing || !url.trim()} className="bg-red-600 hover:bg-red-700">
              {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : "Test"}
            </Button>
          </div>

          {result && (
            <div
              className={`mt-3 rounded p-3 text-sm ${
                result.ok
                  ? "bg-emerald-900/30 border border-emerald-700 text-emerald-200"
                  : "bg-yellow-900/30 border border-yellow-700 text-yellow-200"
              }`}
            >
              {result.ok ? (
                <div>
                  <div>HEAD request: <span className="font-semibold">OK</span></div>
                  {typeof result.status === "number" && <div>Status: {result.status} {result.statusText || ""}</div>}
                </div>
              ) : (
                <div>
                  <div className="font-semibold">Couldn’t verify with HEAD.</div>
                  <div className="mt-1">Reason: {result.error || "Unknown error"}</div>
                </div>
              )}
            </div>
          )}

          {previewUrl && (
            <div className="mt-6">
              <h2 className="text-lg font-semibold mb-2">Preview</h2>
              <div className="w-full aspect-video bg-black flex items-center justify-center rounded overflow-hidden border border-gray-700">
                <video key={previewUrl} controls playsInline className="w-full h-full" src={previewUrl} />
              </div>
              <p className="text-xs text-gray-400 mt-2">
                If the video above doesn’t play (CORS/codec/HLS), try the iframe below:
              </p>
              <div className="w-full aspect-video bg-black mt-2 rounded overflow-hidden border border-gray-700">
                <iframe src={previewUrl} className="w-full h-full border-0" />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
