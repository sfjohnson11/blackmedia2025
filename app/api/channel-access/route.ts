import { NextResponse } from "next/server";
import { verifyAndGrantChannelAccess } from "@/lib/channelAccess";

export async function POST(req: Request) {
  const { channelKey, passcode } = await req.json();
  if (!channelKey || !passcode) {
    return NextResponse.json({ ok: false, message: "Missing data" }, { status: 400 });
  }
  try {
    const ok = await verifyAndGrantChannelAccess(channelKey, passcode);
    return NextResponse.json({ ok });
  } catch (e: any) {
    return NextResponse.json({ ok: false, message: e.message }, { status: 500 });
  }
}
