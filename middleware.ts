// middleware.ts
import { NextRequest, NextResponse } from "next/server";
import { createMiddlewareClient } from "@supabase/auth-helpers-nextjs";
import { PROTECTED_CHANNELS } from "./lib/protected-channels";

const COOKIE_PREFIX = "channel_unlocked_";

export async function middleware(req: NextRequest) {
  // Let the Supabase helper attach/refresh cookies on the response if needed
  const res = NextResponse.next();
  const { pathname } = req.nextUrl;

  // Only guard /watch/:id routes
  if (!pathname.startsWith("/watch/")) return res;

  // 1) REQUIRE LOGIN for any /watch/*
  const supabase = createMiddlewareClient({ req, res });
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    const loginUrl = req.nextUrl.clone();
    loginUrl.pathname = "/auth/login";
    loginUrl.searchParams.set("redirect_to", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // 2) EXTRA PASSCODE for protected channels (23–29)
  const idStr = pathname.split("/")[2] ?? "";
  const id = Number.parseInt(idStr, 10);

  if (Number.isFinite(id) && PROTECTED_CHANNELS.has(id)) {
    const cookieName = `${COOKIE_PREFIX}${id}`;
    const unlocked = req.cookies.get(cookieName)?.value === "1";
    if (!unlocked) {
      const unlockUrl = req.nextUrl.clone();
      unlockUrl.pathname = `/unlock/${id}`;
      unlockUrl.searchParams.set("redirect_to", pathname); // <- use redirect_to
      return NextResponse.redirect(unlockUrl);
    }
  }

  return res;
}

export const config = {
  matcher: ["/watch/:path*"],
};
