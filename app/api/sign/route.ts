import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireAdmin } from "@/lib/require-admin";

export const runtime = "nodejs";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

export async function POST(req: Request) {
  // 🔒 Admin only. This endpoint mints signed URLs with the service-role key,
  // so it must never be reachable by anonymous callers.
  const gate = await requireAdmin();
  if (!gate.ok) {
    return NextResponse.json({ error: gate.error }, { status: gate.status });
  }

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
