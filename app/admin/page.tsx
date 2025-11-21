// app/login/page.tsx
"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import {
  loadProfileByEmail,
  type Role,
  type UserProfile,
} from "@/lib/loadProfile";

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

    // 🔹 TRY user_profiles, fallback by email
    const profile: UserProfile | null = await loadProfileByEmail(user.email);
    let role: Role;

    if (profile && profile.role) {
      role = profile.role;
    } else {
      role = user.email === ADMIN_EMAIL ? "admin" : "member";
    }

    if (role === "admin") {
      router.replace("/admin");
    } else {
      router.replace("/app");
    }

    setSubmitting(false);
  }

  // ... keep the JSX for the form the same
}
