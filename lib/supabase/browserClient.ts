// lib/supabase/browserClient.ts
"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let _client: SupabaseClient | null = null;

/** Always return the same Supabase browser client */
export function getSupabaseBrowser(): SupabaseClient {
  if (_client) return _client;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  _client = createClient(url, key, {
    auth: {
      storageKey: "sb-bttv-auth",
      persistSession: true,
      detectSessionInUrl: true,
      flowType: "pkce",
    },
  });

  if (typeof window !== "undefined" && process.env.NODE_ENV !== "production") {
    (window as any).__SB_BTTB_CLIENTS__ =
      ((window as any).__SB_BTTB_CLIENTS__ || 0) + 1;
    if ((window as any).__SB_BTTB_CLIENTS__ > 1) {
      console.warn("⚠️ Supabase client created more than once in this app.");
    }
  }

  return _client;
}
