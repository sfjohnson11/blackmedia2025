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
  _table?: string;
};

// Same helper as login
async function fetchProfileByEmail(email: string): Promise<Profile | null> {
  const tableCandidates = ["profiles", "user_profiles", "users"];

  for (const table of tableCandidates) {
    const { data, error } = await supabase
      .from(table)
      .select("id,email,name,role,created_at")
      .eq("email", email)
      .maybeSingle();

    if (error) {
      console.warn(`Error querying ${table}:`, error.message);
      continue;
    }

    if (data) {
      console.log(`Loaded admin profile from table: ${table}`, data);
      return { ...(data as any), _table: table };
    }
  }

  return null;
}

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

      if (!user.email) {
        setError("Your account is missing an email. Contact admin.");
        setLoading(false);
        return;
      }

      const profile = await fetchProfileByEmail(user.email);

      if (!profile) {
        setError(
          "Could not load admin profile. Make sure this email exists in your users table with role = 'admin'."
        );
        setLoading(false);
        return;
      }

      if (profile.role !== "admin") {
        router.replace("/app"); // change if non-admin home is different
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

  // ✅ At this point: user is admin
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#020617",
        color: "#e5e7eb",
        padding: "24px",
      }}
    >
      {/* Auto-logout after 30 min inactivity */}
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
            {profile._table && (
              <span style={{ marginLeft: 8, fontSize: 12 }}>
                {/* Debug: which table we used */}
                [profile table: {profile._table}]
              </span>
            )}
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
