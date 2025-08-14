// lib/supabase-server.ts
import { createClient } from "@supabase/supabase-js";

/**
 * Create the service-role client lazily at runtime (not at module import).
 * This prevents build-time crashes when env vars aren't present.
 */
export function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    // Do NOT throw during module import. Throw only when actually used.
    throw new Error(
      "Missing Supabase env vars on server: " +
        `NEXT_PUBLIC_SUPABASE_URL=${Boolean(url)} SUPABASE_SERVICE_ROLE_KEY=${Boolean(serviceKey)}`
    );
  }

  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
