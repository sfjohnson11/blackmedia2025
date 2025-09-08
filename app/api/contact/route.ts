import { NextResponse } from "next/server";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);
const CONTACT_TO = process.env.CONTACT_TO || "director@sfjfamilyservices.org";

export async function POST(req: Request) {
  try {
    const { name, email, subject, message, honeypot } = await req.json();

    // basic bot/spam check
    if (honeypot) return NextResponse.json({ ok: true });

    if (!email || !subject || !message) {
      return NextResponse.json({ ok: false, error: "Missing fields" }, { status: 400 });
    }

    const subj = `[Black Truth TV] ${subject} — ${name || "Viewer"}`;
    const text = [
      `From: ${name || "Viewer"} <${email}>`,
      "",
      message,
    ].join("\n");

    const { error } = await resend.emails.send({
      from: "Black Truth TV <onboarding@resend.dev>", 
      // ⬆ you can replace with a domain email once verified in Resend
      to: CONTACT_TO,
      reply_to: email,
      subject: subj,
      text,
    });

    if (error) {
      console.error("Resend error:", error);
      return NextResponse.json({ ok: false, error: "Email failed" }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("Contact API error:", e);
    return NextResponse.json({ ok: false, error: "Server error" }, { status: 500 });
  }
}
