// app/admin/users/_client.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type Profile = {
  id: string;
  email: string | null;
  name: string | null;
  roles: string[] | null;
  created_at: string | null;
};

const ROLE_KEYS = ["admin", "membership1", "membership2", "student"] as const;

export default function AdminUsersClient() {
  const router = useRouter();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [phase, setPhase] = useState<"checking" | "loading" | "ready" | "denied">("checking");
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function guardAndLoad() {
    setPhase("checking");
    setError(null);

    // 1) Must be logged in
    const { data: userData } = await supabase.auth.getUser();
    const user = userData?.user;
    if (!user) {
      router.replace("/auth/login?redirect_to=/admin/users");
      return;
    }

    // 2) Must be admin
    const { data: prof, error: profErr } = await supabase
      .from("user_profiles")
      .select("roles")
      .eq("id", user.id)
      .maybeSingle();

    if (profErr) {
      setError(profErr.message);
      setPhase("denied");
      return;
    }

    const roles: string[] = Array.isArray(prof?.roles) ? (prof!.roles as string[]) : [];
    if (!roles.includes("admin")) {
      router.replace("/auth/login?redirect_to=/admin/users");
      return;
    }

    // 3) Load profiles
    setPhase("loading");
    const { data, error } = await supabase
      .from("user_profiles")
      .select("id, email, name, roles, created_at")
      .order("created_at", { ascending: false })
      .limit(200);

    if (error) {
      setError(error.message);
      setPhase("denied");
      return;
    }

    setProfiles(data || []);
    setPhase("ready");
  }

  useEffect(() => {
    guardAndLoad();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function toggleRole(current: string[] | null | undefined, role: string) {
    const list = Array.isArray(current) ? [...current] : [];
    const idx = list.indexOf(role);
    if (idx >= 0) list.splice(idx, 1);
    else list.push(role);
    return list;
  }

  async function saveRoles(id: string, nextRoles: string[]) {
    setSaving(id);
    setError(null);
    const { error } = await supabase
      .from("user_profiles")
      .update({ roles: nextRoles })
      .eq("id", id);

    if (error) setError(error.message);
    // Reload after save to reflect any RLS-side changes
    await guardAndLoad();
    setSaving(null);
  }

  if (phase === "checking" || phase === "loading") {
    return <div className="p-6 text-white">Loading…</div>;
  }

  if (phase === "denied") {
    return (
      <main className="p-6 text-white">
        <h1 className="text-xl font-semibold mb-2">Access denied</h1>
        {error && <div className="text-red-400">{error}</div>}
      </main>
    );
  }

  return (
    <main className="p-6 text-white">
      <h1 className="text-2xl font-semibold mb-4">Manage User Roles</h1>
      {error && <div className="mb-4 text-red-400">{error}</div>}

      <div className="overflow-x-auto rounded border border-gray-800">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-900">
            <tr>
              <th className="text-left px-4 py-3">Name</th>
              <th className="text-left px-4 py-3">Email</th>
              <th className="text-left px-4 py-3">Created</th>
              {ROLE_KEYS.map((r) => (
                <th key={r} className="px-4 py-3">{r}</th>
              ))}
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {profiles.map((p) => {
              const roles = Array.isArray(p.roles) ? p.roles : [];
              return (
                <tr key={p.id} className="border-t border-gray-800">
                  <td className="px-4 py-3">{p.name || "—"}</td>
                  <td className="px-4 py-3">{p.email || "—"}</td>
                  <td className="px-4 py-3">
                    {p.created_at ? new Date(p.created_at).toLocaleString() : "—"}
                  </td>
                  {ROLE_KEYS.map((r) => {
                    const checked = roles.includes(r);
                    return (
                      <td key={r} className="px-4 py-3 text-center">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => {
                            const next = toggleRole(roles, r);
                            // optimistic UI
                            (p as any).roles = next;
                            setProfiles((cur) =>
                              cur.map((row) => (row.id === p.id ? { ...row, roles: next } : row))
                            );
                          }}
                        />
                      </td>
                    );
                  })}
                  <td className="px-4 py-3">
                    <button
                      disabled={saving === p.id}
                      className="bg-blue-600 hover:bg-blue-700 px-3 py-1 rounded disabled:opacity-50"
                      onClick={() =>
                        saveRoles(p.id, Array.isArray(p.roles) ? (p.roles as string[]) : [])
                      }
                    >
                      {saving === p.id ? "Saving…" : "Save"}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </main>
  );
}
