// middleware.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(req: NextRequest) {
  // 🔥 DO NOTHING. NO AUTH CHECKS IN MIDDLEWARE.
  // Login, admin logic, redirects ALL handled in pages, not here.
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
