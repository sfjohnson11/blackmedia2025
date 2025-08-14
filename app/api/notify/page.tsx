// app/admin/notify/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";

type Scope = "all" | "role" | "emails";
type Role = "admin" | "member" | "student";

export default function AdminNotifyPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [allowed, setAllowed] = useState(false);

  // form state
  const [scope, setScope] = useState<Scope>("all");
  const [role, setRole] = useState<Role>("member");
  const [emails, setEmails] = useState("");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [link, setLink] = useState("");
  const [type, setType] = useState("info"); // info | channel | donation | system

  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // must be admin
  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session?.user) {
        router.replace("/auth/login?redirect_to=/admin/notify");
        return;
      }
      const { data: prof } = await supabase
        .from("user_profiles")
        .select("role")
        .eq("user_id", data.session.user.id)
        .single();

      if (prof?.role === "admin") {
        setAllowed(true);
      } else {
        setAllowed(false);
      }
      setLoading(false);
    })();
  }, [router]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setResult(null);
    setError(null);

    try {
      const payload: any = { title: title.trim() };
      if (!payload.title) throw new Error("Title is required.");

      if (body.trim()) payload.body = body.trim();
      if (link.trim()) payload.link = link.trim();
      if (type.trim()) payload.type = type.trim();

      if (scope === "all") {
        payload.scope = "all";
      } else if (scope === "role") {
        payload.scope = "role";
        payload.role = role;
      } else if (scope === "emails") {
        const list = emails.split(/[,\s]+/).map((x) => x.trim()).filter(Boolean);
        if (list.length === 0) throw new Error("Add at least one email.");
        payload.scope = "emails";
        payload.emails = list;
      }

      const res = await fetch("/api/notify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to send.");

      setResult(`Sent to ${json.inserted} user(s).`);
      setTitle("");
      setBody("");
      setLink("");
    } catch (err: any) {
      setError(err.message || "Error");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-gray-400">Loading…</div>;
  }
  if (!allowed) {
    return <div className="min-h-screen flex items-center justify-center text-red-400">403 — Admins only</div>;
  }

  return (
    <div className="min-h-screen px-4 md:px-10 pt-24">
      <div className="max-w-2xl mx-auto bg-gray-900 border border-gray-800 rounded-xl p-6">
        <h1 className="text-2xl font-bold mb-4">Send Notification</h1>

        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => setScope("all")}
              className={`py-2 rounded ${scope === "all" ? "bg-red-600 text-white" : "bg-gray-800"}`}
            >
              Everyone
            </button>
            <button
              type="button"
              onClick={() => setScope("role")}
              className={`py-2 rounded ${scope === "role" ? "bg-red-600 text-white" : "bg-gray-800"}`}
            >
              By role
            </button>
            <button
              type="button"
              onClick={() => setScope("emails")}
              className={`py-2 rounded ${scope === "emails" ? "bg-red-600 text-white" : "bg-gray-800"}`}
            >
              By emails
            </button>
          </div>

          {scope === "role" && (
            <div className="flex gap-2">
              {(["admin", "member", "student"] as Role[]).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRole(r)}
                  className={`px-3 py-2 rounded capitalize ${role === r ? "bg-gray-700" : "bg-gray-800"}`}
                >
                  {r}
                </button>
              ))}
            </div>
          )}

          {scope === "emails" && (
            <div>
              <label className="block text-sm mb-1">Emails (comma or space separated)</label>
              <textarea
                className="w-full bg-gray-800 border border-gray-700 rounded p-2"
                rows={3}
                value={emails}
                onChange={(e) => setEmails(e.target.value)}
                placeholder="alice@example.com, bob@example.com"
              />
            </div>
          )}

          <div>
            <label className="block text-sm mb-1">Title</label>
            <input
              className="w-full bg-gray-800 border border-gray-700 rounded p-2"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              placeholder="Announcement title"
            />
          </div>

          <div>
            <label className="block text-sm mb-1">Message</label>
            <textarea
              className="w-full bg-gray-800 border border-gray-700 rounded p-2"
              rows={4}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Write your message…"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm mb-1">Link (optional)</label>
              <input
                className="w-full bg-gray-800 border border-gray-700 rounded p-2"
                value={link}
                onChange={(e) => setLink(e.target.value)}
                placeholder="/watch/21"
              />
            </div>
            <div>
              <label className="block text-sm mb-1">Type</label>
              <select
                className="w-full bg-gray-800 border border-gray-700 rounded p-2"
                value={type}
                onChange={(e) => setType(e.target.value)}
              >
                <option value="info">info</option>
                <option value="channel">channel</option>
                <option value="donation">donation</option>
                <option value="system">system</option>
              </select>
            </div>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <Button disabled={submitting} className="bg-red-600 hover:bg-red-700">
              {submitting ? "Sending…" : "Send"}
            </Button>
            {result && <span className="text-green-400 text-sm">{result}</span>}
            {error && <span className="text-red-400 text-sm">{error}</span>}
          </div>
        </form>
      </div>
    </div>
  );
}
