// middleware.ts
import { NextRequest, NextResponse } from "next/server";
import { createMiddlewareClient } from "@supabase/auth-helpers-nextjs";
import { PROTECTED_CHANNELS } from "./lib/protected-channels";

const COOKIE_PREFIX = "channel_unlocked_";

export async function middleware(req: NextRequest) {
  // Let the Supabase helper attach/refresh cookies on the response if needed
  const res = NextResponse.next();

  // Only guard /watch/:id routes
  const { pathname, search } = req.nextUrl;
  if (!pathname.startsWith("/watch/")) return res;

  // ✅ IMPORTANT: pass your NEXT_PUBLIC_* keys so the middleware can see your project
  const supabase = createMiddlewareClient(
    { req, res },
    {
      supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL!,
      supabaseKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    }
  );

  // 1) REQUIRE LOGIN for any /watch/*
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    const loginUrl = new URL("/auth/login", req.url);
    // preserve the whole target (path + ?query)
    loginUrl.searchParams.set("redirect_to", pathname + (search || ""));
    return NextResponse.redirect(loginUrl);
  }

  // 2) EXTRA PASSCODE for protected channels (e.g., 23–29)
  const idStr = pathname.split("/")[2] ?? "";
  const id = Number.parseInt(idStr, 10);

  if (Number.isFinite(id) && PROTECTED_CHANNELS.has(id)) {
    const cookieName = `${COOKIE_PREFIX}${id}`;
    const unlocked = req.cookies.get(cookieName)?.value === "1";
    if (!unlocked) {
      const unlockUrl = new URL(`/unlock/${id}`, req.url);
      unlockUrl.searchParams.set("redirect_to", pathname + (search || ""));
      return NextResponse.redirect(unlockUrl);
    }
  }

  return res;
}

export const config = {
  matcher: ["/watch/:path*"],
};
