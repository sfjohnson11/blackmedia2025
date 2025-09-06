// app/api/programs/route.ts
import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

// Simple header check (bearer token) to protect admin mutating calls
function isAdmin(req: Request) {
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  return token && token === process.env.ADMIN_TOKEN;
}

// GET /api/programs?channel_id=4&from=2025-09-01&to=2025-09-30
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const channel_id = searchParams.get("channel_id");
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  const db = getSupabaseAdmin();
  let q = db.from("programs")
    .select("id, channel_id, title, mp4_url, start_time, duration")
    .order("start_time", { ascending: true });

  if (channel_id) q = q.eq("channel_id", Number(channel_id));
  if (from) q = q.gte("start_time", from);
  if (to) q = q.lte("start_time", to);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ programs: data ?? [] });
}

// POST /api/programs  (admin)
// body: { channel_id, title, mp4_url, start_time, duration }
export async function POST(req: Request) {
  if (!isAdmin(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { channel_id, title, mp4_url, start_time, duration } = body;
  if (!channel_id || !mp4_url || !start_time || !duration) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const db = getSupabaseAdmin();
  const { data, error } = await db
    .from("programs")
    .insert([{ channel_id, title: title ?? null, mp4_url, start_time, duration }])
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ program: data });
}
