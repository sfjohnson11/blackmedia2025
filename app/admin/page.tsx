// app/admin/page.tsx
"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";

export default function AdminPage() {
  const supabase = createClientComponentClient();
  const router = useRouter();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        router.replace("/login");
        return;
      }

      const { data: profile } = await supabase
        .from("user_profiles")
        .select("role")
        .eq("id", session.user.id)
        .maybeSingle();

      if (!profile || profile.role !== "admin") {
        router.replace("/login");
        return;
      }

      setChecking(false);
    })();
  }, [supabase, router]);

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black text-white">
        <p className="text-gray-300">Checking admin access…</p>
      </div>
    );
  }

  return <AdminDashboardInner />;
}

/* -------------------------------------------------
   Your full AdminDashboardInner stays EXACTLY the same
   ------------------------------------------------- */
function AdminDashboardInner() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-[#040814] via-[#050b1a] to-black text-white pb-10">
      {/* your entire original admin UI code here */}
      <div className="p-10">
        <h1 className="text-3xl font-bold">Black Truth TV Admin</h1>
        <p className="text-gray-300 mt-2">
          Operate your Black Truth TV platform.
        </p>
      </div>
    </div>
  );
}
