// app/api/admin/stats/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = createRouteHandlerClient({ cookies });

  // 🔹 Adjust table names if yours are different
  const { count: channelCount, error: channelError } = await supabase
    .from("channels") // change to your channels table name if needed
    .select("*", { count: "exact", head: true });

  const { count: programCount, error: programError } = await supabase
    .from("programs")
    .select("*", { count: "exact", head: true });

  if (channelError || programError) {
    console.error("Admin stats error", { channelError, programError });
  }

  return NextResponse.json({
    channelCount: channelCount ?? 0,
    programCount: programCount ?? 0,
  });
}
