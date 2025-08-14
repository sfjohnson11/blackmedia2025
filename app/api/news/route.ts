import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!; // Server-only env var
const supabaseAdmin = createClient(url, serviceKey);

// GET: return all items (we’ll filter active client-side)
export async function GET() {
  const { data, error } = await supabaseAdmin
    .from("breaking_news")
    .select("id, content, is_active, sort_order, updated_at")
    .order("sort_order", { ascending: true });

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, items: data ?? [] });
}

// PUT: replace the list
export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const items = Array.isArray(body?.items) ? body.items : [];

    // Replace-all strategy for simplicity
    const { error: delErr } = await supabaseAdmin
      .from("breaking_news")
      .delete()
      .neq("id", "00000000-0000-0000-0000-000000000000");
    if (delErr) throw delErr;

    const rows = items
      .map((it: any, idx: number) => ({
        content: String(it.content ?? "").trim(),
        is_active: it.is_active === false ? false : true,
        sort_order: Number.isFinite(it.sort_order) ? it.sort_order : idx,
      }))
      .filter((r: any) => r.content.length > 0);

    if (rows.length === 0) {
      return NextResponse.json({ ok: true, items: [] });
    }

    const { data, error } = await supabaseAdmin
      .from("breaking_news")
      .insert(rows)
      .select("*")
      .order("sort_order", { ascending: true });
    if (error) throw error;

    return NextResponse.json({ ok: true, items: data });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Bad request" }, { status: 400 });
  }
}
