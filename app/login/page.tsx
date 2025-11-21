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

    // 1️⃣ Supabase auth: check email + password
    const { data, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError || !data.user) {
      // Human message for wrong login
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
        "We found your account, but your user ID is missing. Please contact the admin."
      );
      setSubmitting(false);
      return;
    }

    // 2️⃣ Try to load profile by UUID first
    let profile: UserProfile | null = null;

    const { data: profileById, error: profileErrorById } = await supabase
      .from("user_profiles")
      .select("id, email, role")
      .eq("id", user.id)
      .maybeSingle();

    if (profileErrorById) {
      console.error("Profile by id error:", profileErrorById);
    }

    if (profileById) {
      profile = profileById as UserProfile;
    }

    // 3️⃣ If not found by id, fall back to email (saves you if IDs aren't wired yet)
    if (!profile && user.email) {
      const { data: profileByEmail, error: profileErrorByEmail } =
        await supabase
          .from("user_profiles")
          .select("id, email, role")
          .eq("email", user.email)
          .maybeSingle();

      if (profileErrorByEmail) {
        console.error("Profile by email error:", profileErrorByEmail);
      }

      if (profileByEmail) {
        profile = profileByEmail as UserProfile;
      }
    }

    // 4️⃣ No profile at all → logged in but no app access
    if (!profile) {
      setError(
        "Your login is correct, but your profile is not set up. " +
          "Ask the admin to add you to the user_profiles table with a role."
      );
      setSubmitting(false);
      return;
    }

    // 5️⃣ Profile found but no role
    if (!profile.role) {
      setError(
        "Your login is correct, but no role is assigned to your account. " +
          "You need a role of admin or member. Please contact the admin."
      );
      setSubmitting(false);
      return;
    }

    const role = profile.role as Role;

    // 6️⃣ Route based on role from user_profiles
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
