import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

function hasAccess(profile: any) {
  // paid users allowed
  const status = String(profile?.membership_status || "free").toLowerCase();
  if (status === "paid") return true;

  // grace period allowed
  if (profile?.grace_until) {
    const graceUntil = new Date(profile.grace_until);
    if (new Date() < graceUntil) return true;
  }
  return false;
}

export async function POST(req: Request) {
  try {
    const { bucket, path } = await req.json();

    if (!bucket || !path) {
      return NextResponse.json({ error: "Missing bucket/path" }, { status: 400 });
    }

    // 1) Must be logged in
    const supabase = createRouteHandlerClient({ cookies });
    const { data: userData, error: userErr } = await supabase.auth.getUser();

    if (userErr || !userData?.user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    // 2) Load profile for access control
    const { data: profile, error: profErr } = await supabase
      .from("user_profiles")
      .select("id, role, membership_status, grace_until")
      .eq("id", userData.user.id)
      .maybeSingle();

    if (profErr) {
      return NextResponse.json({ error: profErr.message }, { status: 500 });
    }

    const role = String(profile?.role || "").toLowerCase().trim();
    const isAdmin = role === "admin";

    if (!isAdmin && !hasAccess(profile)) {
      return NextResponse.json({ error: "Payment required" }, { status: 402 });
    }

    // 3) Create signed URL using service role (server-only)
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

    if (!serviceKey) {
      return NextResponse.json(
        { error: "Missing SUPABASE_SERVICE_ROLE_KEY" },
        { status: 500 }
      );
    }

    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false },
    });

    // 5-minute expiration stops sharing
    const { data, error } = await admin.storage
      .from(bucket)
      .createSignedUrl(path, 60 * 5);

    if (error || !data?.signedUrl) {
      return NextResponse.json(
        { error: error?.message || "Could not sign URL" },
        { status: 500 }
      );
    }

    return new NextResponse(JSON.stringify({ signedUrl: data.signedUrl }), {
      status: 200,
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Server error" },
      { status: 500 }
    );
  }
}
