// app/api/admin/stats/route.ts
import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/utils/supabase/server";

export async function GET() {
  const supabase = getSupabaseServerClient();

  const [ch, pr] = await Promise.all([
    supabase.from("channels").select("*", { count: "exact", head: true }),
    supabase.from("programs").select("*", { count: "exact", head: true }),
  ]);

  // If either returns an error, default counts to 0 so the admin page doesn't break
  return NextResponse.json({
    channelCount: ch?.count ?? 0,
    programCount: pr?.count ?? 0,
  });
}
