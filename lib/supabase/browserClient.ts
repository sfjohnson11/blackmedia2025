// lib/supabase/browserClient.ts
"use client";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let _client: SupabaseClient | null = null;

export function getSupabaseBrowser(): SupabaseClient {
  if (_client) return _client;
  _client = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        storageKey: "sb-bttv-auth",
        persistSession: true,
        detectSessionInUrl: true,
        flowType: "pkce",
      },
    }
  );
  return _client;
}
