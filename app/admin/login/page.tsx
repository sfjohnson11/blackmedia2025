// app/admin/login/page.tsx
"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import { AlertCircle, Lock, Loader2 } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function AdminLoginPage() {
  const supabase = createClientComponentClient();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [errorMsg, setErrorMsg] = useState<string | null>(
    searchParams.get("error") === "not_admin"
      ? "You are not authorized as an admin."
      : null
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setErrorMsg(null);

    try {
      // 1) Sign in with Supabase Auth
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        setErrorMsg(error.message);
        return;
      }

      const user = data.user;
      if (!user) {
        setErrorMsg("Login failed — no user returned.");
        return;
      }

      // 2) Check user_profiles.role by email
      const { data: profile, error: profileError } = await supabase
        .from("user_profiles")
        .select("role, email")
        .eq("email", user.email)
        .maybeSingle();

      if (profileError || !profile || profile.role !== "admin") {
        await supabase.auth.signOut();
        setErrorMsg("You are not authorized as an admin.");
        return;
      }

      // 3) All good → enter admin dashboard
      router.push("/admin");
    } catch (err: any) {
      setErrorMsg(err?.message || "Unexpected login error.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#040814] via-[#050b1a] to-black text-white flex items-center justify-center px-4">
      <div className="w-full max-w-md border border-slate-700 bg-slate-900/80 rounded-xl p-6 shadow-xl">
        <div className="flex items-center gap-2 mb-4">
          <Lock className="h-5 w-5 text-amber-400" />
          <h1 className="text-xl font-semibold">Admin Login</h1>
        </div>

        {errorMsg && (
          <div className="mb-4 flex items-start gap-2 rounded-md border border-red-500/60 bg-red-950/60 px-3 py-2 text-xs text-red-100">
            <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
            <p>{errorMsg}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-200 mb-1">
              Admin Email
            </label>
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-md border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-white focus:border-amber-400 focus:ring-1 focus:ring-amber-400"
              placeholder="admin@example.com"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-200 mb-1">
              Password
            </label>
            <input
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-md border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-white focus:border-amber-400 focus:ring-1 focus:ring-amber-400"
              placeholder="••••••••"
            />
          </div>

          <Button
            type="submit"
            disabled={submitting}
            className="w-full bg-amber-600 hover:bg-amber-700 text-sm font-semibold"
          >
            {submitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Signing in…
              </>
            ) : (
              "Sign In as Admin"
            )}
          </Button>
        </form>

        <div className="mt-4 text-[11px] text-slate-400 text-center">
          <Link href="/" className="text-amber-300 hover:underline">
            ← Back to Black Truth TV
          </Link>
        </div>
      </div>
    </div>
  );
}
