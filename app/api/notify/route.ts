import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

// Example handlers; adjust or remove as needed
export async function GET() {
  return NextResponse.json({ ok: true });
}

export async function POST(req: Request) {
  // const body = await req.json();
  // Do read-only work here with `supabase`
  return NextResponse.json({ ok: true });
}
