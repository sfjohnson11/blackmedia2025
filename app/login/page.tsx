// app/login/page.tsx
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
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // 🔐 SIGN IN (EXISTING USERS: ADMIN + MEMBERS)
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
      setErrorMsg(error?.message ?? "Invalid email or password.");
      setLoading(false);
      return;
    }

    const user = data.user;

    // 🔧 Load profile BY EMAIL (matches your user_profiles table)
    let role: string | null = null;

    if (user.email) {
      const { data: profileByEmail, error: emailError } = await supabase
        .from("user_profiles")
        .select("id, role, email")
        .eq("email", user.email)
        .maybeSingle();

      if (emailError) {
        console.error("Error loading profile by email:", emailError.message);
      }

      if (profileByEmail?.role) {
        role = String(profileByEmail.role);
      }
    }

    const finalRole = (role || "member").toLowerCase().trim();

    // If URL requested a specific redirect (like /admin), honor it
    if (redirectTo && redirectTo.startsWith("/")) {
      router.push(redirectTo);
      setLoading(false);
      return;
    }

    // ✅ ROUTING YOU SPECIFIED:
    // Admin → /admin
    // Member → /app (member hub)
    if (finalRole === "admin") {
      router.push("/admin");
    } else {
      router.push("/app");
    }

    setLoading(false);
  }

  // 🆕 SIGN UP NEW MEMBER (THIS IS WHERE THE DB ERROR COMES FROM)
  async function handleSignUp(e: FormEvent) {
    e.preventDefault();
    setErrorMsg(null);

    if (password !== confirmPassword) {
      setErrorMsg("Passwords do not match.");
      return;
    }

    setLoading(true);

    // 1️⃣ Create Supabase auth user (auth.users row → id is created here)
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error || !data.user) {
      console.error("Supabase signUp error:", error);
      setErrorMsg(error?.message ?? "Error creating account.");
      setLoading(false);
      return;
    }

    const user = data.user;

    // 2️⃣ Create or update user_profiles row
    // Your table columns: id, full_name, role, created_at, email,...
    // We fill full_name with "" so it never breaks a NOT NULL constraint.
    const { error: profileError } = await supabase
      .from("user_profiles")
      .upsert(
        {
          id: user.id,                     // auth user id (matches auth.uid())
          email: user.email ?? email,      // email column
          full_name: "",                   // safe default
          role: "member",                  // all self-signups are members
        },
        {
          onConflict: "id",                // if row exists → update instead of error
        }
      );

    if (profileError) {
      console.error("Profile upsert error:", profileError);
      setErrorMsg("Database error saving new user.");
      setLoading(false);
      return;
    }

    // 3️⃣ After signup, send them to login to sign in as a normal member
    router.push("/login");
    setLoading(false);
  }

  const onSubmit = mode === "signin" ? handleSignIn : handleSignUp;

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
          Sign in if you already have an account, or create a new member login.
        </p>

        {/* Toggle Sign In / Sign Up */}
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            gap: 8,
            marginBottom: 16,
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
              padding: "8px 0",
              borderRadius: 999,
              border: "1px solid rgba(248,250,252,0.2)",
              background:
                mode === "signin" ? "rgba(248,250,252,0.15)" : "transparent",
              color: "#f9fafb",
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
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
              padding: "8px 0",
              borderRadius: 999,
              border: "1px solid rgba(248,250,252,0.2)",
              background:
                mode === "signup" ? "rgba(248,250,252,0.15)" : "transparent",
              color: "#f9fafb",
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
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

        <form onSubmit={onSubmit} style={{ display: "grid", gap: 12 }}>
          {/* Email */}
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

          {/* Password */}
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

          {/* Confirm Password for Sign Up only */}
          {mode === "signup" && (
            <label style={{ fontSize: 13 }}>
              <span style={{ display: "block", marginBottom: 4 }}>
                Confirm Password
              </span>
              <input
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
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
          )}

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
