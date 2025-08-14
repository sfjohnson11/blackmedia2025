// app/api/notify/route.ts
export const runtime = "nodejs"; // ensure Node runtime so process.env is available

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { getSupabaseAdmin } from "@/lib/supabase-server";

type Payload =
  | { scope: "all"; title: string; body?: string; link?: string; type?: string; channel_id?: string }
  | { scope: "role"; role: "admin" | "member" | "student"; title: string; body?: string; link?: string; type?: string; channel_id?: string }
  | { scope: "emails"; emails: string[]; title: string; body?: string; link?: string; type?: string; channel_id?: string };

export async function POST(req: Request) {
  try {
    // 1) Auth (uses anon key & url from env — make sure those are set too)
    const cookieStore = cookies();
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore });
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // 2) Admin check
    const { data: prof, error: profErr } = await supabase
      .from("user_profiles")
      .select("role")
      .eq("user_id", user.id)
      .single();

    if (profErr || prof?.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // 3) Parse payload
    const payload = (await req.json()) as Payload;
    if (!("title" in payload) || !payload.title?.trim()) {
      return NextResponse.json({ error: "Missing title" }, { status: 400 });
    }
    const title = payload.title.trim();
    const body = "body" in payload && payload.body ? String(payload.body) : null;
    const link = "link" in payload && payload.link ? String(payload.link) : null;
    const type = "type" in payload && payload.type ? String(payload.type) : "info";
    const channel_id = "channel_id" in payload && payload.channel_id ? String(payload.channel_id) : null;

    // 4) Create admin client lazily (at request time)
    const supabaseAdmin = getSupabaseAdmin();

    // 5) Resolve recipients with service role (bypasses RLS)
    let userIds: string[] = [];
    if (payload.scope === "all") {
      const { data, error } = await supabaseAdmin.from("user_profiles").select("user_id");
      if (error) throw error;
      userIds = (data ?? []).map((r: any) => r.user_id);
    } else if (payload.scope === "role") {
      const { data, error } = await supabaseAdmin.from("user_profiles").select("user_id").eq("role", payload.role);
      if (error) throw error;
      userIds = (data ?? []).map((r: any) => r.user_id);
    } else if (payload.scope === "emails") {
      const emails = (payload.emails || []).map((e) => e.trim()).filter(Boolean);
      if (emails.length === 0) return NextResponse.json({ error: "No emails provided" }, { status: 400 });
      const { data, error } = await supabaseAdmin
        .from("user_profiles")
        .select("user_id, email")
        .in("email", emails);
      if (error) throw error;
      userIds = (data ?? []).map((r: any) => r.user_id);
    }

    userIds = Array.from(new Set(userIds));
    if (userIds.length === 0) return NextResponse.json({ inserted: 0, note: "No recipients matched" });

    // 6) Insert notifications
    const rows = userIds.map((uid) => ({ user_id: uid, type, title, body, link, channel_id }));
    const { error: insErr } = await supabaseAdmin.from("user_notifications").insert(rows, { returning: "minimal" });
    if (insErr) throw insErr;

    return NextResponse.json({ inserted: rows.length });
  } catch (e: any) {
    // Clear, actionable error when envs are missing
    if (String(e?.message || "").includes("Missing Supabase env vars")) {
      return NextResponse.json(
        {
          error:
            "SUPABASE_SERVICE_ROLE_KEY (and/or NEXT_PUBLIC_SUPABASE_URL) missing on server. " +
            "Add them in Vercel → Project → Settings → Environment Variables, then redeploy.",
        },
        { status: 500 }
      );
    }
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}
