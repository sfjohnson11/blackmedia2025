// app/auth/login/_form.tsx
"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";

type Role = "admin" | "member" | "student";

export default function LoginForm() {
  const searchParams = useSearchParams();

  // Prefer the channel they clicked (middleware sets ?redirect_to=/watch/:id or /watch/freedom_school)
  const redirectTo = useMemo(() => {
    const p = searchParams?.get("redirect_to") || "";
    return p.startsWith("/") ? p : null;
  }, [searchParams]);

  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  async function ensureProfile(userId: string, userEmail: string): Promise<Role> {
    const read = await supabase
      .from("user_profiles")
      .select("id, email, role")
      .eq("id", userId)
      .maybeSingle();

    if (!read.error && read.data) {
      const role = (read.data.role as Role) || "student";
      if (!read.data.email) {
        await supabase.from("user_profiles").update({ email: userEmail }).eq("id", userId);
      }
      return role;
    }

    await supabase.from("user_profiles").upsert(
      { id: userId, email: userEmail, role: "student", created_at: new Date().toISOString() },
      { onConflict: "id" }
    );

    const reread = await supabase.from("user_profiles").select("role").eq("id", userId).maybeSingle();
    return (reread.data?.role as Role) || "student";
  }

  // Write server cookie so middleware sees auth immediately
  async function writeServerCookie() {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      await fetch("/auth/callback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ event: "SIGNED_IN", session }),
      });
    }
  }

  async function pickTarget(role: Role) {
    // back to clicked channel if provided
    if (redirectTo) return redirectTo;
    if (role === "admin") return "/admin";
    if (role === "student") return "/watch/freedom_school";
    return "/watch/21"; // member fallback if no redirect
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null); setMsg(null);

    if (!email || !password) return setErr("Please enter email and password.");
    if (mode === "signup" && password !== confirm) return setErr("Passwords do not match.");

    setLoading(true);
    try {
      if (mode === "signin") {
        const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) {
          const m = (error.message || "").toLowerCase();
          if (m.includes("invalid login credentials")) throw new Error("Wrong email or password.");
          throw error;
        }
        const user = data?.user;
        if (!user) throw new Error("Sign-in succeeded but no user returned.");

        const role = await ensureProfile(user.id, user.email || email.trim());
        await writeServerCookie();
        window.location.assign(await pickTarget(role));
        return;
      } else {
        const origin = typeof window !== "undefined" ? window.location.origin : process.env.NEXT_PUBLIC_SUPABASE_SITE_URL || "";
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            emailRedirectTo: `${origin}/auth/callback?redirect_to=${encodeURIComponent(redirectTo ?? "/watch/21")}`,
          },
        });
        if (error) {
          const m = (error.message || "").toLowerCase();
          if (m.includes("user already registered")) throw new Error("This email is already registered. Try signing in instead.");
          throw error;
        }
        if (data?.session?.user) {
          const role = await ensureProfile(data.session.user.id, data.session.user.email!);
          await writeServerCookie();
          window.location.assign(await pickTarget(role));
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
      <form onSubmit={onSubmit} className="w-full max-w-md bg-gray-900 border border-gray-800 rounded-lg p-6">
        <h1 className="text-2xl font-bold mb-4">{mode === "signin" ? "Sign in to Watch Black Truth TV" : "Create your account"}</h1>

        <label className="block mb-2 text-sm">Email</label>
        <input className="w-full mb-4 px-3 py-2 bg-gray-800 border border-gray-700 rounded" type="email"
               value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" placeholder="you@example.com" />

        <label className="block mb-2 text-sm">{mode === "signin" ? "Password" : "Create password"}</label>
        <input className="w-full mb-4 px-3 py-2 bg-gray-800 border border-gray-700 rounded" type="password"
               value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6}
               autoComplete={mode === "signin" ? "current-password" : "new-password"}
               placeholder={mode === "signin" ? "Your password" : "At least 6 characters"} />

        {mode === "signup" && (
          <>
            <label className="block mb-2 text-sm">Confirm password</label>
            <input className="w-full mb-4 px-3 py-2 bg-gray-800 border border-gray-700 rounded" type="password"
                   value={confirm} onChange={(e) => setConfirm(e.target.value)} required minLength={6}
                   autoComplete="new-password" placeholder="Repeat your password" />
          </>
        )}

        {err && <p className="text-sm text-red-400 mb-3">{err}</p>}
        {msg && <p className="text-sm text-green-400 mb-3">{msg}</p>}

        <button disabled={loading} className="w-full bg-red-600 hover:bg-red-700 py-2 rounded disabled:opacity-50" type="submit">
          {loading ? "Please wait…" : mode === "signin" ? "Sign in" : "Create account"}
        </button>

        <div className="mt-4 text-sm text-gray-400">
          {mode === "signin" ? (
            <>New here? <button type="button" onClick={() => setMode("signup")} className="text-red-400 hover:underline">Create an account</button></>
          ) : (
            <>Already have an account? <button type="button" onClick={() => setMode("signin")} className="text-red-400 hover:underline">Sign in</button></>
          )}
        </div>
      </form>
    </div>
  );
}
