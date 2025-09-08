// middleware.ts
import { NextRequest, NextResponse } from "next/server";
import { createMiddlewareClient } from "@supabase/auth-helpers-nextjs";
import { PROTECTED_CHANNELS } from "./lib/protected-channels";

// ───────────────── Canonical Host Enforcement ─────────────────
// Set your production domains here. Example:
//   PRIMARY_HOST = "blackmedia2025.vercel.app"
//   CUSTOM_DOMAIN = "blacktruthtv.com" (if you have one)
const PRIMARY_HOST = "PRIMARY_HOST_HERE";          // ← REPLACE ME (required)
const CUSTOM_DOMAIN = "CUSTOM_DOMAIN_HERE";        // ← optional; leave "" if none

// If you use preview deployments and want to allow them, set to true:
const ALLOW_VERCEL_PREVIEWS = true;

// ───────────────── App Guards ─────────────────
const COOKIE_PREFIX = "channel_unlocked_";

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // 1) Canonical host redirect (prod only)
  //    This runs before any auth logic.
  if (process.env.NODE_ENV === "production") {
    const host = req.headers.get("host") || "";
    const isPrimary = host === PRIMARY_HOST;
    const isCustom = CUSTOM_DOMAIN && host === CUSTOM_DOMAIN;

    // (Optional) allow Vercel preview subdomains for this project
    const isVercelPreview = ALLOW_VERCEL_PREVIEWS && /\.vercel\.app$/i.test(host);

    if (!isPrimary && !isCustom && !isVercelPreview) {
      const url = new URL(req.url);
      url.host = PRIMARY_HOST; // always redirect to your primary domain
      return NextResponse.redirect(url, 308);
    }
  }

  // 2) Freedom School is PUBLIC (Option A)
  if (pathname === "/freedom-school") {
    return NextResponse.next();
  }

  // 3) Only guard /watch/*
  if (!pathname.startsWith("/watch/")) {
    return NextResponse.next();
  }

  // 4) Require login for any /watch/*
  const res = NextResponse.next(); // pass a response to supabase helper
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

  // 5) Extra passcode for protected channels (23–29)
  const idStr = pathname.split("/")[2] ?? "";
  const id = Number.parseInt(idStr, 10);

  if (Number.isFinite(id) && PROTECTED_CHANNELS.has(id)) {
    const cookieName = `${COOKIE_PREFIX}${id}`;
    const unlocked = req.cookies.get(cookieName)?.value === "1";
    if (!unlocked) {
      const unlockUrl = req.nextUrl.clone();
      unlockUrl.pathname = `/unlock/${id}`;
      unlockUrl.searchParams.set("redirect_to", pathname);
      return NextResponse.redirect(unlockUrl);
    }
  }

  // 6) Allow request through
  return res;
}

// We run middleware on (almost) everything so the canonical redirect works,
// but we skip Next.js internals and common static files.
export const config = {
  matcher: [
    "/((?!_next/|.*\\.(?:ico|png|jpg|jpeg|svg|gif|webp|mp4|txt|xml)|favicon.ico|robots.txt|sitemap.xml).*)",
  ],
};
