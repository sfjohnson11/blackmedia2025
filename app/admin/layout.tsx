// app/admin/layout.tsx
import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";

export const dynamic = "force-dynamic";

type Props = {
  children: ReactNode;
};

export default async function AdminLayout({ children }: Props) {
  const supabase = createServerComponentClient({ cookies });

  // 1) Require logged-in user
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    // No session → go to the ONE login page
    redirect("/login?redirect=/admin");
  }

  // 2) Look up user_profiles by ID (most reliable), fall back to email if needed
  const { data: profile, error: profileError } = await supabase
    .from("user_profiles")
    .select("id, role, email")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError || !profile) {
    // No profile row = no access to admin
    redirect("/login?error=no_profile");
  }

  const role = (profile.role || "member").toLowerCase().trim();

  if (role !== "admin") {
    // Logged in but not admin → push them out of /admin
    redirect("/?error=not_admin");
  }

  // 3) Authorized admin - show admin panel
  return <>{children}</>;
}
