// app/login/page.tsx
"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type Role = "admin" | "member";

type UserProfile = {
  id: string;
  email: string | null;
  role: Role | null;
};

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

    // 1️⃣ Supabase auth verifies email + password
    const { data, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError || !data.user) {
      // Human-friendly auth errors
      if (authError?.message?.toLowerCase().includes("invalid login")) {
        setError("Your email or password is incorrect. Please try again.");
      } else {
        setError(
          "We could not log you in. Please check your email and password and try again."
        );
      }
      setSubmitting(false);
      return;
    }

    const user = data.user;

    if (!user.id) {
      setError(
        "We found your account, but your user ID is missing. Please contact support."
      );
      setSubmitting(false);
      return;
    }

    // 2️⃣ Fetch profile by Supabase UUID (auth.users.id)
    const { data: profile, error: profileError } = await supabase
      .from("user_profiles")
      .select("id, email, role")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) {
      console.error("Profile error:", profileError);
      setError(
        "Your login is correct, but we could not load your profile. " +
          "This usually means your membership is not fully set up. Please contact the admin."
      );
      setSubmitting(false);
      return;
    }

    if (!profile) {
      setError(
        "Your login is correct, but your profile is missing. " +
          "Ask the admin to add your account to the user_profiles table."
      );
      setSubmitting(false);
      return;
    }

    if (!profile.role) {
      setError(
        "Your login is correct, but no role is assigned to your account. " +
          "You need a role of admin or member to continue. Please contact the admin."
      );
      setSubmitting(false);
      return;
    }

    const role = profile.role as Role;

    // 3️⃣ Route based on role from user_profiles
    if (role === "admin") {
      router.replace("/admin");
    } else {
      router.replace("/app");
    }

    setSubmitting(false);
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        background: "#020617",
        padding: "24px",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "400px",
          background: "#0f172a",
          padding: "32px",
          borderRadius: "12px",
          border: "1px solid #475569",
        }}
      >
        <h1
          style={{
            color: "#fff",
            textAlign: "center",
            marginBottom: "16px",
          }}
        >
          Black Truth TV Login
        </h1>

        {error && (
          <div
            style={{
              background: "#7f1d1d",
              color: "#fecaca",
              padding: "10px",
              borderRadius: "8px",
              marginBottom: "16px",
              whiteSpace: "pre-wrap",
            }}
          >
            {error}
          </div>
        )}

        <form
          onSubmit={handleSubmit}
          style={{ display: "grid", gap: "16px" }}
        >
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
              color: "#fff",
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
              color: "#fff",
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
              fontWeight: "bold",
            }}
          >
            {submitting ? "Signing in..." : "Sign In"}
          </button>
        </form>
      </div>
    </div>
  );
}
