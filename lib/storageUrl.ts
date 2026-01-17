export function parseSupabaseStorageUrl(url: string): { bucket: string; path: string } | null {
  try {
    const u = new URL(url);
    const parts = u.pathname.split("/").filter(Boolean);

    // ".../storage/v1/object/public/<bucket>/<path...>"
    const i = parts.findIndex((p) => p === "object");
    if (i === -1) return null;

    const bucket = parts[i + 2];     // public OR sign comes after object/
    const path = parts.slice(i + 3).join("/");

    if (!bucket || !path) return null;
    return { bucket, path };
  } catch {
    return null;
  }
}
