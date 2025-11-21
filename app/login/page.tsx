// app/login/page.tsx
"use client";

import { useState, useEffect, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import {
  loadProfileForUserId,
  type Role,
  type UserProfile,
} from "@/lib/loadProfile";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // If already logged in, route based on role in user_profiles
  useEffect(() => {
    async function checkExistingSession() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return;

      const profile = await loadProfileForUserId(user.id);
      if (!profile) return; // no profile row, stay on login

      const role: Role = (profile.role ?? "member") as Role;

      if (role === "admin") {
        router.replace("/admin");
      } else {
        router.replace("/app");
      }
    }

    checkExistingSession();
  }, [router]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    // 1) Sign in with Supabase auth
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

    // 2) Look up this user in user_profiles by auth user id
    const profile: UserProfile | null = await loadProfileForUserId(user.id);

    if (!profile) {
      setError(
        "Could not load profile/role from user_profiles. Make sure this auth user id exists there with a role."
      );
      setSubmitting(false);
      return;
    }

    const role: Role = (profile.role ?? "member") as Role;

    // 3) ONLY TWO BRANCHES, LIKE YOU SAID
    if (role === "admin") {
      router.replace("/admin");
    } else {
      router.replace("/app");
    }

    setSubmitting(false);
  }

  // ... keep your JSX/form UI the same below
}
