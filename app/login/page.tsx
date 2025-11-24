"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";

type Mode = "signin" | "signup";

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClientComponentClient();

  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function getRedirectParam(): string | null {
    if (typeof window === "undefined") return null;
    const params = new URLSearchParams(window.location.search);
    const redirect = params.get("redirect");
    if (redirect && redirect.startsWith("/")) return redirect;
    return null;
  }

  async function loadRoleAndRedirect() {
    const redirectTo = getRedirectParam();

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      // No session – default to member hub
      router.push("/app");
      return;
    }

    const user = session.user;
    let role: string | null = null;

    // Try by email
    if (user.email) {
      const { data: profileByEmail, error: emailError } = await supabase
        .from("user_profiles")
        .select("role")
        .eq("email", user.email)
        .maybeSingle();

      if (emailError) {
        console.error("Error loading profile by email:", emailError.message);
      }

      if (profileByEmail?.role) {
        role = String(profileByEmail.role);
      }
    }

    // Fallback: by id
    if (!role) {
      const { data: profileById, error: idError } = await supabase
        .from("user_profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();

      if (idError) {
        console.error("Error loading profile by id:", idError.message);
      }

      if (profileById?.role) {
        role = String(profileById.role);
      }
    }

    const finalRole = (role || "member").toLowerCase().trim();

    // 1️⃣ If ?redirect=/... exists, always honor it first
    if (redirectTo) {
      router.push(redirectTo);
      return;
    }

    // 2️⃣ Otherwise route by role
    if (finalRole === "admin") {
      router.push("/admin");
    } else {
      router.push("/app");
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);

    try {
      if (mode === "signin") {
        // =======================
        // EXISTING USER: SIGN IN
        // =======================
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error || !data.user) {
          setErrorMsg(error?.message ?? "Invalid email or password.");
          return;
        }

        await loadRoleAndRedirect();
      } else {
        // =======================
        // NEW USER: SIGN UP
        // =======================
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
        });

        if (error || !data.user) {
          setErrorMsg(error?.message ?? "Could not create account.");
          return;
        }

        // Immediately sign them in (some setups don't auto-login on signUp)
        const { error: loginError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (loginError) {
          console.error("Error signing in after sign-up:", loginError.message);
          setErrorMsg(
            "Account created, but automatic login failed. Please try signing in."
          );
          return;
        }

        // Now they’re logged in → send them to /app or /admin / redirect
        await loadRoleAndRedirect();
      }
    } finally {
      setLoading(false);
    }
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
          maxWidth: 440,
          background: "rgba(10,20,40,0.9)",
          borderRadius: 16,
          padding: "24px 22px 22px",
          boxShadow: "0 18px 45px rgba(0,0,0,0.65)",
          border: "1px solid rgba(255,255,255,0.08)",
        }}
      >
        <h1
          style={{
            fontSize: "1.8rem",
            fontWeight: 700,
            marginBottom: 4,
            textAlign: "center",
          }}
        >
          Black Truth TV Access
        </h1>
        <p
          style={{
            fontSize: 14,
            opacity: 0.8,
            textAlign: "center",
            marginBottom: 18,
          }}
        >
          {mode === "signin"
            ? "Sign in with your email and password."
            : "Create your member account to access the network."}
        </p>

        {/* Mode toggle */}
        <div
          style={{
            display: "flex",
            marginBottom: 16,
            borderRadius: 999,
            background: "rgba(15,23,42,0.9)",
            border: "1px solid rgba(148,163,184,0.5)",
            padding: 2,
          }}
        >
          <button
            type="button"
            onClick={() => {
              setMode("signin");
              setErrorMsg(null);
            }}
            style={{
              flex: 1,
              padding: "6px 8px",
              borderRadius: 999,
              border: "none",
              cursor: "pointer",
              fontSize: 13,
              fontWeight: 600,
              background:
                mode === "signin"
                  ? "linear-gradient(135deg,#FFD700,#fbbf24,#f97316)"
                  : "transparent",
              color: mode === "signin" ? "#111827" : "#e5e7eb",
            }}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => {
              setMode("signup");
              setErrorMsg(null);
            }}
            style={{
              flex: 1,
              padding: "6px 8px",
              borderRadius: 999,
              border: "none",
              cursor: "pointer",
              fontSize: 13,
              fontWeight: 600,
              background:
                mode === "signup"
                  ? "linear-gradient(135deg,#FFD700,#fbbf24,#f97316)"
                  : "transparent",
              color: mode === "signup" ? "#111827" : "#e5e7eb",
            }}
          >
            Sign Up
          </button>
        </div>

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

        <form onSubmit={handleSubmit} style={{ display: "grid", gap: 12 }}>
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
            {loading
              ? mode === "signin"
                ? "Signing in…"
                : "Creating account…"
              : mode === "signin"
              ? "Sign In"
              : "Sign Up"}
          </button>
        </form>
      </div>
    </div>
  );
}
