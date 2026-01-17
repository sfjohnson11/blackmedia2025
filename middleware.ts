// middleware.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createMiddlewareClient } from "@supabase/auth-helpers-nextjs";

function isPublicPath(pathname: string) {
  // Public routes (no auth required)
  return (
    pathname === "/" ||
    pathname.startsWith("/login") ||
    pathname.startsWith("/request-access") ||
    pathname.startsWith("/api") ||
    pathname.startsWith("/auth") // if you use supabase auth callbacks
  );
}

function isAssetPath(pathname: string) {
  // Never block media/static assets or you'll break playback
  return (
    pathname.startsWith("/_next") ||
    pathname === "/favicon.ico" ||
    pathname.endsWith(".mp4") ||
    pathname.endsWith(".m3u8") ||
    pathname.endsWith(".ts") ||
    pathname.endsWith(".jpg") ||
    pathname.endsWith(".jpeg") ||
    pathname.endsWith(".png") ||
    pathname.endsWith(".webp") ||
    pathname.endsWith(".gif") ||
    pathname.endsWith(".svg") ||
    pathname.endsWith(".css") ||
    pathname.endsWith(".js")
  );
}

function isAdminPath(pathname: string) {
  return pathname.startsWith("/admin");
}

function isProtectedAppPath(pathname: string) {
  // Everything inside your app/network should be gated
  // Add/remove prefixes here only (safe list)
  return (
    pathname.startsWith("/app") ||
    pathname.startsWith("/channels") ||
    pathname.startsWith("/watch") ||
    pathname.startsWith("/guide") ||
    pathname.startsWith("/freedom-school") ||
    pathname.startsWith("/on-demand") ||
    pathname.startsWith("/breaking-news") ||
    pathname.startsWith("/chat")
  );
}

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();
  const { pathname } = req.nextUrl;

  // Always allow assets & public routes
  if (isAssetPath(pathname) || isPublicPath(pathname)) {
    // Still sync session cookie (safe)
    const supabase = createMiddlewareClient({ req, res });
    await supabase.auth.getSession();
    return res;
  }

  // Create Supabase middleware client + sync cookie
  const supabase = createMiddlewareClient({ req, res });

  // Get session
  const {
    data: { session },
  } = await supabase.auth.getSession();

  // If user is not logged in and trying to access protected routes → send to login
  if (!session?.user && (isProtectedAppPath(pathname) || isAdminPath(pathname))) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirect", pathname);
    return NextResponse.redirect(url);
  }

  // If it's not a protected route, just continue
  if (!isProtectedAppPath(pathname) && !isAdminPath(pathname)) {
    return res;
  }

  // If logged in, load user profile to enforce paywall
  const userId = session?.user?.id;

  if (!userId) {
    // fallback (shouldn't happen)
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirect", pathname);
    return NextResponse.redirect(url);
  }

  // Pull membership status + grace + role
  const { data: profile, error } = await supabase
    .from("user_profiles")
    .select("role, membership_status, grace_until")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    // Fail open to avoid breaking the app if DB hiccups
    return res;
  }

  const role = String(profile?.role || "").toLowerCase().trim();
  const status = String(profile?.membership_status || "").toLowerCase().trim();
  const graceUntil = profile?.grace_until ? Date.parse(profile.grace_until) : NaN;

  // Admin always allowed
  if (role === "admin") return res;

  // Admin routes require admin
  if (isAdminPath(pathname) && role !== "admin") {
    const url = req.nextUrl.clone();
    url.pathname = "/app";
    return NextResponse.redirect(url);
  }

  // Membership check
  const inGrace = Number.isFinite(graceUntil) ? Date.now() < graceUntil : false;
  const isActive = status === "active";

  if (!isActive && !inGrace) {
    // Unpaid user trying to access protected pages → send to Member Hub paywall
    const url = req.nextUrl.clone();
    url.pathname = "/app";
    url.searchParams.set("paywall", "1");
    url.searchParams.set("redirect", pathname);
    return NextResponse.redirect(url);
  }

  // Allowed
  return res;
}

// Apply to all routes except Next.js internals/static
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
