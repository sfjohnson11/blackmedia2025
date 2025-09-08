// app/api/contact/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";

const CONTACT_TO = process.env.CONTACT_TO || "director@sfjfamilyservices.org";
const RESEND_API_KEY = process.env.RESEND_API_KEY || "";

// Helper: normalize/guard inputs
function sanitize(s?: string) {
  return (s ?? "").toString().trim();
}

export async function POST(req: Request) {
  try {
    const { name, email, subject, message, honeypot } = await req.json();

    // Basic anti-bot: if honeypot has content, pretend success.
    if (honeypot) return NextResponse.json({ ok: true });

    const _name = sanitize(name);
    const _email = sanitize(email);
    const _subject = sanitize(subject);
    const _message = sanitize(message);

    if (!_email || !_subject || !_message) {
      return NextResponse.json(
        { ok: false, error: "Missing fields" },
        { status: 400 }
      );
    }

    // 1) Save to Supabase
    const supabase = createRouteHandlerClient({ cookies });
    const { error: insertErr } = await supabase
      .from("contact_messages")
      .insert([{ name: _name, email: _email, subject: _subject, message: _message }]);

    if (insertErr) {
      // Log but don't fail the whole request — still try emailing.
      console.error("contact_messages insert error:", insertErr);
    }

    // 2) Send email via Resend HTTP API (no SDK)
    if (!RESEND_API_KEY) {
      console.warn("RESEND_API_KEY missing; skipping email send.");
    } else {
      const subj = `[Black Truth TV] ${_subject} — ${_name || "Viewer"}`;
      const text = [`From: ${_name || "Viewer"} <${_email}>`, "", _message].join("\n");

      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          // Use Resend’s onboarding sender until your domain is verified
          from: "Black Truth TV <onboarding@resend.dev>",
          to: CONTACT_TO,
          subject: subj,
          text,
          reply_to: _email,
        }),
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => "");
        console.error("Resend HTTP error:", res.status, errText);
        return NextResponse.json(
          { ok: false, error: "Email failed to send" },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("Contact API error:", e);
    return NextResponse.json({ ok: false, error: "Server error" }, { status: 500 });
  }
}
