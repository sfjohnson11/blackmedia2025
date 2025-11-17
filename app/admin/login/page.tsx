// app/admin/login/page.tsx
"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import { AlertCircle, Lock, Loader2, Mail } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function AdminLoginPage() {
  const supabase = createClientComponentClient();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [mode, setMode] = useState<"login" | "reset">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [errorMsg, setErrorMsg] = useState<string | null>(
    searchParams.get("error") === "not_admin"
      ? "You are not authorized as an admin."
      : null
  );
  const [infoMsg, setInfoMsg] = useState<string | null>(null);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setErrorMsg(null);
    setInfoMsg(null);

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

  async function handleReset(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setErrorMsg(null);
    setInfoMsg(null);

    try {
      if (!email) {
        setErrorMsg("Enter the admin email to reset the password.");
        return;
      }

      const origin =
        typeof window !== "undefined" ? window.location.origin : "";

      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${origin}/admin/login`,
      });

      if (error) {
        setErrorMsg(error.message);
        return;
      }

      setInfoMsg(
        "If that email exists, a reset link has been sent. Check your inbox."
      );
    } catch (err: any) {
      setErrorMsg(err?.message || "Unexpected reset error.");
    } finally {
      setSubmitting(false);
    }
  }

  const isLogin = mode === "login";

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#040814] via-[#050b1a] to-black text-white flex items-center justify-center px-4">
      <div className="w-full max-w-md border border-slate-700 bg-slate-900/80 rounded-xl p-6 shadow-xl">
        <div className="flex items-center gap-2 mb-4">
          <Lock className="h-5 w-5 text-amber-400" />
          <h1 className="text-xl font-semibold">
            {isLogin ? "Admin Login" : "Reset Admin Password"}
          </h1>
        </div>

        {(errorMsg || infoMsg) && (
          <div
            className={`mb-4 flex items-start gap-2 rounded-md px-3 py-2 text-xs ${
              errorMsg
                ? "border border-red-500/60 bg-red-950/60 text-red-100"
                : "border border-emerald-500/60 bg-emerald-950/50 text-emerald-100"
            }`}
          >
            <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
            <p>{errorMsg || infoMsg}</p>
          </div>
        )}

        <form
          onSubmit={isLogin ? handleLogin : handleReset}
          className="space-y-4"
        >
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

          {isLogin && (
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
          )}

          <Button
            type="submit"
            disabled={submitting}
            className="w-full bg-amber-600 hover:bg-amber-700 text-sm font-semibold"
          >
            {submitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {isLogin ? "Signing in…" : "Sending reset link…"}
              </>
            ) : isLogin ? (
              "Sign In as Admin"
            ) : (
              "Send Reset Link"
            )}
          </Button>
        </form>

        {/* Small actions under form */}
        <div className="mt-4 flex flex-col gap-2 text-[11px] text-slate-400">
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => {
                setErrorMsg(null);
                setInfoMsg(null);
                setMode(isLogin ? "reset" : "login");
              }}
              className="text-amber-300 hover:underline"
            >
              {isLogin ? "Forgot password?" : "← Back to admin login"}
            </button>

            {/* Admin invitation link */}
            <a
              href={`mailto:info@sfjohnsonconsulting.com?subject=Admin%20Access%20Request&body=Hi%20SFJ%2C%0D%0A%0D%0AI%20would%20like%20to%20request%20admin%20access%20to%20Black%20Truth%20TV.%0D%0A%0D%0AName%3A%0D%0AEmail%3A%0D%0AReason%20for%20access%3A%0D%0A`}
              className="inline-flex items-center gap-1 text-sky-300 hover:underline"
            >
              <Mail className="h-3 w-3" />
              Request admin invitation
            </a>
          </div>

          <div className="text-center">
            <Link href="/" className="text-amber-300 hover:underline">
              ← Back to Black Truth TV
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
