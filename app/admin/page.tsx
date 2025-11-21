"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import SessionTimeout from "@/components/SessionTimeout";
import {
  loadProfileForUserId,
  type UserProfile,
} from "@/lib/loadProfile";

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

      if (userError || !user) {
        router.replace("/login");
        return;
      }

      const profile = await loadProfileForUserId(user.id);

      if (!profile) {
        setError(
          "Could not load admin profile from user_profiles. Make sure this auth user id exists there with role = 'admin'."
        );
        setLoading(false);
        return;
      }

      if (profile.role !== "admin") {
        router.replace("/app"); // non-admin → app
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
            Signed in as{" "}
            <strong>
              {profile.email ?? profile.full_name ?? profile.name}
            </strong>{" "}
            (admin)
          </div>
        )}
      </header>

      <main>
        <p style={{ color: "#9ca3af", marginBottom: "16px" }}>
          Admin tools go here. Replace this with your scheduler, channel tools,
          playlists, etc.
        </p>
      </main>
    </div>
  );
}
