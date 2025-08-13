import { NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";

export async function POST(req: Request) {
  const supabase = createRouteHandlerClient({ cookies });
  const { date, channelId } = (await req.json().catch(() => ({}))) as {
    date?: string;           // "YYYY-MM-DD" (UTC date)
    channelId?: string | number; // optional => apply to all when omitted
  };

  if (!date) {
    return NextResponse.json({ ok: false, error: "date is required" }, { status: 400 });
  }

  let count = 0;
  if (channelId) {
    const { data, error } = await supabase.rpc("apply_reschedule_channel_utc", {
      p_channel_id: String(channelId),
      p_date: date,
    });
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
    count = data ?? 0;
  } else {
    const { data, error } = await supabase.rpc("apply_reschedule_all_channels_utc", {
      p_date: date,
    });
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
    count = data ?? 0;
  }

  return NextResponse.json({ ok: true, updated: count });
}
