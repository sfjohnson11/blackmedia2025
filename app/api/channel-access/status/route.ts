// app/api/channel-access/status/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";

const COOKIE_PREFIX = "channel_unlocked_";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const channelKey = url.searchParams.get("channelKey") || "";
  const allowed = cookies().get(`${COOKIE_PREFIX}${channelKey}`)?.value === "1";
  return NextResponse.json({ allowed });
}
