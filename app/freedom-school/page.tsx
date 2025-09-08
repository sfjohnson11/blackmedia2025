// app/freedom-school/page.tsx
import type { Metadata } from "next";
import FreedomSchoolClient from "./FreedomSchoolClient";

export const metadata: Metadata = {
  title: "Freedom School | Black Truth TV",
  description: "Our virtual classroom is always open.",
};

// ✅ These exports belong on a SERVER component:
export const revalidate = 0;
export const dynamic = "force-dynamic";

export default function FreedomSchoolPage() {
  // Nothing client-y here—just render the client component
  return <FreedomSchoolClient />;
}
