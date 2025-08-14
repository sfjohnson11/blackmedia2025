// app/auth/callback/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const redirectTo = url.searchParams.get("redirect_to") || "/watch/21";

  const supabase = createRouteHandlerClient({ cookies });
  if (code) {
    await supabase.auth.exchangeCodeForSession(code); // sets server auth cookie
  }
  return NextResponse.redirect(new URL(redirectTo, url.origin));
}

export async function POST(req: Request) {
  const { event, session } = await req.json().catch(() => ({} as any));
  const supabase = createRouteHandlerClient({ cookies });

  if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
    if (session?.access_token && session?.refresh_token) {
      await supabase.auth.setSession({
        access_token: session.access_token,
        refresh_token: session.refresh_token,
      });
    }
  } else if (event === "SIGNED_OUT") {
    await supabase.auth.signOut();
  }

  return NextResponse.json({ ok: true });
}
