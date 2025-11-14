// app/admin/layout.tsx
import type { ReactNode } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";

export const dynamic = "force-dynamic"; // do not prerender

export default async function AdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  const supabase = createServerComponentClient({ cookies });

  // 1) Require a logged-in session
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    // Not logged in → go to admin login (outside /admin) and come back to /admin
    redirect("/login-admin?redirect=/admin");
  }

  // 2) Require role=admin (user_profiles.id references auth.users.id)
  const { data: profile, error: profileError } = await supabase
    .from("user_profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError || !profile || profile.role !== "admin") {
    // Logged in but not allowed to be here
    redirect("/"); // or "/login" if you prefer
  }

  // ✅ Only admins reach this point
  return <>{children}</>;
}
