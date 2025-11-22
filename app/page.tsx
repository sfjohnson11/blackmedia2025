// app/page.tsx
import { redirect } from "next/navigation";

export default function RootPage() {
  // ✅ Any hit to the bare domain goes straight to the login page
  redirect("/login");
}
