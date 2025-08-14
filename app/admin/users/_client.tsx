// app/admin/users/_client.tsx
"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type Role = "admin" | "member" | "student";
type Profile = {
  id: string;
  email: string | null;
  name: string | null;
  role: Role | null;
  created_at: string | null;
};

const ROLE_OPTIONS: Role[] = ["admin", "member", "student"];

export default function AdminUsersClient() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    const { data, error } = await supabase
      .from("user_profiles")
      .select("id, email, name, role, created_at")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) setError(error.message);
    setProfiles((data as any) || []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function saveRole(id: string, role: Role) {
    setSaving(id);
    setError(null);
    const { error } = await supabase.from("user_profiles").update({ role }).eq("id", id);
    if (error) setError(error.message);
    await load();
    setSaving(null);
  }

  if (loading) return <div className="p-6 text-white">Loading users…</div>;

  return (
    <main className="p-6 text-white">
      <h1 className="text-2xl font-semibold mb-4">Manage User Role</h1>
      {error && <div className="mb-4 text-red-400">{error}</div>}

      <div className="overflow-x-auto rounded border border-gray-800">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-900">
            <tr>
              <th className="text-left px-4 py-3">Name</th>
              <th className="text-left px-4 py-3">Email</th>
              <th className="text-left px-4 py-3">Created</th>
              <th className="text-left px-4 py-3">Role</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {profiles.map((p) => (
              <tr key={p.id} className="border-t border-gray-800">
                <td className="px-4 py-3">{p.name || "—"}</td>
                <td className="px-4 py-3">{p.email || "—"}</td>
                <td className="px-4 py-3">{p.created_at ? new Date(p.created_at).toLocaleString() : "—"}</td>
                <td className="px-4 py-3">
                  <select
                    className="bg-gray-800 border border-gray-700 rounded px-2 py-1"
                    value={p.role ?? "student"}
                    onChange={(e) => {
                      const role = e.target.value as Role;
                      setProfiles((cur) => cur.map((row) => (row.id === p.id ? { ...row, role } : row)));
                    }}
                  >
                    {ROLE_OPTIONS.map((r) => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                </td>
                <td className="px-4 py-3">
                  <button
                    disabled={saving === p.id}
                    className="bg-blue-600 hover:bg-blue-700 px-3 py-1 rounded disabled:opacity-50"
                    onClick={() => {
                      const role = (profiles.find(x => x.id === p.id)?.role ?? "student") as Role;
                      saveRole(p.id, role);
                    }}
                  >
                    {saving === p.id ? "Saving…" : "Save"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
