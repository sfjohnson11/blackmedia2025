"use client";

import { useState, useEffect, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { loadProfileForEmail, type Role } from "@/lib/loadProfile";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // If already logged in, send them where user_profiles says they belong
  useEffect(() => {
    async function checkExistingSession() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user || !user.email) return;

      const profile = await loadProfileForEmail(user.email);
      if (!profile) return; // no profile row, stay on login

      const role: Role = (profile.role ?? "member") as Role;

      if (role === "admin") {
        router.replace("/admin");
      } else {
        router.replace("/app"); // change if your non-admin home is different
      }
    }

    checkExistingSession();
  }, [router]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    // 1) Sign in with Supabase auth
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

    if (!user.email) {
      setError("Your account is missing an email. Contact admin.");
      setSubmitting(false);
      return;
    }

    // 2) Look up this email in user_profiles
    const profile = await loadProfileForEmail(user.email);

    if (!profile) {
      setError(
        "Could not load profile/role from user_profiles. Make sure this email exists there with a role."
      );
      setSubmitting(false);
      return;
    }

    const role: Role = (profile.role ?? "member") as Role;

    // 3) Route based on role in user_profiles
    if (role === "admin") {
      router.replace("/admin");
    } else {
      router.replace("/app"); // change this if your regular users go somewhere else
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
