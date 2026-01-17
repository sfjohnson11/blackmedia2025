// middleware.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createMiddlewareClient } from "@supabase/auth-helpers-nextjs";

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();

  // Sync Supabase session cookie (safe)
  const supabase = createMiddlewareClient({ req, res });
  await supabase.auth.getSession();

  return res;
}

// ✅ IMPORTANT: do NOT run middleware on auth/login/api/static routes
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|login|auth|api).*)",
  ],
};
