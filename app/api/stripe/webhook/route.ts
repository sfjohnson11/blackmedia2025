import Stripe from "stripe";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

function mustEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

const STRIPE_WEBHOOK_SECRET = mustEnv("STRIPE_WEBHOOK_SECRET");
const SUPABASE_URL = mustEnv("NEXT_PUBLIC_SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = mustEnv("SUPABASE_SERVICE_ROLE_KEY");

// server-only admin client (bypasses RLS)
const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// Stripe needs an instance to verify signatures; key not used for constructEvent
const stripe = new Stripe("sk_test_placeholder_not_used", {
  apiVersion: "2024-06-20",
});

function normalizeEmail(email: unknown): string | null {
  if (!email) return null;
  const s = String(email).trim().toLowerCase();
  return s.includes("@") ? s : null;
}

async function setMemberActiveByEmail(email: string) {
  const { error } = await supabaseAdmin
    .from("user_profiles")
    .update({
      membership_status: "active",
      grace_until: null,
    })
    .eq("email", email);

  if (error) throw new Error(`Supabase update failed: ${error.message}`);
}

export async function POST(req: Request) {
  try {
    const rawBody = await req.text();
    const sig = (await headers()).get("stripe-signature");

    if (!sig) {
      return NextResponse.json(
        { error: "Missing stripe-signature header" },
        { status: 400 }
      );
    }

    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(
        rawBody,
        sig,
        STRIPE_WEBHOOK_SECRET
      );
    } catch (err: any) {
      return NextResponse.json(
        {
          error: `Webhook signature verification failed: ${
            err?.message || "unknown error"
          }`,
        },
        { status: 400 }
      );
    }

    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;

      const email =
        normalizeEmail((session as any)?.customer_details?.email) ||
        normalizeEmail((session as any)?.customer_email) ||
        normalizeEmail((session as any)?.metadata?.email);

      if (!email) {
        return NextResponse.json(
          {
            ok: true,
            note: "No email found in checkout session; membership not updated.",
          },
          { status: 200 }
        );
      }

      await setMemberActiveByEmail(email);

      return NextResponse.json(
        { ok: true, updated: true, email, event_id: event.id },
        { status: 200 }
      );
    }

    return NextResponse.json(
      { ok: true, ignored: true, type: event.type },
      { status: 200 }
    );
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Webhook error" },
      { status: 500 }
    );
  }
}
