// app/api/channel-access/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { COOKIE_PREFIX } from "@/lib/channel-access";

export async function POST(req: Request) {
  const { channelKey, passcode } = await req.json();
  if (!channelKey || !passcode) {
    return NextResponse.json({ ok: false, message: "Missing data" }, { status: 400 });
  }

  const supabase = createRouteHandlerClient({ cookies });

  const { data, error } = await supabase.rpc("verify_channel_passcode", {
    p_channel_key: channelKey,
    p_passcode: passcode,
  });

  if (error) {
    return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
  }

  const ok = !!data;
  const res = NextResponse.json({ ok });

  if (ok) {
    // Set cookie on the response (correct for Route Handlers)
    res.cookies.set(`${COOKIE_PREFIX}${channelKey}`, "1", {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 12, // 12 hours
    });
  }
  return res;
}
