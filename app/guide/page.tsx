// app/guide/page.tsx
export const dynamic = "force-dynamic";
export const revalidate = 0;

import TVGuideGrid from "../../components/TVGuideGrid"; // ← change this line

export default function GuidePage() {
  return (
    <main className="p-4">
      <TVGuideGrid />
    </main>
  );
}
