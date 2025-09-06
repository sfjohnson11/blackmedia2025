// lib/supabase/browserClient.ts
"use client";

import { createBrowserClient } from "@supabase/ssr";

let _client: ReturnType<typeof createBrowserClient> | null = null;

/** Always return the same Supabase browser client */
export function getSupabaseBrowser() {
  if (_client) return _client;

  _client = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        storageKey: "sb-bttv-auth", // unique to Black Truth TV
        persistSession: true,
        detectSessionInUrl: true,
      },
    }
  );

  // Debug guard: catch duplicate clients during dev
  if (typeof window !== "undefined" && process.env.NODE_ENV !== "production") {
    (window as any).__SB_BTTB_CLIENTS__ =
      ((window as any).__SB_BTTB_CLIENTS__ || 0) + 1;
    if ((window as any).__SB_BTTB_CLIENTS__ > 1) {
      console.warn("⚠️ Supabase client created more than once in this app.");
    }
  }

  return _client;
}
