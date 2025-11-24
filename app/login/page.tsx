// app/login/page.tsx
"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";

type Mode = "signIn" | "signUp";

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClientComponentClient();

  const [mode, setMode] = useState<Mode>("signIn");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Read ?redirect=... (e.g. /watch/21 or /admin)
  function getRedirectParam(): string | null {
    if (typeof window === "undefined") return null;
    const params = new URLSearchParams(window.location.search);
    const redirectTo = params.get("redirect");
    if (redirectTo && redirectTo.startsWith("/")) return redirectTo;
    return null;
  }

  async function loadRoleAndRedirect() {
    const redirectTo = getRedirectParam();

    // Get fresh session
    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();

    if (sessionError || !session) {
      // If somehow no session, just send back to login
      router.push("/login");
      return;
    }

    const user = session.user;
    let role: string | null = null;

    // Try to load profile BY EMAIL (matches your table)
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

    // Default to member when no profile or no role
    const finalRole = (role || "member").toLowerCase().trim();

    // 1️⃣ If a redirect was requested (e.g. /watch/21), honor it
    if (redirectTo) {
      router.push(redirectTo);
      return;
    }

    // 2️⃣ Otherwise, route by role
    if (finalRole === "admin") {
      router.push("/admin");
    } else {
      // Member & brand-new users → Member Hub at /app
      router.push("/app");
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);

    try {
      if (mode === "signIn") {
        // 🔐 SIGN IN EXISTING USER
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error || !data.user) {
          setErrorMsg(error?.message ?? "Invalid email or password.");
          return;
        }

        // Use same redirect + role logic
        await loadRoleAndRedirect();
      } else {
        // ✨ SIGN UP NEW USER
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
        });

        if (error) {
          setErrorMsg(error.message || "Error creating account.");
          return;
        }

        // Make sure they are logged in after sign-up
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (signInError) {
          setErrorMsg(signInError.message || "Account created, but sign-in failed.");
          return;
        }

        // 🔁 NO insert into user_profiles here.
        // We just treat them as member by default if no profile row yet.
        await loadRoleAndRedirect();
      }
    } catch (err) {
      console.error("Auth error:", err);
      setErrorMsg("Something went wrong. Please try again.");
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
          maxWidth: 460,
          background: "rgba(10,20,40,0.92)",
          borderRadius: 16,
          padding: "24px 22px 22px",
          boxShadow: "0 18px 45px rgba(0,0,0,0.65)",
          border: "1px solid rgba(255,255,255,0.08)",
        }}
      >
        <h1
          style={{
            fontSize: "1.75rem",
            fontWeight: 700,
            marginBottom: 4,
            textAlign: "center",
          }}
        >
          Black Truth TV Access
        </h1>
        <p
          style={{
            fontSize: 13,
            opacity: 0.8,
            textAlign: "center",
            marginBottom: 16,
          }}
        >
          {mode === "signIn"
            ? "Sign in to the Member Hub or Admin Dashboard."
            : "Create your Black Truth TV member account."}
        </p>

        {/* Tabs */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            borderRadius: 999,
            background: "rgba(15,23,42,0.9)",
            padding: 3,
            marginBottom: 16,
          }}
        >
          <button
            type="button"
            onClick={() => setMode("signIn")}
            style={{
              border: "none",
              borderRadius: 999,
              padding: "6px 10px",
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
              background:
                mode === "signIn"
                  ? "linear-gradient(135deg, #FFD700 0%, #fbbf24 35%, #f97316 80%)"
                  : "transparent",
              color: mode === "signIn" ? "#111827" : "#e5e7eb",
            }}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => setMode("signUp")}
            style={{
              border: "none",
              borderRadius: 999,
              padding: "6px 10px",
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
              background:
                mode === "signUp"
                  ? "linear-gradient(135deg, #FFD700 0%, #fbbf24 35%, #f97316 80%)"
                  : "transparent",
              color: mode === "signUp" ? "#111827" : "#e5e7eb",
            }}
          >
            Sign Up
          </button>
        </div>

        {errorMsg && (
          <div
            style={{
              marginBottom: 14,
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
              ? mode === "signIn"
                ? "Signing in…"
                : "Creating account…"
              : mode === "signIn"
              ? "Sign In"
              : "Sign Up"}
          </button>
        </form>
      </div>
    </div>
  );
}
