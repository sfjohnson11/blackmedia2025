// middleware.ts
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

// For now, do NOT interfere with routing at all.
// Admin security is handled entirely by app/admin/layout.tsx.
export function middleware(_req: NextRequest) {
  return NextResponse.next();
}

// Optional: apply to all routes, but it's a no-op.
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
