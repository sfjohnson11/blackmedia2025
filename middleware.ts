// middleware.ts
import { NextRequest, NextResponse } from "next/server";
import { createMiddlewareClient } from "@supabase/auth-helpers-nextjs";
import { PROTECTED_CHANNELS } from "./lib/protected-channels";

const COOKIE_PREFIX = "channel_unlocked_";

function projectRefFromUrl(url?: string | null) {
  if (!url) return null;
  const m = url.match(/^https?:\/\/([^.]+)\.supabase\.co/i);
  return m?.[1] ?? null;
}

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();
  const { pathname, search } = req.nextUrl;

  // Only guard /watch/*
  if (!pathname.startsWith("/watch/")) return res;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  const supabase = createMiddlewareClient(
    { req, res },
    { supabaseUrl, supabaseKey }
  );

  // Try to refresh/resolve session
  const { data: { session } } = await supabase.auth.getSession();

  // Fallback: accept auth if we see the auth cookie even if session wasn't resolved yet
  const ref = projectRefFromUrl(supabaseUrl);
  const hasAuthCookie = ref ? Boolean(req.cookies.get(`sb-${ref}-auth-token`)) : false;
  const isAuthed = Boolean(session) || hasAuthCookie;

  if (!isAuthed) {
    const loginUrl = new URL("/auth/login", req.url);
    loginUrl.searchParams.set("redirect_to", pathname + (search || ""));
    return NextResponse.redirect(loginUrl);
  }

  // Extra passcode for protected channels
  const idStr = pathname.split("/")[2] ?? "";
  const asNumber = Number.parseInt(idStr, 10);
  if (Number.isFinite(asNumber) && PROTECTED_CHANNELS.has(asNumber)) {
    const cookieName = `${COOKIE_PREFIX}${asNumber}`;
    const unlocked = req.cookies.get(cookieName)?.value === "1";
    if (!unlocked) {
      const unlockUrl = new URL(`/unlock/${asNumber}`, req.url);
      unlockUrl.searchParams.set("redirect_to", pathname + (search || ""));
      return NextResponse.redirect(unlockUrl);
    }
  }

  return res;
}

export const config = {
  matcher: ["/watch/:path*"],
};
