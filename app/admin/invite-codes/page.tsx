// app/admin/invite-codes/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Trash2, PlusCircle, RefreshCw } from "lucide-react";

type Row = {
  code_hash: string;
  role: "member" | "student" | "admin";
  label: string | null;
  expires_at: string | null;
  max_uses: number | null;
  used_count: number;
  created_at: string;
};

export default function InviteCodesPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  // form state
  const [plainCode, setPlainCode] = useState("");
  const [role, setRole] = useState<Row["role"]>("student");
  const [label, setLabel] = useState("");
  const [expires, setExpires] = useState<string>(""); // datetime-local (browser local time)
  const [maxUses, setMaxUses] = useState<string>("");

  const expiresUtcIso = useMemo(() => {
    if (!expires) return null;
    const d = new Date(expires);
    return isNaN(d.getTime()) ? null : d.toISOString();
  }, [expires]);

  async function sha256Hex(text: string) {
    const enc = new TextEncoder();
    const buf = await crypto.subtle.digest("SHA-256", enc.encode(text));
    const bytes = Array.from(new Uint8Array(buf));
    return bytes.map((b) => b.toString(16).padStart(2, "0")).join("");
  }

  async function load() {
    setLoading(true);
    setErr(null);
    try {
      const { data, error } = await supabase
        .from("invite_codes")
        .select("code_hash, role, label, expires_at, max_uses, used_count, created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      setRows((data as Row[]) || []);
    } catch (e: any) {
      setErr(e?.message || "Failed to load invite codes.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setMsg(null);
    if (!plainCode.trim()) {
      setErr("Enter an invite code string to hash and save.");
      return;
    }
    setSubmitting(true);
    try {
      // Hash in browser; only the hash is stored in DB (plaintext never leaves admin page)
      const code_hash = await sha256Hex(plainCode.trim());
      const payload: Partial<Row> & { code_hash: string } = {
        code_hash,
        role,
        label: label.trim() || null,
        expires_at: expiresUtcIso,
        max_uses: maxUses ? Number(maxUses) : null,
      };

      const { error } = await supabase.from("invite_codes").insert(payload as any);
      if (error) throw error;

      setMsg("Invite code created.");
      setPlainCode("");
      setLabel("");
      setExpires("");
      setMaxUses("");
      await load();
    } catch (e: any) {
      setErr(e?.message || "Failed to create invite code.");
    } finally {
      setSubmitting(false);
    }
  }

  async function onDelete(hash: string) {
    if (!confirm("Delete this invite code? This cannot be undone.")) return;
    setErr(null);
    setMsg(null);
    try {
      const { error } = await supabase.from("invite_codes").delete().eq("code_hash", hash);
      if (error) throw error;
      setMsg("Invite code deleted.");
      setRows((r) => r.filter((x) => x.code_hash !== hash));
    } catch (e: any) {
      setErr(e?.message || "Failed to delete invite code.");
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold mb-2">Invite Codes</h1>
        <p className="text-gray-400">Create and manage role-based invite codes.</p>
      </div>

      <Card className="bg-gray-800 border-gray-700">
        <CardHeader>
          <CardTitle>Create Invite Code</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={onCreate} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm mb-1">Plaintext code (will be hashed)</label>
              <input
                className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded"
                value={plainCode}
                onChange={(e) => setPlainCode(e.target.value)}
                placeholder="e.g. STUDENT-2025-ALPHA"
                required
              />
            </div>

            <div>
              <label className="block text-sm mb-1">Role</label>
              <select
                className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded"
                value={role}
                onChange={(e) => setRole(e.target.value as Row["role"])}
              >
                <option value="student">student</option>
                <option value="admin">admin</option>
                <option value="member">member</option>
              </select>
            </div>

            <div>
              <label className="block text-sm mb-1">Label (optional)</label>
              <input
                className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="HVAC Cohort A"
              />
            </div>

            <div>
              <label className="block text-sm mb-1">Expires (optional)</label>
              <input
                type="datetime-local"
                className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded"
                value={expires}
                onChange={(e) => setExpires(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-sm mb-1">Max uses (optional)</label>
              <input
                type="number"
                min={1}
                className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded"
                value={maxUses}
                onChange={(e) => setMaxUses(e.target.value)}
                placeholder="e.g. 50"
              />
            </div>

            {err && <p className="md:col-span-2 text-sm text-red-400">{err}</p>}
            {msg && <p className="md:col-span-2 text-sm text-green-400">{msg}</p>}

            <div className="md:col-span-2 flex gap-3">
              <Button type="submit" disabled={submitting} className="bg-red-600 hover:bg-red-700">
                <PlusCircle className="h-4 w-4 mr-2" />
                {submitting ? "Creating…" : "Create Invite Code"}
              </Button>
              <Button type="button" variant="outline" onClick={load} className="border-gray-600">
                <RefreshCw className="h-4 w-4 mr-2" /> Refresh
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card className="bg-gray-800 border-gray-700">
        <CardHeader>
          <CardTitle>Existing Codes</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-gray-400">Loading…</p>
          ) : rows.length === 0 ? (
            <p className="text-gray-400">No invite codes yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-gray-400">
                  <tr>
                    <th className="py-2 pr-4">Label</th>
                    <th className="py-2 pr-4">Role</th>
                    <th className="py-2 pr-4">Expires</th>
                    <th className="py-2 pr-4">Usage</th>
                    <th className="py-2 pr-4">Created</th>
                    <th className="py-2 pr-4">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.code_hash} className="border-t border-gray-700">
                      <td className="py-2 pr-4">{r.label || <span className="text-gray-500">—</span>}</td>
                      <td className="py-2 pr-4">{r.role}</td>
                      <td className="py-2 pr-4">
                        {r.expires_at ? new Date(r.expires_at).toLocaleString() : <span className="text-gray-500">—</span>}
                      </td>
                      <td className="py-2 pr-4">
                        {r.used_count} {r.max_uses ? `/ ${r.max_uses}` : ""}
                      </td>
                      <td className="py-2 pr-4">{new Date(r.created_at).toLocaleString()}</td>
                      <td className="py-2 pr-4">
                        <Button
                          variant="outline"
                          className="border-gray-600 text-red-400 hover:text-red-300"
                          onClick={() => onDelete(r.code_hash)}
                        >
                          <Trash2 className="h-4 w-4 mr-2" /> Delete
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

