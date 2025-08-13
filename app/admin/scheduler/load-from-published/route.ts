import { NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";

// POST body: { channelId, day }
export async function POST(req: Request) {
  const supabase = createRouteHandlerClient({ cookies });
  const { channelId, day } = (await req.json().catch(() => ({}))) as { channelId?: string | number; day?: string };
  if (!channelId || !day) return NextResponse.json({ ok: false, error: "channelId and day are required" }, { status: 400 });

  const { data, error } = await supabase.rpc("copy_published_to_draft_day", {
    p_channel_id: String(channelId),
    p_day: day
  });

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true, copied: data ?? 0 });
}
