// lib/supabase/index.ts
"use client";

import { getSupabaseBrowser } from "./browserClient";

export const supabase = getSupabaseBrowser();
export { getSupabaseBrowser };
