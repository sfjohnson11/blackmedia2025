// app/login/page.tsx
"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClientComponentClient();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // IMPORTANT: your admin email from user_profiles
  const ADMIN_EMAIL = "info@sfjohnsonconsulting.com";

  async function handleSignIn(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);

    // Read ?redirect=/something (e.g. /admin)
    let redirectTo: string | null = null;
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      redirectTo = params.get("redirect");
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error || !data.user) {
      console.error("Supabase signIn error:", error);
      setErrorMsg(error?.message ?? "Invalid email or password.");
      setLoading(false);
      return;
    }

    const user = data.user;

    // 🔍 Load profile to determine role
    let role: string | null = null;

    // 1) Try by ID first (best with RLS: auth.uid() = id)
    const { data: profileById, error: idError } = await supabase
      .from("user_profiles")
      .select("id, role, email")
      .eq("id", user.id)
      .maybeSingle();

    if (idError) {
      console.error("Error loading profile by id:", idError.message);
    }

    if (profileById?.role) {
      role = String(profileById.role);
    }

    // 2) Fallback: try by email if still no role
    if (!role && user.email) {
      const { data: profileByEmail, error: emailError } = await supabase
        .from("user_profiles")
        .select("id, role, email")
        .eq("email", user.email)
        .maybeSingle();

      if (emailError) {
        console.error(
          "Error loading profile by email (fallback):",
          emailError.message
        );
      }

      if (profileByEmail?.role) {
        role = String(profileByEmail.role);
      }
    }

    // 3) FINAL SAFETY: hard-wire your admin email as admin
    if (!role && user.email === ADMIN_EMAIL) {
      role = "admin";
    }

    const finalRole = (role || "member").toLowerCase().trim();

    // If URL requested a specific redirect (like /admin), honor it
    if (redirectTo && redirectTo.startsWith("/")) {
      router.push(redirectTo);
      setLoading(false);
      return;
    }

    // ✅ YOUR RULE:
    // Admin → /admin
    // Member → /app
    if (finalRole === "admin") {
      router.push("/admin");
    } else {
      router.push("/app");
    }

    setLoading(false);
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background:
          "radial-gradient(circle at top, #1f3b73 0, #050816 55%, #000 100%)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
        color: "#fff",
        fontFamily: "system-ui, -apple-system, Segoe UI, sans-serif",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 420,
          background: "rgba(10,20,40,0.9)",
          borderRadius: 16,
          padding: "28px 24px 24px",
          boxShadow: "0 18px 45px rgba(0,0,0,0.65)",
          border: "1px solid rgba(255,255,255,0.08)",
        }}
      >
        <h1
          style={{
            fontSize: "1.75rem",
            fontWeight: 700,
            marginBottom: 6,
            textAlign: "center",
          }}
        >
          Black Truth TV Login
        </h1>
        <p
          style={{
            fontSize: 14,
            opacity: 0.8,
            textAlign: "center",
            marginBottom: 18,
          }}
        >
          Sign in with your email and password.
        </p>

        {errorMsg && (
          <div
            style={{
              marginBottom: 16,
              padding: "10px 12px",
              borderRadius: 8,
              background: "rgba(127,29,29,0.2)",
              border: "1px solid rgba(248,113,113,0.5)",
              fontSize: 13,
            }}
          >
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSignIn} style={{ display: "grid", gap: 12 }}>
          <label style={{ fontSize: 13 }}>
            <span style={{ display: "block", marginBottom: 4 }}>Email</span>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={{
                width: "100%",
                padding: "9px 10px",
                borderRadius: 8,
                border: "1px solid rgba(148,163,184,0.7)",
                background: "rgba(15,23,42,0.9)",
                color: "#fff",
                fontSize: 14,
              }}
            />
          </label>

          <label style={{ fontSize: 13 }}>
            <span style={{ display: "block", marginBottom: 4 }}>Password</span>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{
                width: "100%",
                padding: "9px 10px",
                borderRadius: 8,
                border: "1px solid rgba(148,163,184,0.7)",
                background: "rgba(15,23,42,0.9)",
                color: "#fff",
                fontSize: 14,
              }}
            />
          </label>

          <button
            type="submit"
            disabled={loading}
            style={{
              marginTop: 8,
              padding: "10px 12px",
              borderRadius: 999,
              border: "none",
              cursor: loading ? "default" : "pointer",
              background:
                "linear-gradient(135deg, #FFD700 0%, #fbbf24 35%, #f97316 80%)",
              color: "#111827",
              fontWeight: 700,
              fontSize: 14,
              textTransform: "uppercase",
              letterSpacing: 0.06,
              boxShadow: "0 10px 25px rgba(180,83,9,0.5)",
            }}
          >
            {loading ? "Signing in…" : "Sign In"}
          </button>
        </form>
      </div>
    </div>
  );
}
