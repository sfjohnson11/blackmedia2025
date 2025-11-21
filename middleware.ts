// middleware.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createMiddlewareClient } from "@supabase/auth-helpers-nextjs";

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();
  const supabase = createMiddlewareClient({ req, res });

  const {
    data: { session },
  } = await supabase.auth.getSession();

  const url = req.nextUrl.clone();
  const pathname = url.pathname;

  // Allow auth + static stuff without session
  const isAuthRoute = pathname.startsWith("/login") || pathname.startsWith("/auth");
  const isStaticAsset =
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.startsWith("/images") ||
    pathname.startsWith("/public");

  // If not logged in and not on login/auth/static → send to /login
  if (!session && !isAuthRoute && !isStaticAsset) {
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // If logged in and trying to hit /login, you *can* let your login page
  // redirect them to /admin or /app based on role, so we just pass through.
  return res;
}

// Apply to everything except Next internals
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
