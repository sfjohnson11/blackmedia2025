// lib/news-data.ts
const KEY = "btv_news_items";

// Default message so the bar always appears
const DEFAULT_ITEMS = [
  "Welcome to Black Truth TV — streaming 24/7.",
];

export function getNewsItems(): string[] {
  try {
    if (typeof window === "undefined") {
      // During SSR return default (BreakingNews runs on client anyway)
      return DEFAULT_ITEMS;
    }
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return DEFAULT_ITEMS;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.every((s) => typeof s === "string")) {
      return parsed.length > 0 ? parsed : DEFAULT_ITEMS;
    }
    return DEFAULT_ITEMS;
  } catch {
    return DEFAULT_ITEMS;
  }
}

export function saveNewsItems(items: string[]) {
  try {
    if (typeof window === "undefined") return;
    const clean = (Array.isArray(items) ? items : []).filter((s) => !!s && typeof s === "string");
    window.localStorage.setItem(KEY, JSON.stringify(clean));
  } catch {
    // ignore
  }
}
