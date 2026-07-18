import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/utils/supabase/middleware";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Debug and test pages are dev-only. Hide them in production so they
  // can't leak internals (RLS checks, video URLs, storage paths).
  if (
    process.env.NODE_ENV === "production" &&
    (pathname.startsWith("/debug") || pathname.startsWith("/test-video"))
  ) {
    return new NextResponse(null, { status: 404 });
  }

  return await updateSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
