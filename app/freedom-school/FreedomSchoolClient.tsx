"use client";

import { useEffect, useState } from "react";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";

type FSAsset = {
  name: string;
  type: "video" | "audio" | "pdf" | "other";
  url: string;
};

export default function FreedomSchoolClient() {
  const supabase = createClientComponentClient();

  const [assets, setAssets] = useState<FSAsset[]>([]);
  const [activeIndex, setActiveIndex] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  // Detect file type
  function detectType(name: string): FSAsset["type"] {
    const lower = name.toLowerCase();
    if (lower.endsWith(".mp4")) return "video";
    if (lower.endsWith(".mp3") || lower.endsWith(".wav")) return "audio";
    if (lower.endsWith(".pdf")) return "pdf";
    return "other";
  }

  // Load all files from freedom-school bucket
  async function loadBucket() {
    setLoading(true);

    const { data, error } = await supabase.storage
      .from("freedom-school")
      .list("", { limit: 200 });

    if (error) {
      console.error("Bucket load error:", error);
      setAssets([]);
      setLoading(false);
      return;
    }

    // Convert bucket files to public URLs and types
    const processed = (data || [])
      .map((f) => {
        const { data: pub } = supabase.storage
          .from("freedom-school")
          .getPublicUrl(f.name);

        return {
          name: f.name,
          type: detectType(f.name),
          url: pub.publicUrl,
        } as FSAsset;
      })
      .filter((a) => a.type !== "other"); // ignore junk files

    setAssets(processed);
    setLoading(false);
  }

  useEffect(() => {
    loadBucket();
  }, []);

  // ACTIVE ASSET
  const active = assets[activeIndex];

  return (
    <div className="min-h-screen bg-black text-white px-4 py-10">
      <div className="max-w-5xl mx-auto space-y-10">
        <header>
          <h1 className="text-3xl font-bold">Freedom School</h1>
          <p className="text-gray-400 mt-2">Our virtual classroom is always open.</p>
        </header>

        {/* Loading */}
        {loading && (
          <div className="text-gray-300 text-center py-20 text-lg">
            Loading lessons…
          </div>
        )}

        {/* No content */}
        {!loading && assets.length === 0 && (
          <div className="text-center py-20 text-gray-400 text-sm">
            No MP4, MP3, or PDF files found in the <b>freedom-school</b> bucket.
          </div>
        )}

        {/* Player */}
        {!loading && assets.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold">
              Now Playing: <span className="text-amber-400">{active.name}</span>
            </h2>

            {/* VIDEO */}
            {active.type === "video" && (
              <video
                key={active.url}
                src={active.url}
                controls
                autoPlay
                className="w-full rounded-lg border border-gray-700"
              />
            )}

            {/* AUDIO */}
            {active.type === "audio" && (
              <audio
                key={active.url}
                src={active.url}
                controls
                autoPlay
                className="w-full"
              />
            )}

            {/* PDF */}
            {active.type === "pdf" && (
              <a
                href={active.url}
                target="_blank"
                className="inline-block bg-amber-600 hover:bg-amber-700 px-4 py-2 rounded text-sm font-semibold"
              >
                Download PDF
              </a>
            )}
          </div>
        )}

        {/* LESSON LIST */}
        {!loading && assets.length > 0 && (
          <div className="border-t border-gray-700 pt-8 space-y-4">
            <h3 className="text-lg font-semibold">All Lessons</h3>

            <ul className="space-y-2">
              {assets.map((a, i) => (
                <li
                  key={a.name}
                  className={`p-3 rounded border cursor-pointer transition ${
                    i === activeIndex
                      ? "border-amber-400 bg-amber-400/10"
                      : "border-gray-700 hover:bg-gray-800"
                  }`}
                  onClick={() => setActiveIndex(i)}
                >
                  <span className="font-medium">{a.name}</span>
                  <span className="ml-2 text-xs text-gray-400">
                    ({a.type})
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
