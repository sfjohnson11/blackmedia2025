// middleware.ts
import { NextRequest, NextResponse } from "next/server";
import { createMiddlewareClient } from "@supabase/auth-helpers-nextjs";
import { PROTECTED_CHANNELS } from "./lib/protected-channels";

const COOKIE_PREFIX = "channel_unlocked_";

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();
  const { pathname } = req.nextUrl;

  const supabase = createMiddlewareClient({ req, res });
  const {
    data: { session },
  } = await supabase.auth.getSession();

  // ---- Gate /freedom-school to students/admins
  if (pathname === "/freedom-school") {
    if (!session) {
      const loginUrl = req.nextUrl.clone();
      loginUrl.pathname = "/auth/login";
      loginUrl.searchParams.set("redirect_to", pathname);
      return NextResponse.redirect(loginUrl);
    }

    // NOTE: use id (NOT user_id)
    const { data: profile } = await supabase
      .from("user_profiles")
      .select("role")
      .eq("id", session.user.id)
      .maybeSingle();

    const role = profile?.role ?? null;
    if (!role || !["student", "admin"].includes(role)) {
      const deny = req.nextUrl.clone();
      deny.pathname = "/";
      deny.searchParams.set("error", "fs_access_denied");
      return NextResponse.redirect(deny);
    }
    return res;
  }

  // ---- Only guard /watch/*
  if (!pathname.startsWith("/watch/")) return res;

  // Require login for any /watch/*
  if (!session) {
    const loginUrl = req.nextUrl.clone();
    loginUrl.pathname = "/auth/login";
    loginUrl.searchParams.set("redirect_to", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Extra passcode for protected channels (23–29)
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

  return res;
}

export const config = {
  matcher: ["/watch/:path*", "/freedom-school"],
};
