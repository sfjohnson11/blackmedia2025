// lib/supabase-server.ts
// Stubbed out: we don't use a service role in this app.
// This keeps builds from failing if an old import still exists.

export function getSupabaseAdmin() {
  throw new Error(
    "getSupabaseAdmin is not configured (service role not used in this app)."
  );
}
