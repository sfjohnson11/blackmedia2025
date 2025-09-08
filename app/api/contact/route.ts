// app/api/contact/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);
const CONTACT_TO = process.env.CONTACT_TO || "director@sfjfamilyservices.org";

// Helper: normalize/guard inputs
function sanitize(s?: string) {
  return (s ?? "").toString().trim();
}

export async function POST(req: Request) {
  try {
    const { name, email, subject, message, honeypot } = await req.json();

    // Basic anti-bot: if honeypot has content, pretend success.
    if (honeypot) {
      return NextResponse.json({ ok: true });
    }

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

    // 1) Save to Supabase (server-side client)
    const supabase = createRouteHandlerClient({ cookies });
    const { error: insertErr } = await supabase
      .from("contact_messages")
      .insert([{ name: _name, email: _email, subject: _subject, message: _message }]);

    if (insertErr) {
      // Log but don't fail the whole request — still try emailing.
      console.error("contact_messages insert error:", insertErr);
    }

    // 2) Send email via Resend
    const subj = `[Black Truth TV] ${_subject} — ${_name || "Viewer"}`;
    const text = [`From: ${_name || "Viewer"} <${_email}>`, "", _message].join("\n");

    const { error: emailErr } = await resend.emails.send({
      // Use Resend's default sender while you set up a verified domain:
      from: "Black Truth TV <onboarding@resend.dev>",
      to: CONTACT_TO,
      reply_to: _email,
      subject: subj,
      text,
    });

    if (emailErr) {
      console.error("Resend send error:", emailErr);
      return NextResponse.json(
        { ok: false, error: "Email failed to send" },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("Contact API error:", e);
    return NextResponse.json({ ok: false, error: "Server error" }, { status: 500 });
  }
}
