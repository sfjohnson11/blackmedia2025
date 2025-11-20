// middleware.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createMiddlewareClient } from "@supabase/auth-helpers-nextjs";

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();
  const { pathname, searchParams } = req.nextUrl;

  // 1️⃣ Public routes — DO NOT protect these
  if (
    pathname === "/login" ||
    pathname.startsWith("/_next") ||
    pathname === "/favicon.ico"
  ) {
    return res;
  }

  // 2️⃣ Check Supabase session
  const supabase = createMiddlewareClient({ req, res });
  const {
    data: { session },
  } = await supabase.auth.getSession();

  // 3️⃣ If NO session → send to /login?redirect=<original path>
  if (!session) {
    const loginUrl = req.nextUrl.clone();
    loginUrl.pathname = "/login";

    const query = searchParams.toString();
    const fullPath = pathname + (query ? `?${query}` : "");
    loginUrl.searchParams.set("redirect", fullPath || "/");

    return NextResponse.redirect(loginUrl);
  }

  // 4️⃣ Has session → allow request through
  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
