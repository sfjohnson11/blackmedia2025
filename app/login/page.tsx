// app/login/page.tsx
"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { loadProfileByEmail, type Role } from "@/lib/loadProfile";

const ADMIN_EMAIL = "info@sfjohnsonconsulting.com";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    const { data, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError || !data.user) {
      setError(authError?.message || "Login failed.");
      setSubmitting(false);
      return;
    }

    const user = data.user;

    if (!user.email) {
      setError("No email found on account.");
      setSubmitting(false);
      return;
    }

    const profile = await loadProfileByEmail(user.email);
    let role: Role;

    if (profile && profile.role) {
      role = profile.role;
    } else {
      role = user.email === ADMIN_EMAIL ? "admin" : "member";
    }

    router.replace(role === "admin" ? "/admin" : "/app");
    setSubmitting(false);
  }

  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      background: "#020617",
      padding: "24px"
    }}>
      <div style={{
        width: "100%",
        maxWidth: "400px",
        background: "#0f172a",
        padding: "32px",
        borderRadius: "12px",
        border: "1px solid #475569"
      }}>
        <h1 style={{ color: "#fff", textAlign: "center", marginBottom: "16px" }}>
          Black Truth TV Login
        </h1>

        {error && (
          <div style={{
            background: "#7f1d1d",
            color: "#fecaca",
            padding: "10px",
            borderRadius: "8px",
            marginBottom: "16px"
          }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: "grid", gap: "16px" }}>
          <input
            type="email"
            placeholder="Email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{
              padding: "12px",
              borderRadius: "8px",
              border: "1px solid #475569",
              background: "#020617",
              color: "#fff"
            }}
          />

          <input
            type="password"
            placeholder="Password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{
              padding: "12px",
              borderRadius: "8px",
              border: "1px solid #475569",
              background: "#020617",
              color: "#fff"
            }}
          />

          <button
            disabled={submitting}
            type="submit"
            style={{
              padding: "12px",
              borderRadius: "8px",
              background: "#fbbf24",
              color: "#000",
              fontWeight: "bold"
            }}
          >
            {submitting ? "Signing in..." : "Sign In"}
          </button>
        </form>
      </div>
    </div>
  );
}
