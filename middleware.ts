// middleware.ts
import { NextRequest, NextResponse } from "next/server";
import { PROTECTED_CHANNELS } from "./lib/protected-channels";

const COOKIE_PREFIX = "channel_unlocked_";

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Only gate /watch/:id
  if (!pathname.startsWith("/watch/")) return NextResponse.next();

  // Extract numeric id
  const parts = pathname.split("/");
  const idStr = parts[2];
  const id = Number.parseInt(idStr, 10);
  if (!Number.isFinite(id)) return NextResponse.next();

  if (!PROTECTED_CHANNELS.has(id)) {
    // Not protected → allow
    return NextResponse.next();
  }

  // Check cookie
  const cookieName = `${COOKIE_PREFIX}${id}`;
  const unlocked = req.cookies.get(cookieName)?.value === "1";
  if (unlocked) return NextResponse.next();

  // Redirect to unlock
  const url = req.nextUrl.clone();
  url.pathname = `/unlock/${id}`;
  url.searchParams.set("from", pathname); // return path after unlock
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/watch/:path*"],
};
