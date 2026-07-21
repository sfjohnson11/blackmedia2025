// app/admin/users/_client.tsx
"use client";

/* ============================================================
   BLACK TRUTH TV — ADMIN MEMBERS DASHBOARD
   See every member (name, email, role, status, joined,
   favorites count) and message them — one member or everyone —
   via the in-app notification bell.
   ============================================================ */

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/utils/supabase/client";

type Role = "admin" | "member" | "student";

type Profile = {
  id: string;
  email: string | null;
  full_name: string | null;
  role: Role | null;
  membership_status: string | null;
  grace_until: string | null;
  created_at: string | null;
};

const ROLE_OPTIONS: Role[] = ["admin", "member", "student"];

export default function AdminUsersClient() {
  const supabase = createClient();

  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [favCounts, setFavCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  // message composer
  const [msgOpen, setMsgOpen] = useState(false);
  const [msgTarget, setMsgTarget] = useState<"all" | string>("all"); // "all" or profile id
  const [msgTitle, setMsgTitle] = useState("");
  const [msgBody, setMsgBody] = useState("");
  const [msgLink, setMsgLink] = useState("");
  const [sending, setSending] = useState(false);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [profRes, favRes] = await Promise.all([
        supabase
          .from("user_profiles")
          .select(
            "id, email, full_name, role, membership_status, grace_until, created_at"
          )
          .order("created_at", { ascending: false })
          .limit(500),
        supabase.from("user_favorites").select("user_id"),
      ]);

      if (profRes.error) {
        setError(profRes.error.message);
        setProfiles([]);
      } else {
        setProfiles((profRes.data as Profile[]) ?? []);
      }

      if (!favRes.error && favRes.data) {
        const counts: Record<string, number> = {};
        for (const row of favRes.data as { user_id: string }[]) {
          counts[row.user_id] = (counts[row.user_id] ?? 0) + 1;
        }
        setFavCounts(counts);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return profiles;
    return profiles.filter(
      (p) =>
        (p.email ?? "").toLowerCase().includes(q) ||
        (p.full_name ?? "").toLowerCase().includes(q) ||
        (p.role ?? "").toLowerCase().includes(q)
    );
  }, [profiles, search]);

  async function saveRole(id: string, role: Role) {
    setSaving(id);
    setError(null);
    const { error } = await supabase
      .from("user_profiles")
      .update({ role })
      .eq("id", id);
    if (error) setError(error.message);
    await load();
    setSaving(null);
  }

  async function setActive(id: string) {
    setSaving(id);
    setError(null);
    const { error } = await supabase
      .from("user_profiles")
      .update({ membership_status: "active", grace_until: null })
      .eq("id", id);
    if (error) setError(error.message);
    await load();
    setSaving(null);
  }

  function openComposer(target: "all" | string) {
    setMsgTarget(target);
    setMsgOpen(true);
    setNotice(null);
    setError(null);
  }

  async function sendMessage() {
    if (!msgTitle.trim() || sending) return;
    setSending(true);
    setError(null);
    setNotice(null);
    try {
      const targets =
        msgTarget === "all"
          ? profiles.map((p) => p.id)
          : [msgTarget];

      const rows = targets.map((uid) => ({
        user_id: uid,
        title: msgTitle.trim(),
        body: msgBody.trim() || null,
        link: msgLink.trim() || null,
      }));

      // insert in batches of 100
      for (let i = 0; i < rows.length; i += 100) {
        const batch = rows.slice(i, i + 100);
        const { error } = await supabase
          .from("user_notifications")
          .insert(batch);
        if (error) throw error;
      }

      setNotice(
        msgTarget === "all"
          ? `Message sent to ${targets.length} members. It appears in their 🔔 notification bell now.`
          : "Message sent — it appears in their 🔔 notification bell now."
      );
      setMsgTitle("");
      setMsgBody("");
      setMsgLink("");
      setMsgOpen(false);
    } catch (e: any) {
      setError(e?.message || "Failed to send message.");
    } finally {
      setSending(false);
    }
  }

  const targetName =
    msgTarget === "all"
      ? "ALL members"
      : profiles.find((p) => p.id === msgTarget)?.full_name ||
        profiles.find((p) => p.id === msgTarget)?.email ||
        "member";

  const inputCls =
    "w-full rounded-lg border border-slate-700 bg-black/60 px-3 py-2.5 text-white placeholder:text-slate-500 focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400";

  if (loading)
    return <div className="p-6 text-white">Loading members…</div>;

  return (
    <div className="p-4 md:p-6 text-white space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">
            👥 Members
          </h1>
          <p className="text-sm text-slate-400 mt-0.5">
            {profiles.length} total ·{" "}
            {profiles.filter((p) => p.membership_status === "active").length}{" "}
            active
          </p>
        </div>
        <button
          onClick={() => openComposer("all")}
          className="rounded-full border border-amber-500/70 bg-amber-500/90 px-5 py-2 text-sm font-bold text-black hover:bg-amber-400 transition"
        >
          📣 Message ALL members
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-400/50 bg-red-950/40 px-4 py-3 text-sm text-red-100">
          {error}
        </div>
      )}
      {notice && (
        <div className="rounded-lg border border-emerald-400/50 bg-emerald-950/40 px-4 py-3 text-sm text-emerald-100">
          {notice}
        </div>
      )}

      {/* Composer */}
      {msgOpen && (
        <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4 md:p-5 space-y-3">
          <p className="text-sm font-bold text-amber-200">
            ✉️ Message to {targetName}
          </p>
          <input
            type="text"
            value={msgTitle}
            onChange={(e) => setMsgTitle(e.target.value)}
            placeholder="Title * — e.g. New channel launching Friday!"
            className={inputCls}
          />
          <textarea
            value={msgBody}
            onChange={(e) => setMsgBody(e.target.value)}
            rows={3}
            placeholder="Message body (optional)"
            className={inputCls}
          />
          <input
            type="text"
            value={msgLink}
            onChange={(e) => setMsgLink(e.target.value)}
            placeholder="Link (optional) — e.g. /watch/2 or /ancestry"
            className={inputCls}
          />
          <div className="flex gap-2">
            <button
              onClick={sendMessage}
              disabled={!msgTitle.trim() || sending}
              className="rounded-full border border-amber-500/70 bg-amber-500/90 px-5 py-2 text-sm font-bold text-black hover:bg-amber-400 transition disabled:opacity-50"
            >
              {sending ? "Sending…" : "Send"}
            </button>
            <button
              onClick={() => setMsgOpen(false)}
              className="rounded-full border border-slate-600 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800 transition"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Search */}
      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="🔍 Search by name, email, or role…"
        className={`max-w-md ${inputCls}`}
      />

      {/* Member table */}
      <div className="overflow-x-auto rounded-2xl border border-slate-800">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-900/80 text-left text-xs uppercase tracking-wide text-slate-400">
              <th className="px-4 py-3">Member</th>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">❤️ Favs</th>
              <th className="px-4 py-3">Joined</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p) => {
              const active = p.membership_status === "active";
              return (
                <tr
                  key={p.id}
                  className="border-t border-slate-800 hover:bg-slate-900/40"
                >
                  <td className="px-4 py-3">
                    <div className="font-semibold text-white">
                      {p.full_name || "—"}
                    </div>
                    <div className="text-xs text-slate-400">{p.email}</div>
                  </td>
                  <td className="px-4 py-3">
                    <select
                      value={p.role ?? "member"}
                      onChange={(e) =>
                        saveRole(p.id, e.target.value as Role)
                      }
                      disabled={saving === p.id}
                      className="rounded-lg border border-slate-700 bg-black/60 px-2 py-1.5 text-xs text-white"
                    >
                      {ROLE_OPTIONS.map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-block rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                        active
                          ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                          : "bg-red-500/20 text-red-300 border border-red-500/40"
                      }`}
                    >
                      {p.membership_status || "none"}
                    </span>
                    {p.grace_until && (
                      <div className="text-[10px] text-slate-500 mt-1">
                        grace until{" "}
                        {new Date(p.grace_until).toLocaleDateString()}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-300">
                    {favCounts[p.id] ?? 0}
                  </td>
                  <td className="px-4 py-3 text-slate-400 text-xs">
                    {p.created_at
                      ? new Date(p.created_at).toLocaleDateString()
                      : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1.5">
                      <button
                        onClick={() => openComposer(p.id)}
                        className="rounded-full border border-slate-600 px-3 py-1 text-[11px] font-semibold text-slate-200 hover:border-amber-400 hover:text-amber-200 transition"
                      >
                        ✉️ Message
                      </button>
                      {!active && (
                        <button
                          onClick={() => setActive(p.id)}
                          disabled={saving === p.id}
                          className="rounded-full border border-emerald-600/60 px-3 py-1 text-[11px] font-semibold text-emerald-300 hover:bg-emerald-900/30 transition"
                        >
                          ✓ Set Active
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-slate-500">
        Messages appear in members&apos; 🔔 notification bell and on their
        Notifications page. Tip: include a link like /watch/15 to send them
        straight to a channel.
      </p>
    </div>
  );
}
