"use client";

import { useState, useEffect, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type Role = "admin" | "member" | "student";

type Profile = {
  id: string;
  email: string | null;
  role: Role | null;
  created_at: string | null;
};

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // If user is already logged in, send them where they belong
  useEffect(() => {
    async function checkExistingSession() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return;

      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();

      const role = (profile?.role ?? "member") as Role;

      if (role === "admin") {
        router.replace("/admin");
      } else {
        router.replace("/app"); // <- change to your non-admin home if different
      }
    }

    checkExistingSession();
  }, [router]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    // 1) Sign in with Supabase
    const { data, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError || !data.user) {
      setError(authError?.message || "Login failed. Check email/password.");
      setSubmitting(false);
      return;
    }

    const user = data.user;

    // 2) Look up role from profiles table
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id,email,role,created_at")
      .eq("id", user.id)
      .single();

    if (profileError || !profile) {
      setError("Could not load profile/role. Contact admin.");
      setSubmitting(false);
      return;
    }

    const role = (profile.role ?? "member") as Role;

    // 3) Redirect based on role
    if (role === "admin") {
      router.replace("/admin");
    } else {
      router.replace("/app"); // <- again, change if your viewer is elsewhere
    }

    setSubmitting(false);
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#020617",
        padding: "24px",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "420px",
          background: "#0b1120",
          borderRadius: "16px",
          padding: "32px 24px",
          boxShadow: "0 20px 40px rgba(0,0,0,0.6)",
          border: "1px solid rgba(148,163,184,0.4)",
        }}
      >
        <h1
          style={{
            color: "#e5e7eb",
            fontSize: "24px",
            fontWeight: 700,
            marginBottom: "8px",
            textAlign: "center",
          }}
        >
          Sign in to Black Truth TV
        </h1>
        <p
          style={{
            color: "#9ca3af",
            fontSize: "14px",
            textAlign: "center",
            marginBottom: "24px",
          }}
        >
          Use your email and password to continue.
        </p>

        {error && (
          <div
            style={{
              marginBottom: "16px",
              padding: "10px 12px",
              borderRadius: "8px",
              background: "rgba(248,113,113,0.1)",
              border: "1px solid rgba(248,113,113,0.6)",
              color: "#fecaca",
              fontSize: "13px",
            }}
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: "grid", gap: "16px" }}>
          <div>
            <label
              style={{
                display: "block",
                fontSize: "13px",
                color: "#e5e7eb",
                marginBottom: "6px",
              }}
            >
              Email
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={{
                width: "100%",
                padding: "10px 12px",
                borderRadius: "8px",
                border: "1px solid #4b5563",
                background: "#020617",
                color: "#e5e7eb",
                fontSize: "14px",
              }}
            />
          </div>

          <div>
            <label
              style={{
                display: "block",
                fontSize: "13px",
                color: "#e5e7eb",
                marginBottom: "6px",
              }}
            >
              Password
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{
                width: "100%",
                padding: "10px 12px",
                borderRadius: "8px",
                border: "1px solid #4b5563",
                background: "#020617",
                color: "#e5e7eb",
                fontSize: "14px",
              }}
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            style={{
              marginTop: "8px",
              width: "100%",
              padding: "10px 12px",
              borderRadius: "999px",
              border: "none",
              background:
                "linear-gradient(90deg, #f59e0b, #eab308, #facc15, #f97316)",
              color: "#111827",
              fontWeight: 700,
              fontSize: "14px",
              cursor: submitting ? "default" : "pointer",
              opacity: submitting ? 0.6 : 1,
            }}
          >
            {submitting ? "Signing in..." : "Sign In"}
          </button>
        </form>
      </div>
    </div>
  );
}
