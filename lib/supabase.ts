// lib/supabase.ts
import { createClient } from "@supabase/supabase-js";

/* Minimal types */
export type Program = {
  id: string | number;
  channel_id: number | string;
  title?: string | null;
  mp4_url?: string | null;
  duration?: number | string | null;   // seconds (number or numeric string)
  start_time?: string | null;          // UTC-like string
  description?: string | null;
  [k: string]: any;
};

export type Channel = {
  id: number | string;
  name?: string | null;
  slug?: string | null;
  logo_url?: string | null;             // poster
  youtube_channel_id?: string | null;   // for CH21 embedding
  [k: string]: any;
};

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
export const supabase = createClient(URL, KEY);

export const STANDBY_PLACEHOLDER_ID = "standby-placeholder";

/* ---------- time ---------- */

export function toUtcDate(val?: string | Date | null): Date | null {
  if (!val) return null;
  if (val instanceof Date) return Number.isNaN(val.getTime()) ? null : val;

  let s = String(val).trim();

  // "YYYY-MM-DD HH:mm:ss" → ISO Z
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(?:\.\d+)?$/.test(s)) {
    s = s.replace(" ", "T") + "Z";
  }
  // ISO without tz → force Z
  else if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?$/.test(s)) {
    s = s + "Z";
  }
  // "YYYY-MM-DD HH:mm:ss±HH[:MM]" → add T & normalize colon in offset if missing
  else if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(?:\.\d+)?[+\-]\d{2}:?\d{2}$/.test(s)) {
    s = s.replace(" ", "T").replace(/([+\-]\d{2})(\d{2})$/, "$1:$2");
  }

  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function addSeconds(d: Date, secs: number) {
  return new Date(d.getTime() + secs * 1000);
}

/** STRICT: seconds only (number or numeric string). Anything else → 0. */
export function parseDurationSec(v: number | string | null | undefined): number {
  if (typeof v === "number" && Number.isFinite(v)) return Math.max(0, Math.round(v));
  if (v == null) return 0;
  const n = Number(String(v).trim());
  return Number.isFinite(n) ? Math.max(0, Math.round(n)) : 0;
}

/* ---------- storage URL (public buckets) ---------- */

const ROOT = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/+$/, "");
const cleanKey = (k: string) => (k || "").trim().replace(/^\.?\//, "").replace(/\\/g, "/").replace(/\/{2,}/g, "/");

const buildPublicUrl = (bucket: string, objectPath: string): string | undefined => {
  const key = cleanKey(objectPath);
  if (ROOT) return `${ROOT}/storage/v1/object/public/${bucket}/${key}`;
  try {
    const { data } = supabase.storage.from(bucket).getPublicUrl(key);
    return data?.publicUrl || undefined;
  } catch { return undefined; }
};

/** bucket name for numeric channels: channel1, channel2, …; for slug: channelfreedom_school */
function bucketNameForChannelId(channel_id: number | string): string {
  if (typeof channel_id === "number" && Number.isFinite(channel_id)) {
    return `channel${channel_id}`;
  }
  const s = String(channel_id).trim();
  return `channel${s}`;
}

/** Video URL resolver for PUBLIC buckets */
export function getVideoUrlForProgram(p: Program): string | undefined {
  let raw = (p?.mp4_url || "").trim();
  if (!raw) return undefined;

  // absolute URL or root-relative
  if (/^https?:\/\//i.test(raw) || raw.startsWith("/")) return raw;

  // storage://bucket/key
  let m = /^storage:\/\/([^/]+)\/(.+)$/.exec(raw);
  if (m) return buildPublicUrl(m[1], m[2]);

  // bucket:key
  m = /^([a-z0-9_\-]+):(.+)$/i.exec(raw);
  if (m) return buildPublicUrl(m[1], m[2]);

  // bucket/key
  m = /^([a-z0-9_\-]+)\/(.+)$/.exec(raw);
  if (m) return buildPublicUrl(m[1], m[2]);

  // relative filename → use channel bucket; strip accidental "channelX/" prefix
  const bucket = bucketNameForChannelId(p.channel_id);
  const key = cleanKey(raw).replace(/^channel[^/]+\/+/i, "");
  return buildPublicUrl(bucket, key);
}

/** Fetch one channel (by numeric id or slug) */
export async function fetchChannelDetails(idOrSlug: string | number): Promise<Channel | null> {
  try {
    // also normalize hyphen→underscore for your slug case
    const slugLike = String(idOrSlug).includes("-") ? String(idOrSlug).replace(/-/g, "_") : String(idOrSlug);

    const asNum = Number.parseInt(String(idOrSlug), 10);
    if (!Number.isNaN(asNum)) {
      const { data, error } = await supabase
        .from("channels").select("*").eq("id", asNum).limit(1).maybeSingle();
      if (error) throw error;
      return (data as Channel) ?? null;
    } else {
      const { data, error } = await supabase
        .from("channels").select("*").eq("slug", slugLike).limit(1).maybeSingle();
      if (error) throw error;
      return (data as Channel) ?? null;
    }
  } catch { return null; }
}
