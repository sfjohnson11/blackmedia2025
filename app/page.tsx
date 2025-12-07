// app/page.tsx

import { redirect } from "next/navigation";

// Make this route dynamic so Next.js doesn't try to pre-render it at build time
export const dynamic = "force-dynamic";

export default function RootPage() {
  // Any hit to the bare domain goes straight to the login page
  redirect("/login");
  return null;
}
