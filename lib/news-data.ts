"use client";

// Client helpers that talk to /api/news
// GET returns { items: string[] }
// POST accepts { items: string[] } (auth required, RLS should allow admins only)

export async function getNewsItems(): Promise<string[]> {
  try {
    const res = await fetch("/api/news", { cache: "no-store" });
    if (!res.ok) return [];
    const json = await res.json();
    return Array.isArray(json.items) ? json.items : [];
  } catch {
    return [];
  }
}

export async function saveNewsItems(items: string[]): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch("/api/news", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items }),
    });
    if (!res.ok) {
      const payload = await res.json().catch(() => ({}));
      return { ok: false, error: payload?.error || "Failed to save news items" };
    }
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e?.message || "Network error" };
  }
}
