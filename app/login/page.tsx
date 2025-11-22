// app/login/page.tsx
"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";

type Role = "admin" | "member";

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClientComponentClient();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    // 1️⃣ Supabase email/password login
    const { data, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError || !data?.user) {
      console.error("Supabase login error:", authError);
      setError(authError?.message || "Login failed. Check your email and password.");
      setSubmitting(false);
      return;
    }

    const user = data.user;

    if (!user.email) {
      setError("This account has no email address. Contact the site admin.");
      setSubmitting(false);
      return;
    }

    // 2️⃣ Look up role in user_profiles (id first, then email)
    let role: Role = "member";

    try {
      // Try by id (UUID = auth UID)
      const { data: profileById, error: profileByIdError } = await supabase
        .from("user_profiles")
        .select("id, role, email")
        .eq("id", user.id)
        .maybeSingle();

      if (profileByIdError) {
        console.error("Error loading profile by id:", profileByIdError.message);
      }

      let finalRole: string | null = profileById?.role as string | null;

      // Fallback: by email
      if (!finalRole) {
        const { data: profileByEmail, error: profileByEmailError } = await supabase
          .from("user_profiles")
          .select("id, role, email")
          .eq("email", user.email)
          .maybeSingle();

        if (profileByEmailError) {
          console.error("Error loading profile by email:", profileByEmailError.message);
        }

        if (profileByEmail?.role) {
          finalRole = profileByEmail.role as string;
        }
      }

      // Normalize role
      if (finalRole) {
        const normalized = finalRole.toLowerCase().trim();
        role = normalized === "admin" ? "admin" : "member";
      } else {
        // No profile row found at all
        setError(
          "Your login is valid, but your profile is not set up yet. " +
            "Ask the site admin to add you to the user_profiles table with a role."
        );
        setSubmitting(false);
        return;
      }
    } catch (err: any) {
      console.error("Unexpected profile lookup error:", err);
      setError(
        "We logged you in, but there was an error reading your profile. " +
          "Please contact the site admin."
      );
      setSubmitting(false);
      return;
    }

    // 3️⃣ Route based on role
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
              fontSize: "13px",
            }}
          >
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
              color: "#fff",
              fontSize: "14px",
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
              fontSize: "14px",
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
              fontSize: "14px",
              cursor: submitting ? "wait" : "pointer",
              opacity: submitting ? 0.7 : 1,
            }}
          >
            {submitting ? "Signing in..." : "Sign In"}
          </button>
        </form>
      </div>
    </div>
  );
}
