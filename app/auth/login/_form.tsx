// app/auth/login/_form.tsx
"use client";

import { useMemo, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type Role = "admin" | "student";

export default function LoginForm() {
  const searchParams = useSearchParams();
  const router = useRouter();

  // Default viewers to /watch if no redirect is present
  const redirectTo = useMemo(() => {
    const p = searchParams?.get("redirect_to");
    return p && p.startsWith("/") ? p : "/watch";
  }, [searchParams]);

  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  async function ensureProfile(userId: string, userEmail: string): Promise<Role> {
    // Try to read existing profile
    const { data: existing, error: selErr } = await supabase
      .from("user_profiles")
      .select("id, role")
      .eq("id", userId)
      .maybeSingle();

    if (selErr) throw new Error("Could not read user profile.");

    if (existing?.role) return existing.role as Role;

    // Create a default viewer profile
    const { error: insErr } = await supabase.from("user_profiles").insert({
      id: userId,
      email: userEmail,
      role: "student",
      created_at: new Date().toISOString(),
    });

    if (insErr) throw new Error("Could not create user profile.");
    return "student";
  }

  async function routeByRole(role: Role) {
    if (role === "admin") {
      router.push("/admin");
    } else {
      router.push(redirectTo || "/watch");
    }
    router.refresh();
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setMsg(null);

    if (!email || !password) {
      setErr("Please enter email and password.");
      return;
    }
    if (mode === "signup" && password !== confirm) {
      setErr("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      if (mode === "signin") {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (error) {
          const m = (error.message || "").toLowerCase();
          if (m.includes("invalid login credentials")) {
            throw new Error("Wrong email or password.");
          }
          throw error;
        }
        const user = data?.user;
        if (!user) throw new Error("Sign-in succeeded but no user returned.");

        // Ensure a profile exists and then route by role
        const role = await ensureProfile(user.id, user.email || email.trim());
        await routeByRole(role);
        return;
      } else {
        // SIGN UP
        const origin =
          typeof window !== "undefined"
            ? window.location.origin
            : process.env.NEXT_PUBLIC_SITE_URL || "";

        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            emailRedirectTo: `${origin}/auth/callback?redirect_to=${encodeURIComponent(
              redirectTo
            )}`,
          },
        });
        if (error) {
          const m = (error.message || "").toLowerCase();
          if (m.includes("user already registered")) {
            throw new Error("This email is already registered. Try signing in instead.");
          }
          throw error;
        }

        // If email confirmation is OFF, session exists now; otherwise ask to confirm
        if (data?.session?.user) {
          const role = await ensureProfile(data.session.user.id, data.session.user.email!);
          await routeByRole(role);
          return;
        }

        setMsg("Check your email to confirm your account, then sign in.");
      }
    } catch (e: any) {
      setErr(e?.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-black flex items-center justify-center px-4">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-md bg-gray-900 border border-gray-800 rounded-lg p-6"
      >
        <h1 className="text-2xl font-bold mb-4">
          {mode === "signin" ? "Sign in to Watch Black Truth TV" : "Create your account"}
        </h1>

        <label className="block mb-2 text-sm">Email</label>
        <input
          className="w-full mb-4 px-3 py-2 bg-gray-800 border border-gray-700 rounded"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="email"
          placeholder="you@example.com"
        />

        <label className="block mb-2 text-sm">
          {mode === "signin" ? "Password" : "Create password"}
        </label>
        <input
          className="w-full mb-4 px-3 py-2 bg-gray-800 border border-gray-700 rounded"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={6}
          autoComplete={mode === "signin" ? "current-password" : "new-password"}
          placeholder={mode === "signin" ? "Your password" : "At least 6 characters"}
        />

        {mode === "signup" && (
          <>
            <label className="block mb-2 text-sm">Confirm password</label>
            <input
              className="w-full mb-4 px-3 py-2 bg-gray-800 border border-gray-700 rounded"
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
              minLength={6}
              autoComplete="new-password"
              placeholder="Repeat your password"
            />
          </>
        )}

        {err && <p className="text-sm text-red-400 mb-3">{err}</p>}
        {msg && <p className="text-sm text-green-400 mb-3">{msg}</p>}

        <button
          disabled={loading}
          className="w-full bg-red-600 hover:bg-red-700 py-2 rounded disabled:opacity-50"
        >
          {loading ? "Please wait…" : mode === "signin" ? "Sign in" : "Create account"}
        </button>

        <div className="mt-4 text-sm text-gray-400">
          {mode === "signin" ? (
            <>
              New here?{" "}
              <button
                type="button"
                onClick={() => setMode("signup")}
                className="text-red-400 hover:underline"
              >
                Create an account
              </button>
            </>
          ) : (
            <>
              Already have an account?{" "}
              <button
                type="button"
                onClick={() => setMode("signin")}
                className="text-red-400 hover:underline"
              >
                Sign in
              </button>
            </>
          )}
        </div>
      </form>
    </div>
  );
}
