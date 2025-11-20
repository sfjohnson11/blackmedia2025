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

  // 1️⃣ Require logged-in user
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    // Not logged in → go to login and come back to /admin after
    redirect("/login?redirect=/admin");
  }

  // 2️⃣ Load profile BY EMAIL (same as login page)
  let role: string | null = null;

  if (user.email) {
    const { data: profileByEmail, error: emailError } = await supabase
      .from("user_profiles")
      .select("id, role, email")
      .eq("email", user.email) // ✅ same key you showed in the SQL output
      .maybeSingle();

    if (emailError) {
      console.error("Error loading admin profile by email:", emailError.message);
    }

    if (profileByEmail?.role) {
      role = String(profileByEmail.role);
    }
  }

  const finalRole = (role || "member").toLowerCase().trim();

  // 3️⃣ If not admin → send them to main app
  if (finalRole !== "admin") {
    redirect("/");
  }

  // 4️⃣ Authorized admin - show admin tools page
  return <>{children}</>;
}
