// app/freedom-school/page.tsx
import type { Metadata } from "next";
import FreedomSchoolClient from "./FreedomSchoolClient";

export const metadata: Metadata = {
  title: "Freedom School | Black Truth TV",
  description: "Our virtual classroom is always open.",
};

export const revalidate = 0;
export const dynamic = "force-dynamic";

export default function FreedomSchoolPage() {
  return <FreedomSchoolClient />;
}
