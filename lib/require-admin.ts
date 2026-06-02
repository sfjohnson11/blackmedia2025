// lib/require-admin.ts
import { createClient } from "@/utils/supabase/server";

/**
 * Verifies the caller is a logged-in user with role === 'admin'.
 * Returns { ok: true, userId } on success, or { ok: false, status, error } to return directly.
 *
 * Usage in a route:
 *   const gate = await requireAdmin();
 *   if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });
 */
export async function requireAdmin(): Promise
  | { ok: true; userId: string }
  | { ok: false; status: number; error: string }
> {
  const supabase = await createClient();

  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) {
    return { ok: false, status: 401, error: "Not authenticated" };
  }

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("role")
    .eq("id", auth.user.id)
    .maybeSingle();

  if (profile?.role !== "admin") {
    return { ok: false, status: 403, error: "Forbidden" };
  }

  return { ok: true, userId: auth.user.id };
}
