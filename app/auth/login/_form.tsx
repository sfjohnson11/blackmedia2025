// app/auth/login/_form.tsx
"use client";

import { useMemo, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export function LoginForm() {
  const searchParams = useSearchParams();
  const router = useRouter();

  // Only allow internal redirects
  const redirectTo = useMemo(() => {
    const p = searchParams?.get("redirect_to");
    return p && p.startsWith("/") ? p : "/";
  }, [searchParams]);

  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

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
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        if (data.session) {
          router.push(redirectTo);
          router.refresh();
          return;
        }
        setErr("Could not create a session. Try again.");
      } else {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${location.origin}/auth/callback?redirect_to=${encodeURIComponent(
              redirectTo
            )}`,
          },
        });
        if (error) throw error;

        if (data.session) {
          router.push(redirectTo);
          router.refresh();
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
          {mode === "signin" ? "Sign in to watch" : "Create your account"}
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
              <button type="button" onClick={() => setMode("signup")} className="text-red-400 hover:underline">
                Create an account
              </button>
            </>
          ) : (
            <>
              Already have an account?{" "}
              <button type="button" onClick={() => setMode("signin")} className="text-red-400 hover:underline">
                Sign in
              </button>
            </>
          )}
        </div>
      </form>
    </div>
  );
}

export default LoginForm;
