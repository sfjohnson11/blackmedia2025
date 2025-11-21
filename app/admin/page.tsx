// app/admin/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { loadProfileByEmail, type UserProfile } from "@/lib/loadProfile";

const ADMIN_EMAIL = "info@sfjohnsonconsulting.com";

export default function AdminPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function checkAdmin() {
      setLoading(true);
      setError(null);

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user || !user.email) {
        router.replace("/login");
        return;
      }

      const profile = await loadProfileByEmail(user.email);
      let isAdmin = false;

      if (profile && profile.role === "admin") {
        isAdmin = true;
      } else if (user.email === ADMIN_EMAIL) {
        // fallback: special-case admin email
        isAdmin = true;
      }

      if (!isAdmin) {
        router.replace("/app");
        return;
      }

      setProfile(profile);
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
          padding: "24px",
          textAlign: "center",
          whiteSpace: "pre-line",
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
      <h1 style={{ fontSize: "24px", fontWeight: 700, marginBottom: "16px" }}>
        Black Truth TV Admin
      </h1>
      <p style={{ color: "#9ca3af", marginBottom: "24px" }}>
        Signed in as{" "}
        <strong>
          {profile?.email ?? profile?.full_name ?? profile?.name ?? ADMIN_EMAIL}
        </strong>
      </p>

      <main>
        <p style={{ color: "#9ca3af" }}>
          Admin tools dashboard placeholder. Replace this with your scheduler,
          channel tools, playlists, etc.
        </p>
      </main>
    </div>
  );
}
