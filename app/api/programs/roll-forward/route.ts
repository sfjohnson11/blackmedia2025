// app/api/programs/roll-forward/route.ts
import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

function isAdmin(req: Request) {
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  return token && token === process.env.ADMIN_TOKEN;
}

/**
 * POST /api/programs/roll-forward
 * body: {
 *   channel_id: number,
 *   from: "2025-09-01T00:00:00Z",
 *   to: "2025-09-09T23:59:59Z",
 *   add_days: number,             // e.g. 7
 *   replace_dates?: boolean       // optional: if true & target slot already has a program with same start_time, overwrite it
 * }
 */
export async function POST(req: Request) {
  const body = await req.json();
  if (!isAdmin(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { channel_id, from, to, add_days, replace_dates } = body || {};
  if (!channel_id || !from || !to || !add_days) {
    return NextResponse.json({ error: "channel_id, from, to, add_days required" }, { status: 400 });
  }

  const db = getSupabaseAdmin();

  // 1) fetch source window
  const { data: source, error: srcErr } = await db
    .from("programs")
    .select("id, channel_id, title, mp4_url, start_time, duration")
    .eq("channel_id", channel_id)
    .gte("start_time", from)
    .lte("start_time", to)
    .order("start_time", { ascending: true });

  if (srcErr) return NextResponse.json({ error: srcErr.message }, { status: 500 });

  // 2) build new rows with shifted start_time
  const addMs = Number(add_days) * 24 * 3600 * 1000;
  const toISO = (d: Date) => d.toISOString().replace(/\.\d{3}Z$/, "Z");
  const rows = (source ?? []).map((p) => {
    const start = new Date(p.start_time);
    const newStart = new Date(start.getTime() + addMs);
    return {
      channel_id,
      title: p.title,
      mp4_url: p.mp4_url,
      duration: p.duration,
      start_time: toISO(newStart),
    };
  });

  if (rows.length === 0) return NextResponse.json({ inserted: 0, programs: [] });

  // 3) optional replace: delete any existing rows that collide on start_time in target window
  if (replace_dates) {
    const minNew = rows[0].start_time;
    const maxNew = rows[rows.length - 1].start_time;
    const { error: delErr } = await db
      .from("programs")
      .delete()
      .eq("channel_id", channel_id)
      .gte("start_time", minNew)
      .lte("start_time", maxNew);
    if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 });
  }

  // 4) insert new rows
  const { data: inserted, error: insErr } = await db
    .from("programs")
    .insert(rows)
    .select("*")
    .order("start_time", { ascending: true });

  if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 });
  return NextResponse.json({ inserted: inserted?.length ?? 0, programs: inserted ?? [] });
}
