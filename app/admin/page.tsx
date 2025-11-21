// File: app/admin/page.tsx
"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

// 🔐 ROUTES – adjust if needed
const LOGIN_PAGE = "/login";   // where people log in
const USER_APP_HOME = "/";     // your main Black Truth TV app page (app/page.tsx)
const ADMIN_ROLE = "admin";

// 🔐 Supabase browser client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

function AdminGuard({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      // 1️⃣ Check if user is logged in
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (cancelled) return;

      if (userError || !user) {
        // Not logged in → send to login
        router.replace(LOGIN_PAGE);
        return;
      }

      // 2️⃣ Look up role from user_profiles
      const { data: profile, error: profileError } = await supabase
        .from("user_profiles")
        .select("role")
        .eq("id", user.id)
        .single();

      if (cancelled) return;

      if (profileError || !profile) {
        // No profile or error → treat as regular user
        router.replace(USER_APP_HOME);
        return;
      }

      // 3️⃣ Only admins allowed
      if (profile.role !== ADMIN_ROLE) {
        router.replace(USER_APP_HOME);
        return;
      }

      // ✅ Admin allowed
      setChecking(false);
    }

    run();

    return () => {
      cancelled = true;
    };
  }, [router]);

  if (checking) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#000",
          color: "#fff",
          fontFamily: "system-ui, -apple-system, Segoe UI, sans-serif",
        }}
      >
        Checking admin access…
      </div>
    );
  }

  return <>{children}</>;
}

// ⬇️ PUT YOUR EXISTING ADMIN UI HERE
function AdminContent() {
  // Take everything that used to be in your old AdminPage()
  // and paste it inside the return below.
  return (
    <>
      {/* 
        ================================
        PASTE YOUR EXISTING ADMIN JSX HERE
        Example:
        <main className="...">
          ...all your cards, tools, tabs, etc...
        </main>
        ================================
      */}
    </>
  );
}

// 👑 Final protected export
export default function AdminPage() {
  return (
    <AdminGuard>
      <AdminContent />
    </AdminGuard>
  );
}
