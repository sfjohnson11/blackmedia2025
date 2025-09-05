// app/guide/page.tsx
export const dynamic = "force-dynamic";
export const revalidate = 0;

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
        <TVGuideGrid lookBackHours={6} lookAheadHours={6} />
      </main>
    </div>
  );
}
