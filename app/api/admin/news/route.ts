// app/api/admin/news/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export const dynamic = "force-dynamic";

// GET — return all ticker items, newest first
export async function GET() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("news_ticker")
    .select("id, text, created_at")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ items: [] }, { status: 200 });
  }

  // Shape the response to match what NewsTicker.tsx expects: items[].message
  const items = (data ?? []).map((row) => ({
    id: row.id,
    message: row.text,
  }));

  return NextResponse.json({ items });
}

// POST — admin-only, add a new ticker item
export async function POST(req: Request) {
  const supabase = await createClient();

  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("role")
    .eq("id", auth.user.id)
    .maybeSingle();

  if (profile?.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const text = String(body?.text ?? "").trim();
  if (!text) {
    return NextResponse.json({ error: "Text required" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("news_ticker")
    .insert({ text })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({
    ok: true,
    item: { id: data.id, message: data.text },
  });
}

// DELETE — admin-only, remove an item by id (passed as ?id=...)
export async function DELETE(req: Request) {
  const supabase = await createClient();

  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("role")
    .eq("id", auth.user.id)
    .maybeSingle();

  if (profile?.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  const { error } = await supabase.from("news_ticker").delete().eq("id", id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
