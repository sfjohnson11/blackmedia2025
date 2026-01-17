import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const bucket = String(body?.bucket || "").trim();
    const path = String(body?.path || "").trim().replace(/^\/+/, "");

    if (!bucket || !path) {
      return NextResponse.json(
        { error: "bucket and path required" },
        { status: 400 }
      );
    }

    const { data, error } = await supabaseAdmin.storage
      .from(bucket)
      .createSignedUrl(path, 60 * 60); // 1 hour

    if (error || !data?.signedUrl) {
      return NextResponse.json(
        { error: error?.message || "sign failed" },
        { status: 400 }
      );
    }

    return NextResponse.json({ signedUrl: data.signedUrl }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "server error" },
      { status: 500 }
    );
  }
}
