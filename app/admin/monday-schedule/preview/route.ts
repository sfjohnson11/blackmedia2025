import { NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";

export async function POST(req: Request) {
  const supabase = createRouteHandlerClient({ cookies });
  const { channelId, date } = (await req.json().catch(() => ({}))) as {
    channelId?: string | number;
    date?: string; // "YYYY-MM-DD" (UTC date)
  };

  if (!channelId || !date) {
    return NextResponse.json({ ok: false, error: "channelId and date are required" }, { status: 400 });
  }

  const { data, error } = await supabase.rpc("preview_reschedule_channel_utc", {
    p_channel_id: String(channelId),
    p_date: date,
  });

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true, rows: data ?? [] });
}
