import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { Database } from "@/types/supabase"; // if you don't have types, remove this import + typing

export async function requireAnyRole(required: string[]) {
  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies }
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, redirect: "/auth/login" };

  const { data: prof } = await supabase
    .from("user_profiles")
    .select("roles")
    .eq("id", user.id)
    .maybeSingle();

  const roles: string[] = Array.isArray(prof?.roles) ? (prof!.roles as string[]) : [];
  const ok = required.some(r => roles.includes(r));
  return { ok, redirect: ok ? null : "/auth/login?redirect_to=/admin/users" };
}
