// app/guide/page.tsx
"use client";

import Link from "next/link";
import TVGuideGrid from "@/components/TVGuideGrid";

export default function GuidePage() {
  return (
    <div className="min-h-screen bg-black text-white">
      <main className="px-4 md:px-10 py-6">
        <div className="mb-4">
          <Link href="/" className="text-sm text-sky-300 hover:underline">
            ← Back to Home
          </Link>
        </div>

        {/* Client-only grid; it handles its own loading/diag states */}
        <TVGuideGrid lookBackHours={6} lookAheadHours={6} />
      </main>
    </div>
  );
}
