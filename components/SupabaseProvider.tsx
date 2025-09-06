// components/SupabaseProvider.tsx
"use client";

import { createContext, useContext, useMemo } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseBrowser } from "@/lib/supabase/browserClient";

const SupabaseCtx = createContext<SupabaseClient | null>(null);

export function SupabaseProvider({ children }: { children: React.ReactNode }) {
  const client = useMemo(() => getSupabaseBrowser(), []);
  return (
    <SupabaseCtx.Provider value={client}>{children}</SupabaseCtx.Provider>
  );
}

export function useSupabase() {
  const client = useContext(SupabaseCtx);
  if (!client) {
    throw new Error("useSupabase must be used inside <SupabaseProvider>");
  }
  return client;
}
