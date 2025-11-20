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
    // Not logged in → go to the main login page
    redirect("/login");
  }

  // 2) Determine role from user_profiles (email first, then id)
  let role: string | null = null;

  if (user.email) {
    const { data: profileByEmail, error: emailError } = await supabase
      .from("user_profiles")
      .select("id, role, email")
      .eq("email", user.email)
      .maybeSingle();

    if (emailError) {
      console.error("Error loading admin profile by email:", emailError.message);
    }

    if (profileByEmail?.role) {
      role = String(profileByEmail.role);
    }
  }

  if (!role) {
    const { data: profileById, error: idError } = await supabase
      .from("user_profiles")
      .select("id, role, email")
      .eq("id", user.id)
      .maybeSingle();

    if (idError) {
      console.error("Error loading admin profile by id:", idError.message);
    }

    if (profileById?.role) {
      role = String(profileById.role);
    }
  }

  const finalRole = (role || "member").toLowerCase().trim();

  // 3) If not admin → boot them to regular app
  if (finalRole !== "admin") {
    redirect("/");
  }

  // 4) Authorized admin - show admin tools page
  return <>{children}</>;
}
