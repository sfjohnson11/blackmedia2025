// app/guide/page.tsx
import Link from "next/link";
import { Suspense } from "react";
import TVGuideGrid from "@/components/TVGuideGrid";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function GuidePage() {
  return (
    <div className="min-h-screen bg-black text-white">
      <main className="px-4 md:px-10 py-6">
        <div className="mb-4">
          <Link href="/" className="text-sm text-sky-300 hover:underline">
            ← Back to Home
          </Link>
        </div>

        <Suspense
          fallback={
            <div className="h-48 grid place-items-center text-white/70">
              Loading guide…
            </div>
          }
        >
          {/* Adjust the window as you like */}
          <TVGuideGrid lookBackHours={6} lookAheadHours={6} />
        </Suspense>
      </main>
    </div>
  );
}
