// lib/supabase.ts
import { createClient } from "@supabase/supabase-js";

/** ── Minimal shared types (avoid '@/types' alias during build) ── */
export type Program = {
  id: string | number;
  channel_id: number | string;
  title?: string | null;
  mp4_url?: string | null;
  duration?: number | null;      // seconds
  start_time?: string | null;    // ISO or "YYYY-MM-DD HH:mm:ss"
  poster_url?: string | null;
  [k: string]: any;
};

export type Channel = {
  id: number | string;
  name?: string | null;
  slug?: string | null;
  logo_url?: string | null;
  youtube_channel_id?: string | null;
  [k: string]: any;
};

/** ── Supabase client (public anon) ── */
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!URL || !KEY) {
  // Helpful error in dev; on Vercel, set these in Project → Settings → Environment Variables
  // We don't throw here to avoid crashing static analysis at build time.
  // Runtime calls will fail clearly if not set.
  console.warn(
    "[supabase] Missing NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY env vars."
  );
}

export const supabase = createClient(URL || "", KEY || "");

/** ── Constants ── */
export const STANDBY_PLACEHOLDER_ID = "standby-placeholder";

/** ── Helpers ── */
const ROOT = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/+$/, "");

function cleanKey(k: string) {
  return (k || "").trim().replace(/^\.?\//, "").replace(/\\/g, "/").replace(/\/{2,}/g, "/");
}

/** Build a PUBLIC URL for a storage object (works at build & runtime) */
function buildPublicUrl(bucket: string, objectPath: string): string | undefined {
  const key = cleanKey(objectPath);
  // Preferred: environment root (works on Vercel)
  if (ROOT) return `${ROOT}/storage/v1/object/public/${bucket}/${key}`;
  // Fallback: compose via supabase client
  try {
    const { data } = supabase.storage.from(bucket).getPublicUrl(key);
    return data?.publicUrl || undefined;
  } catch {
    return undefined;
  }
}

/** Parse both ISO and "YYYY-MM-DD HH:mm:ss" (UTC) */
function toUtcDate(val?: string | Date | null): Date | null {
  if (!val) return null;
  if (val instanceof Date) return Number.isNaN(val.getTime()) ? null : val;
  let s = String(val).trim();
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(\.\d+)?$/.test(s)) s = s.replace(" ", "T") + "Z";
  else if (!/[zZ]|[+\-]\d{2}:\d{2}$/.test(s)) s = s + "Z";
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** ── Public URL resolver for program videos (PUBLIC buckets) ──
 * Accepts:
 *  - Absolute URLs:                 https://...              → pass through
 *  - storage://bucket/key:          → public URL
 *  - bucket:key                     → public URL
 *  - bucket/key                     → public URL
 *  - filename.mp4                   → public URL in channel{channel_id}/filename.mp4
 * Also tolerates accidental prefixes (channel{id}/, freedom_school/).
 */
export function getVideoUrlForProgram(p: Program): string | undefined {
  let raw = (p?.mp4_url || "").trim();
  if (!raw) return undefined;

  // absolute URL or absolute path
  if (/^https?:\/\//i.test(raw) || raw.startsWith("/")) return raw;

  // storage://bucket/key
  let m = /^storage:\/\/([^/]+)\/(.+)$/.exec(raw);
  if (m) {
    const [, bucket, key] = m;
    return buildPublicUrl(bucket, key);
  }

  // bucket:key
  m = /^([a-z0-9_\-]+):(.+)$/i.exec(raw);
  if (m) {
    const [, bucket, key] = m;
    return buildPublicUrl(bucket, key);
  }

  // bucket/key
  m = /^([a-z0-9_\-]+)\/(.+)$/i.exec(raw);
  if (m) {
    const [, bucket, key] = m;
    return buildPublicUrl(bucket, key);
  }

  // relative filename → lives in channel{channel_id}
  const bucket = `channel${Number(p.channel_id)}`;
  let key = cleanKey(raw)
    .replace(new RegExp(`^${bucket}/`, "i"), "")
    .replace(/^freedom_school\//i, ""); // tolerate common prefix

  return buildPublicUrl(bucket, key);
}

/** Fetch one channel by id (number) or slug (string) */
export async function fetchChannelDetails(idOrSlug: string | number): Promise<Channel | null> {
  try {
    const asNum = typeof idOrSlug === "number" ? idOrSlug : Number.parseInt(String(idOrSlug), 10);
    if (!Number.isNaN(asNum)) {
      const { data, error } = await supabase
        .from("channels")
        .select("*")
        .eq("id", asNum)
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return (data as Channel) ?? null;
    } else {
      const { data, error } = await supabase
        .from("channels")
        .select("*")
        .eq("slug", String(idOrSlug))
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return (data as Channel) ?? null;
    }
  } catch {
    return null;
  }
}

/** Small helpers you might already rely on elsewhere */
export function addSeconds(d: Date, secs: number) {
  return new Date(d.getTime() + secs * 1000);
}
export { toUtcDate };
