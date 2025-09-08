// app/contact/page.tsx
"use client";

import type React from "react";
import { useMemo, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  Mail,
  Send,
  CheckCircle2,
  Shield,
  Clock,
  Info,
  Phone,
} from "lucide-react";

const CONTACT_EMAIL = "director@sfjfamilyservices.org";
const BRAND_LOGO =
  "https://msllqpnxwbugvkpnquwx.supabase.co/storage/v1/object/public/brand/blacktruth1.jpeg";

type SubjectKey =
  | "general"
  | "support"
  | "content"
  | "copyright"
  | "password"
  | "other";

function subjectLabel(v: SubjectKey | string) {
  switch (v) {
    case "general":
      return "General Inquiry";
    case "support":
      return "Technical Support";
    case "content":
      return "Content Request";
    case "copyright":
      return "Copyright Question";
    case "password":
      return "Channel Password";
    case "other":
      return "Other";
    default:
      return "General Inquiry";
  }
}

export default function ContactPage() {
  const [formState, setFormState] = useState({
    name: "",
    email: "",
    subject: "" as SubjectKey | "",
    message: "",
    honeypot: "", // hidden anti-bot
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const mailtoHref = useMemo(() => {
    const subjText = `[Black Truth TV] ${subjectLabel(formState.subject || "general")} — ${
      formState.name || "Viewer"
    }`;
    const bodyLines = [
      formState.message || "",
      "",
      "—",
      `From: ${formState.name || "Viewer"} <${formState.email || "no-email-provided"}>`,
    ];
    return `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(
      subjText
    )}&body=${encodeURIComponent(bodyLines.join("\n"))}`;
  }, [formState]);

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) {
    const { name, value } = e.target;
    setFormState((prev) => ({ ...prev, [name]: value }));
  }

  // ✅ NEW: post to /api/contact (saves to Supabase + sends email)
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);
    setIsSubmitted(false);

    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formState.name,
          email: formState.email,
          subject: subjectLabel(formState.subject || "general"),
          message: formState.message,
          honeypot: formState.honeypot || "",
        }),
      });

      const json = await res.json();
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || "Failed to send");
      }

      setIsSubmitted(true);
      setFormState({ name: "", email: "", subject: "", message: "", honeypot: "" });
    } catch (err: any) {
      // Optional fallback: open mail client if API fails
      if (confirm("Could not send via server. Open your email app instead?")) {
        window.location.href = mailtoHref;
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-black text-white">
      {/* Hero / Brand band */}
      <div className="relative overflow-hidden border-b border-white/10">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(900px_450px_at_15%_-10%,rgba(168,85,247,0.22),transparent_60%),radial-gradient(700px_350px_at_85%_-10%,rgba(234,179,8,0.18),transparent_60%)]" />
        <section className="relative px-6 md:px-10 py-10 md:py-14 bg-gradient-to-b from-[#2a0f3c] via-[#160a26] to-[#000]">
          <div className="max-w-6xl mx-auto flex items-center justify-between">
            <Link
              href="/"
              className="inline-flex items-center text-white/80 hover:text-white"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back Home
            </Link>

            {/* Brand mark */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={BRAND_LOGO}
              alt="Black Truth TV"
              className="h-10 w-10 rounded-md ring-1 ring-white/10 bg-black/30 object-contain"
              onError={(e) => ((e.currentTarget as HTMLImageElement).style.display = "none")}
            />
          </div>

          <div className="max-w-6xl mx-auto mt-6">
            <h1 className="text-3xl md:text-5xl font-extrabold leading-tight tracking-tight">
              Contact <span className="text-amber-300">Black Truth TV</span>
            </h1>
            <p className="mt-3 text-white/80 max-w-3xl">
              Questions, feedback, licensing, or content submissions—reach out. We read every message.
            </p>
          </div>
        </section>
      </div>

      {/* Content */}
      <section className="px-6 md:px-10 py-10">
        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left column: Contact info & quick actions */}
          <div className="lg:col-span-1 space-y-6">
            {/* Direct contact card */}
            <div className="rounded-xl border border-white/10 bg-zinc-950/60 p-6">
              <div className="flex items-center gap-2">
                <Mail className="h-5 w-5 text-amber-300" />
                <h2 className="text-xl font-semibold">Direct Email</h2>
              </div>
              <p className="text-white/70 mt-2">
                Prefer email? Tap below to compose a message—our team will get back to you.
              </p>

              <div className="mt-4 grid gap-2">
                <a
                  className="text-amber-300 hover:underline break-all"
                  href={`mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent("[Black Truth TV] General Inquiry")}`}
                >
                  {CONTACT_EMAIL}
                </a>
              </div>

              <div className="mt-6 grid grid-cols-1 gap-2 text-sm">
                <a
                  className="inline-flex items-center gap-2 rounded-md ring-1 ring-white/10 bg-white/[0.03] px-3 py-2 hover:bg-white/[0.06]"
                  href={`mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(
                    "[Black Truth TV] Technical Support"
                  )}`}
                >
                  <Shield className="h-4 w-4 text-white/70" />
                  Technical Support
                </a>
                <a
                  className="inline-flex items-center gap-2 rounded-md ring-1 ring-white/10 bg-white/[0.03] px-3 py-2 hover:bg-white/[0.06]"
                  href={`mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(
                    "[Black Truth TV] Copyright Question"
                  )}`}
                >
                  <Info className="h-4 w-4 text-white/70" />
                  Copyright / Licensing
                </a>
              </div>
            </div>

            {/* Hours / response */}
            <div className="rounded-xl border border-white/10 bg-zinc-950/60 p-6">
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-amber-300" />
                <h3 className="text-lg font-semibold">Hours & Response Time</h3>
              </div>
              <ul className="mt-3 text-sm text-white/80 space-y-1">
                <li>Mon–Fri: 9:00am – 6:00pm PT</li>
                <li>Sat–Sun: Limited monitoring</li>
                <li className="text-white/70">Typical response: within 1–2 business days</li>
              </ul>
            </div>

            {/* Optional phone / community note */}
            <div className="rounded-xl border border-white/10 bg-zinc-950/60 p-6">
              <div className="flex items-center gap-2">
                <Phone className="h-5 w-5 text-amber-300" />
                <h3 className="text-lg font-semibold">Community</h3>
              </div>
              <p className="mt-2 text-sm text-white/80">
                For urgent broadcast issues, include your channel number and what you’re seeing on screen.
              </p>
            </div>
          </div>

          {/* Right column: Form */}
          <div className="lg:col-span-2">
            <div className="rounded-xl border border-white/10 bg-zinc-950/60 p-6 md:p-8">
              {isSubmitted ? (
                <div className="flex flex-col items-center text-center py-10">
                  <div className="rounded-full bg-green-900/30 p-4 ring-1 ring-white/10 mb-3">
                    <CheckCircle2 className="h-10 w-10 text-green-400" />
                  </div>
                  <h2 className="text-2xl font-bold">Message Sent</h2>
                  <p className="text-white/70 mt-2 max-w-md">
                    Thanks—we’ll reply from <span className="font-semibold">{CONTACT_EMAIL}</span>.
                  </p>
                  <Button
                    onClick={() => setIsSubmitted(false)}
                    className="mt-6 bg-amber-400 text-black hover:bg-amber-300"
                  >
                    Send Another Message
                  </Button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="name" className="block text-sm font-medium mb-1">
                        Your Name
                      </label>
                      <input
                        id="name"
                        name="name"
                        type="text"
                        required
                        autoComplete="name"
                        value={formState.name}
                        onChange={handleChange}
                        className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-amber-400"
                      />
                    </div>
                    <div>
                      <label htmlFor="email" className="block text-sm font-medium mb-1">
                        Email Address
                      </label>
                      <input
                        id="email"
                        name="email"
                        type="email"
                        required
                        autoComplete="email"
                        value={formState.email}
                        onChange={handleChange}
                        className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-amber-400"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="subject" className="block text-sm font-medium mb-1">
                        Subject
                      </label>
                      <select
                        id="subject"
                        name="subject"
                        required
                        value={formState.subject}
                        onChange={handleChange}
                        className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-amber-400"
                      >
                        <option value="">Select a subject</option>
                        <option value="general">General Inquiry</option>
                        <option value="support">Technical Support</option>
                        <option value="content">Content Request</option>
                        <option value="copyright">Copyright Question</option>
                        <option value="password">Channel Password</option>
                        <option value="other">Other</option>
                      </select>
                    </div>

                    {/* Hidden honeypot for basic bot filtering */}
                    <div className="hidden">
                      <label htmlFor="honeypot">Leave this field empty</label>
                      <input
                        id="honeypot"
                        name="honeypot"
                        type="text"
                        value={formState.honeypot}
                        onChange={handleChange}
                        tabIndex={-1}
                        autoComplete="off"
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="message" className="block text-sm font-medium mb-1">
                      Message
                    </label>
                    <textarea
                      id="message"
                      name="message"
                      rows={6}
                      required
                      value={formState.message}
                      onChange={handleChange}
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-amber-400"
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <p className="text-xs text-white/50">
                      We’ll reply from <span className="text-white/70">{CONTACT_EMAIL}</span>.
                    </p>

                    <Button
                      type="submit"
                      disabled={isSubmitting || !formState.email || !formState.subject || !formState.message}
                      className="bg-amber-400 text-black hover:bg-amber-300 inline-flex items-center"
                    >
                      {isSubmitting ? (
                        <>
                          <span className="mr-2 inline-block h-4 w-4 animate-spin rounded-full border-2 border-black/60 border-t-black" />
                          Sending…
                        </>
                      ) : (
                        <>
                          <Send className="h-4 w-4 mr-2" />
                          Send Message
                        </>
                      )}
                    </Button>
                  </div>
                </form>
              )}
            </div>

            {/* Quick links under form */}
            <div className="mt-6 grid sm:grid-cols-3 gap-3">
              <Link
                href="/guide"
                className="rounded-xl border border-white/10 bg-zinc-950/60 px-4 py-3 text-sm hover:bg-zinc-900/60"
              >
                What’s On Now
              </Link>
              <Link
                href="/channels"
                className="rounded-xl border border-white/10 bg-zinc-950/60 px-4 py-3 text-sm hover:bg-zinc-900/60"
              >
                Browse Channels
              </Link>
              <Link
                href="/freedom-school"
                className="rounded-xl border border-white/10 bg-zinc-950/60 px-4 py-3 text-sm hover:bg-zinc-900/60"
              >
                Freedom School
              </Link>
            </div>
          </div>
        </div>

        {/* Footer back action */}
        <div className="max-w-6xl mx-auto mt-10 text-center">
          <Link href="/">
            <Button variant="outline" className="bg-gray-800 text-white hover:bg-gray-700 border-gray-600">
              Return to Home
            </Button>
          </Link>
        </div>
      </section>
    </main>
  );
}
