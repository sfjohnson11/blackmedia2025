// app/admin/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import SessionTimeout from "@/components/SessionTimeout";

type Role = "admin" | "member" | "student";

type Profile = {
  id: string;
  email: string | null;
  name?: string | null;
  role: Role | null;
  created_at: string | null;
};

export default function AdminPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function checkAdmin() {
      setLoading(true);
      setError(null);

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        router.replace("/login");
        return;
      }

      const { data, error: profileError } = await supabase
        .from("profiles")
        .select("id,email,name,role,created_at")
        .eq("id", user.id)
        .single();

      if (profileError || !data) {
        setError("Could not load profile. Contact admin.");
        setLoading(false);
        return;
      }

      if (data.role !== "admin") {
        router.replace("/app"); // CHANGE if your non-admin home is different
        return;
      }

      setProfile(data as Profile);
      setLoading(false);
    }

    checkAdmin();
  }, [router]);

  if (loading) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#020617",
          color: "#e5e7eb",
        }}
      >
        Checking admin access…
      </div>
    );
  }

  if (error) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#020617",
          color: "#fecaca",
        }}
      >
        {error}
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#020617",
        color: "#e5e7eb",
        padding: "24px",
      }}
    >
      {/* 🔐 Auto-logout after 30 min inactivity */}
      <SessionTimeout />

      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "24px",
        }}
      >
        <h1 style={{ fontSize: "24px", fontWeight: 700 }}>
          Black Truth TV Admin
        </h1>
        {profile && (
          <div style={{ fontSize: "14px", color: "#9ca3af" }}>
            Signed in as <strong>{profile.email}</strong> (admin)
          </div>
        )}
      </header>

      <main>
        <p style={{ color: "#9ca3af", marginBottom: "16px" }}>
          Admin tools go here. Replace this with your scheduler, channel tools,
          playlists, etc.
        </p>
        {/* ⬇️ Drop your real admin dashboard JSX here */}
      </main>
    </div>
  );
}
