// app/login/page.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import { Button } from "@/components/ui/button";

export default function LoginPage() {
  const supabase = createClientComponentClient();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setLoading(true);

    try {
      // 1) Supabase email/password login
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        console.error("Login error", error);
        setErr(error.message);
        return;
      }

      const user = data.user;
      if (!user) {
        setErr("No user returned from Supabase.");
        return;
      }

      // 2) Look up role from user_profiles
      const { data: profile, error: profileError } = await supabase
        .from("user_profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();

      if (profileError) {
        console.error("Profile lookup error", profileError);
        setErr("Could not load your profile. Contact support.");
        return;
      }

      const role = profile?.role ?? "user";

      // 3) Route based on role
      if (role === "admin") {
        router.replace("/admin");
      } else {
        // regular viewers / students → main app
        router.replace("/");
      }
    } catch (e: any) {
      console.error("Unexpected login error", e);
      setErr(e?.message || "Unexpected error during login.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#040814] via-[#050b1a] to-black flex items-center justify-center px-4">
      <div className="w-full max-w-md rounded-xl border border-slate-800 bg-slate-900/80 p-6 shadow-xl">
        <h1 className="text-2xl font-bold text-white mb-1">
          Black Truth TV Login
        </h1>
        <p className="text-sm text-slate-300 mb-4">
          Sign in to manage channels, programs, or watch as a registered user.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full rounded-md border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-white focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400"
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full rounded-md border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-white focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400"
              placeholder="••••••••"
            />
          </div>

          {err && (
            <div className="rounded-md border border-red-500/60 bg-red-950/60 px-3 py-2 text-xs text-red-100">
              {err}
            </div>
          )}

          <Button
            type="submit"
            disabled={loading}
            className="w-full bg-amber-600 hover:bg-amber-700 text-sm font-semibold"
          >
            {loading ? "Signing in…" : "Sign In"}
          </Button>
        </form>

        <p className="mt-4 text-[11px] text-slate-400">
          Having trouble signing in? Make sure your email exists in{" "}
          <code className="text-amber-300">user_profiles</code> with the
          correct role.
        </p>
      </div>
    </div>
  );
}
