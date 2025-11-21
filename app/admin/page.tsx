"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

// ROUTES
const LOGIN_PAGE = "/login";   // login
const USER_PAGE = "/";         // regular user page
const ADMIN_ROLE = "admin";

// supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function AdminPage() {
  const router = useRouter();
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    async function check() {
      // 1) check login session
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.replace(LOGIN_PAGE);
        return;
      }

      // 2) check role
      const { data: profile } = await supabase
        .from("user_profiles")
        .select("role")
        .eq("id", user.id)
        .single();

      if (!profile || profile.role !== ADMIN_ROLE) {
        router.replace(USER_PAGE);
        return;
      }

      // allow admin in
      setAllowed(true);
    }

    check();
  }, [router]);

  if (!allowed) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          background: "black",
          color: "white",
        }}
      >
        Loading…
      </div>
    );
  }

  return (
    <>
      {/* ⚠️⚠️⚠️ PASTE YOUR EXISTING ADMIN UI HERE ⚠️⚠️⚠️ */}
    </>
  );
}
