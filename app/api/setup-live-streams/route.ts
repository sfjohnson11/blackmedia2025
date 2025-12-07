// app/api/setup-live-streams/route.ts
// TEMP SAFE VERSION
// This endpoint used to create/manage live_streams in Supabase,
// but it's currently causing build failures. For now, we disable
// the heavy logic and return safe JSON responses so the app can build.

import { NextResponse } from "next/server";

// Make sure Next never tries to statically analyze this in a way that breaks the build
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    success: true,
    message: "Live streams setup endpoint is currently disabled (no-op).",
  });
}

export async function POST() {
  return NextResponse.json(
    {
      success: false,
      error: "Live streams setup endpoint is currently disabled. No changes were made.",
    },
    { status: 503 },
  );
}
