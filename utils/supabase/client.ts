// utils/supabase/client.ts
import { createClient } from "@supabase/supabase-js";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(URL, KEY);

// some parts of the app call this name
export function getSupabaseClient() {
  return supabase;
}

export default supabase;
