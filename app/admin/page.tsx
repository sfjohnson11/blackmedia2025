"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

// 🔹 Supabase client – uses your existing env keys
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// 🔹 This is your actual admin dashboard UI
// Move your existing admin JSX into this component's return.
function AdminDashboard() {
  return (
    <div className="min-h-screen bg-black text-white p-6">
      <h1 className="text-2xl font-bold mb-4">Black Truth TV — Admin</h1>

      {/* ⬇️ REPLACE THIS WITH YOUR REAL ADMIN TOOLS PAGE JSX ⬇️ */}
      <p>Admin dashboard placeholder — paste your tools UI here.</p>
      {/* ⬆️ REPLACE THIS WITH YOUR REAL ADMIN TOOLS PAGE JSX ⬆️ */}
    </div>
  );
}

export default function AdminPage() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    async function checkAdmin() {
      // 1️⃣ Get current Supabase user
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) {
        console.error("Error getting user in /admin:", userError.message);
      }

      // Not logged in → send to login and come back to /admin after
      if (!user || !user.email) {
        router.replace("/login?redirect=/admin");
        return;
      }

      // 2️⃣ Look up role BY EMAIL (this matches your user_profiles table)
      const { data: profile, error: profileError } = await supabase
        .from("user_profiles")
        .select("role, email")
        .eq("email", user.email) // ← THIS IS THE KEY
        .maybeSingle();

      if (profileError) {
        console.error("Error loading profile in /admin:", profileError.message);
      }

      const role =
        (profile?.role ? String(profile.role) : "member")
          .toLowerCase()
          .trim() || "member";

      // 3️⃣ If not admin → send them back to main app
      if (role !== "admin") {
        router.replace("/");
        return;
      }

      // 4️⃣ User is admin → show dashboard
      setChecking(false);
    }

    checkAdmin();
  }, [router]);

  if (checking) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        Loading…
      </div>
    );
  }

  return <AdminDashboard />;
}
