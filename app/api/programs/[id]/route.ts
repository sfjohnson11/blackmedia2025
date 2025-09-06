// app/api/programs/[id]/route.ts
import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

function isAdmin(req: Request) {
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  return token && token === process.env.ADMIN_TOKEN;
}

// PUT /api/programs/:id  body: partial fields to update
export async function PUT(req: Request, { params }: { params: { id: string } }) {
  if (!isAdmin(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const id = Number(params.id);
  if (!Number.isFinite(id)) return NextResponse.json({ error: "Bad id" }, { status: 400 });

  const patch = await req.json();
  const db = getSupabaseAdmin();
  const { data, error } = await db
    .from("programs")
    .update(patch)
    .eq("id", id)
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ program: data });
}

// DELETE /api/programs/:id
export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  if (!isAdmin(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const id = Number(params.id);
  if (!Number.isFinite(id)) return NextResponse.json({ error: "Bad id" }, { status: 400 });

  const db = getSupabaseAdmin();
  const { error } = await db.from("programs").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
