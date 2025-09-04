import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  if (!url || !serviceRole) {
    return NextResponse.json({ error: "Missing SUPABASE env vars" }, { status: 500 });
  }
  const { searchParams } = new URL(req.url);
  const bucket = searchParams.get("bucket");
  const object = searchParams.get("object");
  const expires = Number(searchParams.get("expires") || 6 * 60 * 60);

  if (!bucket || !object) {
    return NextResponse.json({ error: "bucket and object are required" }, { status: 400 });
  }

  const admin = createClient(url, serviceRole, { auth: { persistSession: false } });
  const { data, error } = await admin.storage.from(bucket).createSignedUrl(object, expires);
  if (error || !data?.signedUrl) {
    return NextResponse.json({ error: error?.message || "Could not create signed URL" }, { status: 400 });
  }
  return NextResponse.json({ url: data.signedUrl });
}
