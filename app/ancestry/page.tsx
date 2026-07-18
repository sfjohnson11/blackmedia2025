// app/ancestry/page.tsx
import type { Metadata } from "next";
import AncestryClient from "./AncestryClient";

export const metadata: Metadata = {
  title: "Free Ancestry Search | Black Truth TV",
  description:
    "Search census rolls, Freedmen's Bureau papers, newspapers, and cemetery records — all on real, free archives. No paywalls.",
};

export const revalidate = 0;
export const dynamic = "force-dynamic";

export default function AncestryPage() {
  return <AncestryClient />;
}
