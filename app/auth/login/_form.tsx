// app/auth/login/_form.tsx
"use client";

import { useMemo, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type Role = "admin" | "membership1" | "membership2" | "student";

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

  // ---- tolerant profile ensure: read -> update/fix -> upsert fallback ----
  async function ensureProfile(userId: string, userEmail: string): Promise<Role[]> {
    // 1) Try to read existing profile
    const read = await supabase
      .from("user_profiles")
      .select("id, roles, email")
      .eq("id", userId)
      .maybeSingle();

    // If read worked and we have a row: normalize it
    if (!read.error && read.data) {
      const roles: string[] = Array.isArray(read.data.roles) ? read.data.roles : [];
      const needsStudent = !roles.includes("student");
      const needsEmail = !read.data.email;

      if (needsStudent || needsEmail) {
        const nextRoles = needsStudent ? [...roles, "student"] : roles;
        const { error: updErr } = await supabase
          .from("user_profiles")
          .update({ roles: nextRoles, email: read.data.email ?? userEmail })
          .eq("id", userId);

        if (updErr) {
          // If a strict RLS edge case blocked update, heal with UPSERT
          await supabase.from("user_profiles").upsert(
            {
              id: userId,
              email: userEmail,
              roles: nextRoles.length ? nextRoles : ["student"],
              created_at: new Date().toISOString(),
            },
            { onConflict: "id" }
          );
        }
        return (needsStudent ? [...roles, "student"] : roles) as Role[];
      }
      return (roles.length ? roles : ["student"]) as Role[];
    }

    // 2) If read failed (e.g., permission) or no row, create/fix via UPSERT
    await supabase.from("user_profiles").upsert(
      {
        id: userId,
        email: userEmail,
        roles: ["student"],
        created_at: new Date().toISOString(),
      },
      { onConflict: "id" }
    );

    // 3) Re-read; if still blocked, just default to ["student"]
    const reread = await supabase
      .from("user_profiles")
      .select("roles")
      .eq("id", userId)
      .maybeSingle();

    if (Array.isArray(reread.data?.roles) && reread.data!.roles.length) {
      return reread.data!.roles as Role[];
    }
    return ["student"];
  }

  async function routeByRoles(roles: Role[]) {
    if (roles.includes("admin")) {
      router.push("/admin");
    } else if (roles.includes("membership2")) {
      router.push("/watch/membership2");
    } else if (roles.includes("membership1")) {
      router.push("/watch/membership1");
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
          if (m.includes("invalid login credentials")) throw new Error("Wrong email or password.");
          throw error;
        }
        const user = data?.user;
        if (!user) throw new Error("Sign-in succeeded but no user returned.");

        const roles = await ensureProfile(user.id, user.email || email.trim());
        await routeByRoles(roles as Role[]);
        return;
      } else {
        const origin =
          typeof window !== "undefined"
            ? window.location.origin
            : process.env.NEXT_PUBLIC_SITE_URL || "";

        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            emailRedirectTo: `${origin}/auth/callback?redirect_to=${encodeURIComponent(redirectTo)}`,
          },
        });
        if (error) {
          const m = (error.message || "").toLowerCase();
          if (m.includes("user already registered")) {
            throw new Error("This email is already registered. Try signing in instead.");
          }
          throw error;
        }

        if (data?.session?.user) {
          const roles = await ensureProfile(data.session.user.id, data.session.user.email!);
          await routeByRoles(roles as Role[]);
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
