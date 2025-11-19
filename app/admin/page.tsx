"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";

export default function AdminPage() {
  const supabase = createClientComponentClient();
  const router = useRouter();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: sessionData } = await supabase.auth.getSession();

      if (!sessionData?.session) {
        router.replace("/login");
        return;
      }

      const user = sessionData.session.user;

      const { data: profile } = await supabase
        .from("user_profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();

      if (!profile || profile.role !== "admin") {
        router.replace("/");
        return;
      }

      setChecking(false);
    })();
  }, []);

  if (checking) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center text-white">
        Checking admin…
      </div>
    );
  }

  return <AdminDashboardInner />;
}

function AdminDashboardInner() {
  return (
    <div className="min-h-screen bg-black text-white p-10">
      <h1 className="text-3xl font-bold mb-6">Admin Dashboard</h1>
      <p>Welcome admin!</p>
      {/* keep rest of your code here */}
    </div>
  );
}
