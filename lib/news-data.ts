// lib/news-data.ts
const KEY = "btv_news_items";

export function getNewsItems(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((s) => typeof s === "string") : [];
  } catch {
    return [];
  }
}

export function setNewsItems(items: string[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(KEY, JSON.stringify(items));
    // fire an event so other tabs/components can react
    window.dispatchEvent(new StorageEvent("storage", { key: KEY, newValue: JSON.stringify(items) }));
  } catch {}
}
