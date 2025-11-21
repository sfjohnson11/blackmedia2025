// app/admin/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { loadProfileByEmail, type UserProfile } from "@/lib/loadProfile";

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

      if (!profile) {
        setError(
          "Could not load admin profile from user_profiles. Make sure this email exists there with role = 'admin'."
        );
        setLoading(false);
        return;
      }

      if (profile.role !== "admin") {
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
      {profile && (
        <p style={{ color: "#9ca3af", marginBottom: "24px" }}>
          Signed in as{" "}
          <strong>
            {profile.email ?? profile.full_name ?? profile.name ?? "Admin"}
          </strong>
        </p>
      )}

      <main>
        {/* Your real admin tools go here */}
        <p style={{ color: "#9ca3af" }}>
          Admin tools dashboard placeholder. Replace this with your scheduler,
          channel tools, playlists, etc.
        </p>
      </main>
    </div>
  );
}
