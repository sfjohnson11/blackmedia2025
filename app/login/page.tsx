// File: app/login/page.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg(null);
    setLoading(true);

    // 1️⃣ Sign in
    const {
      data: { user },
      error,
    } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error || !user) {
      setErrorMsg("Invalid email or password.");
      setLoading(false);
      return;
    }

    // 2️⃣ Look up role
    const { data: profile, error: profileError } = await supabase
      .from("user_profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    setLoading(false);

    if (profileError || !profile) {
      // No profile → treat as regular user
      router.push("/");
      return;
    }

    // 3️⃣ Route based on role
    if (profile.role === "admin") {
      router.push("/admin");
    } else {
      router.push("/");
    }
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#000",
        color: "#fff",
        fontFamily: "system-ui, -apple-system, Segoe UI, sans-serif",
        padding: "20px",
      }}
    >
      <form
        onSubmit={handleLogin}
        style={{
          width: "100%",
          maxWidth: "400px",
          background: "#0b1f3a",
          padding: "24px",
          borderRadius: "12px",
          boxShadow: "0 10px 30px rgba(0,0,0,0.6)",
        }}
      >
        <h1 style={{ marginBottom: "16px", fontSize: "1.8rem" }}>
          Black Truth TV Login
        </h1>
        <p style={{ marginBottom: "20px", fontSize: "0.9rem", color: "#d2e2ff" }}>
          Enter your email and password to access your account.
        </p>

        {errorMsg && (
          <div
            style={{
              marginBottom: "12px",
              padding: "10px",
              borderRadius: "8px",
              background: "#5b0000",
              color: "#ffe5e5",
              fontSize: "0.85rem",
            }}
          >
            {errorMsg}
          </div>
        )}

        <label style={{ display: "block", marginBottom: "8px", fontSize: "0.85rem" }}>
          Email
        </label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          style={{
            width: "100%",
            padding: "10px",
            marginBottom: "16px",
            borderRadius: "8px",
            border: "1px solid #334",
            background: "#111729",
            color: "#fff",
          }}
        />

        <label style={{ display: "block", marginBottom: "8px", fontSize: "0.85rem" }}>
          Password
        </label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          style={{
            width: "100%",
            padding: "10px",
            marginBottom: "20px",
            borderRadius: "8px",
            border: "1px solid #334",
            background: "#111729",
            color: "#fff",
          }}
        />

        <button
          type="submit"
          disabled={loading}
          style={{
            width: "100%",
            padding: "12px",
            borderRadius: "999px",
            border: "none",
            fontWeight: 600,
            cursor: "pointer",
            background:
              "linear-gradient(135deg, #FFD700 0%, #ffb300 40%, #ff8a00 100%)",
            color: "#000",
          }}
        >
          {loading ? "Signing in…" : "Sign In"}
        </button>
      </form>
    </div>
  );
}
