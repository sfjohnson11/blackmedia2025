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

  // --- 1) Require logged-in user ---
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    redirect("/admin/login");
  }

  // --- 2) Look up user_profiles BY EMAIL ---
  const { data: profile, error: profileError } = await supabase
    .from("user_profiles")
    .select("role, email")
    .eq("email", user.email)
    .maybeSingle();

  // If profile doesn’t exist OR not admin → boot them
  if (profileError || !profile || profile.role !== "admin") {
    redirect("/admin/login?error=not_admin");
  }

  // --- 3) Authorized admin - show admin panel ---
  return <>{children}</>;
}
