// lib/resume.ts
export function baseUrl(u?: string | null) {
  return (u ?? "").split("?")[0];
}
function keyFor(src: string) {
  return `btv:resume:${baseUrl(src)}`;
}

export function saveProgress(src: string, t: number, dur?: number) {
  try {
    localStorage.setItem(
      keyFor(src),
      JSON.stringify({ t, dur: dur ?? null, at: Date.now() })
    );
  } catch {
    /* ignore */
  }
}

export function loadProgress(
  src: string
): { t: number; dur?: number | null } | null {
  try {
    const raw = localStorage.getItem(keyFor(src));
    if (!raw) return null;
    const obj = JSON.parse(raw);
    return typeof obj?.t === "number" ? obj : null;
  } catch {
    return null;
  }
}

export function clearProgress(src: string) {
  try {
    localStorage.removeItem(keyFor(src));
  } catch {
    /* ignore */
  }
}
