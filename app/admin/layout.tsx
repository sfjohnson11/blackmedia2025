// app/admin/layout.tsx
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";

export const dynamic = "force-dynamic"; // ensure not prerendered

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = createServerComponentClient({ cookies });

  // Require session
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect("/admin/login?redirect=/admin");
  }

  // Require role=admin
  const { data: profile, error } = await supabase
    .from("user_profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (error || !profile || profile.role !== "admin") {
    redirect("/login"); // or redirect("/") if you prefer
  }

  return <>{children}</>;
}
