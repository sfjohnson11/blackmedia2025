import { NextRequest, NextResponse } from "next/server";
import { PASSCODES, PROTECTED_CHANNELS } from "@/lib/protected-channels";

const COOKIE_PREFIX = "channel_unlocked_";

export async function POST(req: NextRequest) {
  try {
    const { channelId, passcode } = await req.json();
    const id = Number.parseInt(String(channelId), 10);

    if (!Number.isFinite(id) || !PROTECTED_CHANNELS.has(id)) {
      return NextResponse.json({ ok: false, error: "Invalid channel" }, { status: 400 });
    }

    const expected = PASSCODES[id];
    if (!expected || passcode !== expected) {
      return NextResponse.json({ ok: false, error: "Invalid passcode" }, { status: 401 });
    }

    const res = NextResponse.json({ ok: true });
    res.cookies.set(`${COOKIE_PREFIX}${id}`, "1", {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 12, // 12 hours
    });
    return res;
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Bad request" }, { status: 400 });
  }
}
