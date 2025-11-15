// app/admin/layout.tsx
import type { ReactNode } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";

export const dynamic = "force-dynamic"; // do not prerender

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const supabase = createServerComponentClient({ cookies });

  // 1) Require a logged-in session
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login-admin?redirect=/admin");
  }

  // 2) Require role=admin (user_profiles.id references auth.users.id)
  const { data: profile } = await supabase
    .from("user_profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile || profile.role !== "admin") {
    // Logged in but not allowed to be here
    redirect("/"); // or wherever you want non-admins to land
  }

  // ✅ Only admins reach this point
  return <>{children}</>;
}
