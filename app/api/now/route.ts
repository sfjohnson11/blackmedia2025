// app/api/now/route.ts
import { NextResponse } from "next/server";

export async function GET() {
  // Server-side epoch ms + ISO string.
  const now = Date.now();
  return NextResponse.json({
    epochMs: now,
    iso: new Date(now).toISOString(),
  });
}
