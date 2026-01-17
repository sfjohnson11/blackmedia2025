import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

// ✅ MUST MATCH YOUR WATCH PAGE FLAG:
// watch page uses NEXT_PUBLIC_USE_SIGNED_MEDIA
function enabled() {
  return (
    String(process.env.NEXT_PUBLIC_USE_SIGNED_MEDIA || "false").toLowerCase() ===
    "true"
  );
}

function hasPaidAccess(profile: any) {
  const status = String(profile?.membership_status || "free")
    .toLowerCase()
    .trim();

  // paid members allowed
  if (status === "paid") return true;

  // ✅ grace allowed if set and still in future
  if (profile?.grace_until) {
    const graceUntil = new Date(profile.grace_until);
    if (new Date() < graceUntil) return true;
  }

  return false;
}

export async function POST(req: Request) {
  // If flag off, make it behave like it doesn't exist
  if (!enabled()) {
    return NextResponse.json({ error: "Signed media disabled" }, { status: 404 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const bucket = String(body?.bucket || "").trim();
    const path = String(body?.path || "").trim();

    if (!bucket || !path) {
      return NextResponse.json({ error: "Missing bucket/path" }, { status: 400 });
    }

    // ✅ Must be logged in
    const supabase = createRouteHandlerClient({ cookies });
    const { data: userData, error: userErr } = await supabase.auth.getUser();

    if (userErr || !userData?.user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    // ✅ Paywall check (admin bypass)
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

    if (!isAdmin && !hasPaidAccess(profile)) {
      return NextResponse.json({ error: "Payment required" }, { status: 402 });
    }

    // ✅ Sign using service role key
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const serviceKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

    if (!supabaseUrl || !serviceKey) {
      return NextResponse.json(
        { error: "Missing SUPABASE_SERVICE_ROLE_KEY" },
        { status: 500 }
      );
    }

    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // ✅ 5 minutes: links die fast
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
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      },
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Server error" },
      { status: 500 }
    );
  }
}
