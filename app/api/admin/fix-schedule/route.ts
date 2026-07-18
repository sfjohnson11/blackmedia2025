// app/api/admin/fix-schedule/route.ts
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/require-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const gate = await requireAdmin();
  if (!gate.ok) {
    return NextResponse.json({ error: gate.error }, { status: gate.status });
  }

  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return new NextResponse("CRON_SECRET is not set in Vercel", { status: 500 });
  }

  const origin = new URL(req.url).origin;
  const res = await fetch(origin + "/api/cron/auto-extend", {
    headers: { authorization: "Bearer " + secret },
    cache: "no-store",
  });
  const data: any = await res.json().catch(() => ({}));

  const lines: string[] = [];
  lines.push("SCHEDULE FIX RESULT");
  lines.push(
    "Extended: " +
      (data.channels_extended ?? "?") +
      "   Errors: " +
      (data.channels_errored ?? "?")
  );
  lines.push("");
  for (const r of data.results || []) {
    lines.push(
      "Ch " + r.channelId + " " + r.channelName + " -> " + r.status + " | " + r.message
    );
  }
  return new NextResponse(lines.join("\n"), {
    status: res.status,
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
}
