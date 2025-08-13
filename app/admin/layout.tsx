// app/admin/layout.tsx
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth"; // you already have this

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser(); // must return { role: 'admin' | 'student' | ... } or null

  if (!user || user.role !== "admin") {
    redirect("/login"); // or redirect("/"); or render a 403 page
  }

  return <>{children}</>;
}
