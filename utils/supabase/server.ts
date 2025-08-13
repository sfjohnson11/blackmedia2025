// utils/supabase/server.ts
import { cookies, headers } from "next/headers";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

export function getSupabaseServerClient() {
  const cookieStore = cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          // Next.js server environment cannot set cookies here in route handlers;
          // If you need to set cookies, do so in a Route Handler using NextResponse.
        },
        remove(name: string, options: CookieOptions) {
          // same caveat as set()
        },
      },
      headers: {
        // Forward headers if needed for RLS on server requests
        // Useful when using Auth helpers
        get(key: string) {
          return headers().get(key) ?? undefined;
        },
      },
    }
  );
}
