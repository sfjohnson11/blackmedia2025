// app/contact/page.tsx
"use client";

import type React from "react";
import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Mail, Send, CheckCircle } from "lucide-react";

const CONTACT_EMAIL = "director@sfjfamilyservices.org";

function subjectLabel(v: string) {
  switch (v) {
    case "general": return "General Inquiry";
    case "support": return "Technical Support";
    case "content": return "Content Request";
    case "copyright": return "Copyright Question";
    case "password": return "Channel Password";
    case "other": return "Other";
    default: return "General Inquiry";
  }
}

export default function ContactPage() {
  const [formState, setFormState] = useState({
    name: "",
    email: "",
    subject: "",
    message: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormState((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    // Build a mailto that opens the user’s email app with everything filled in
    const subjText = `[Black Truth TV] ${subjectLabel(formState.subject)} — ${formState.name || "Viewer"}`;
    const bodyLines = [
      formState.message,
      "",
      "—",
      `From: ${formState.name || "Viewer"} <${formState.email || "no-email-provided"}>`,
    ];
    const mailto = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(subjText)}&body=${encodeURIComponent(bodyLines.join("\n"))}`;

    // Try to open the email client
    window.location.href = mailto;

    // Show a friendly confirmation state in the UI
    setTimeout(() => {
      setIsSubmitting(false);
      setIsSubmitted(true);
      setFormState({ name: "", email: "", subject: "", message: "" });
    }, 600);
  };

  return (
    <div className="pt-24 px-4 md:px-10 pb-16">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center mb-8">
          <Link href="/" className="mr-4">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Home
            </Button>
          </Link>
          <h1 className="text-3xl font-bold flex items-center">
            <Mail className="h-6 w-6 mr-2 text-red-500" />
            Contact Us
          </h1>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
          {/* Left: direct contact info */}
          <div>
            <div className="bg-gray-800 rounded-lg p-6 md:p-8 h-full">
              <h2 className="text-2xl font-bold mb-4">Get In Touch</h2>
              <p className="text-gray-300 mb-6">
                Have questions, feedback, or need assistance? We’re here to help. Use the form,
                or email us directly.
              </p>

              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-semibold mb-2">Email Us</h3>
                  <a
                    href={`mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent("[Black Truth TV] General Inquiry")}`}
                    className="text-red-400 hover:text-red-300 break-all"
                  >
                    {CONTACT_EMAIL}
                  </a>
                </div>

                <div>
                  <h3 className="text-lg font-semibold mb-2">Copyright / Licensing</h3>
                  <a
                    href={`mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent("[Black Truth TV] Copyright Question")}`}
                    className="text-red-400 hover:text-red-300 break-all"
                  >
                    {CONTACT_EMAIL}
                  </a>
                </div>

                <div>
                  <h3 className="text-lg font-semibold mb-2">Technical Support</h3>
                  <a
                    href={`mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent("[Black Truth TV] Technical Support")}`}
                    className="text-red-400 hover:text-red-300 break-all"
                  >
                    {CONTACT_EMAIL}
                  </a>
                </div>
              </div>
            </div>
          </div>

          {/* Right: form */}
          <div className="bg-gray-800 rounded-lg p-6 md:p-8">
            {isSubmitted ? (
              <div className="flex flex-col items-center justify-center h-full py-8">
                <div className="bg-green-900/30 rounded-full p-4 mb-4">
                  <CheckCircle className="h-12 w-12 text-green-500" />
                </div>
                <h2 className="text-2xl font-bold mb-2">Message Ready to Send</h2>
                <p className="text-gray-300 text-center mb-6">
                  We opened your email app with the message prefilled to{" "}
                  <span className="font-semibold">{CONTACT_EMAIL}</span>.
                </p>
                <Button onClick={() => setIsSubmitted(false)} className="bg-red-600 hover:bg-red-700">
                  Send Another Message
                </Button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label htmlFor="name" className="block text-sm font-medium mb-1">
                    Your Name
                  </label>
                  <input
                    id="name"
                    name="name"
                    type="text"
                    required
                    value={formState.name}
                    onChange={handleChange}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
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
                    value={formState.email}
                    onChange={handleChange}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
                  />
                </div>

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
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
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

                <div>
                  <label htmlFor="message" className="block text-sm font-medium mb-1">
                    Message
                  </label>
                  <textarea
                    id="message"
                    name="message"
                    rows={5}
                    required
                    value={formState.message}
                    onChange={handleChange}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
                  />
                </div>

                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full bg-red-600 hover:bg-red-700 flex items-center justify-center"
                >
                  {isSubmitting ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white mr-2" />
                      Preparing…
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4 mr-2" />
                      Send Message
                    </>
                  )}
                </Button>
              </form>
            )}
          </div>
        </div>

        <div className="text-center">
          <Link href="/">
            <Button variant="outline" className="bg-gray-800 text-white hover:bg-gray-700 border-gray-600">
              Return to Home
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
