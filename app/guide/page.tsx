// app/guide/page.tsx
import TopNav from "@/components/top-nav";
import TVGuideGrid from "@/components/TVGuideGrid";
import Link from "next/link";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function GuidePage() {
  return (
    <div className="min-h-screen bg-black text-white">
      <TopNav />
      <main className="px-4 md:px-10 py-6">
        <div className="mb-4">
          <Link href="/" className="text-sm text-sky-300 hover:underline">← Back to Home</Link>
        </div>
        <TVGuideGrid />
      </main>
    </div>
  );
}
