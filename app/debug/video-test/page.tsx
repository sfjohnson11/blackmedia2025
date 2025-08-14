// app/debug/video-test/page.tsx
"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Play } from "lucide-react";

// Client-only bell; avoids SSR/prerender issues and ensures it's defined
const NotificationBell = dynamic(() => import("@/components/notification-bell"), { ssr: false });

export default function VideoTestPage() {
  const [src, setSrc] = useState("");
  const [key, setKey] = useState(0);

  return (
    <div className="pt-24 px-4 md:px-10 min-h-screen">
      <div className="max-w-4xl mx-auto bg-gray-800 border border-gray-700 rounded-lg p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center">
            <Link href="/debug" className="mr-4">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
            </Link>
            <h1 className="text-2xl font-bold">Video Test</h1>
          </div>
          <NotificationBell />
        </div>

        <div className="space-y-3">
          <label className="text-sm text-gray-300">Video URL</label>
          <div className="flex gap-2">
            <input
              className="flex-1 bg-gray-900 border border-gray-700 rounded px-3 py-2"
              placeholder="https://example.com/video.mp4 or .m3u8"
              value={src}
              onChange={(e) => setSrc(e.target.value)}
            />
            <Button className="bg-red-600 hover:bg-red-700" onClick={() => setKey((k) => k + 1)}>
              <Play className="h-4 w-4 mr-2" />
              Load
            </Button>
          </div>

        <div className="w-full aspect-video mt-4 bg-black rounded overflow-hidden border border-gray-700 flex items-center justify-center">
            {src ? (
              <video key={key} src={src} className="w-full h-full" controls playsInline />
            ) : (
              <p className="text-gray-400 text-sm p-4">Enter a URL and press Load</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
