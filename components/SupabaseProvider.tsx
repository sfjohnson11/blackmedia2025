// components/SupabaseProvider.tsx
"use client";

import { createContext, useContext, useMemo } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseBrowser } from "@/lib/supabase/browserClient";

const Ctx = createContext<SupabaseClient | null>(null);

export default function SupabaseProvider({ children }: { children: React.ReactNode }) {
  const client = useMemo(() => getSupabaseBrowser(), []);
  return <Ctx.Provider value={client}>{children}</Ctx.Provider>;
}

export function useSupabase(): SupabaseClient {
  const c = useContext(Ctx);
  if (!c) throw new Error("useSupabase must be used inside <SupabaseProvider>");
  return c;
}
