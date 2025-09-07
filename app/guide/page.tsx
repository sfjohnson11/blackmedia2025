// app/guide/page.tsx
import Link from "next/link";
import dynamic from "next/dynamic";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// Client-only grid to avoid any server rendering hiccups
const TVGuideGrid = dynamic(() => import("@/components/TVGuideGrid"), {
  ssr: false,
  loading: () => (
    <div className="h-48 grid place-items-center text-white/70">
      Loading guide…
    </div>
  ),
});

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
