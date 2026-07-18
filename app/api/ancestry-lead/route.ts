// app/api/ancestry-lead/route.ts
// Public endpoint: captures email signups from the /ancestry page.
// Inserts server-side with the service-role key — the table has RLS
// enabled with no public policies, so this route is the only way in.

import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));

    // Honeypot: real users never fill this hidden field. Bots do.
    if (typeof body?.website === "string" && body.website.trim() !== "") {
      // Pretend success so bots don't retry.
      return NextResponse.json({ ok: true });
    }

    const email = String(body?.email ?? "").trim().toLowerCase();
    const firstName = String(body?.firstName ?? "").trim().slice(0, 80);

    if (!EMAIL_RE.test(email) || email.length > 254) {
      return NextResponse.json(
        { ok: false, error: "Please enter a valid email address." },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();
    const { error } = await supabase
      .from("ancestry_leads")
      .upsert(
        { email, first_name: firstName || null, source: "ancestry-tool" },
        { onConflict: "email", ignoreDuplicates: true }
      );

    if (error) {
      console.error("ancestry-lead insert error:", error.message);
      return NextResponse.json(
        { ok: false, error: "Something went wrong — please try again." },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("ancestry-lead route error:", e);
    return NextResponse.json(
      { ok: false, error: "Something went wrong — please try again." },
      { status: 500 }
    );
  }
}
