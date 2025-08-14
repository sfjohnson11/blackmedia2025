"use client";

import { useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export function LoginForm() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const redirectTo = searchParams?.get("redirect_to") || "/";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      setErr(error.message);
      return;
    }
    router.push(redirectTo);
    router.refresh();
  }

  return (
    <div className="min-h-screen bg-black flex items-center justify-center px-4">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-md bg-gray-900 border border-gray-800 rounded-lg p-6"
      >
        <h1 className="text-2xl font-bold mb-4">Sign in</h1>
        <label className="block mb-2 text-sm">Email</label>
        <input
          className="w-full mb-4 px-3 py-2 bg-gray-800 border border-gray-700 rounded"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="email"
        />
        <label className="block mb-2 text-sm">Password</label>
        <input
          className="w-full mb-4 px-3 py-2 bg-gray-800 border border-gray-700 rounded"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          autoComplete="current-password"
        />
        {err && <p className="text-sm text-red-400 mb-3">{err}</p>}
        <button
          disabled={loading}
          className="w-full bg-red-600 hover:bg-red-700 py-2 rounded disabled:opacity-50"
        >
          {loading ? "Signing in..." : "Sign in"}
        </button>
      </form>
    </div>
  );
}
