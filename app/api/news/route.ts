import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";

// Table shape expected: a single row keyed by text 'global'
/*
create table if not exists site_news (
  key text primary key,
  items text[] not null default '{}',
  updated_at timestamptz not null default now()
);
insert into site_news(key, items) values ('global', '{}')
on conflict (key) do nothing;
*/

export async function GET() {
  const supabase = createRouteHandlerClient({ cookies });
  const { data, error } = await supabase
    .from("site_news")
    .select("items")
    .eq("key", "global")
    .maybeSingle();

  if (error) {
    // don't fail build – just return empty
    return NextResponse.json({ items: [] }, { status: 200 });
  }
  return NextResponse.json({ items: data?.items ?? [] });
}

export async function POST(req: Request) {
  const supabase = createRouteHandlerClient({ cookies });

  // must be signed in
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  // (Optional) check admin role from user_profiles
  const { data: profile } = await supabase
    .from("user_profiles")
    .select("role")
    .eq("id", auth.user.id)
    .maybeSingle();

  if (profile?.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({} as any));
  const items = Array.isArray(body.items) ? body.items.map(String) : [];

  const { error } = await supabase
    .from("site_news")
    .upsert({ key: "global", items });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
