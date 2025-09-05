// lib/supabase.ts
import { createClient } from "@supabase/supabase-js";

/* ---------- Types ---------- */

export type Program = {
  id: string | number;
  channel_id: number | string;
  title?: string | null;
  mp4_url?: string | null;              // relative path, bucket:key, bucket/key, storage://bucket/key, or full URL
  duration?: number | string | null;    // seconds (number or numeric string)
  start_time?: string | null;           // ISO-like string; will be normalized to UTC
  description?: string | null;
  [k: string]: any;
};

export type Channel = {
  id: number | string;
  name?: string | null;
  slug?: string | null;                 // e.g., "freedom-school", "construction-queen-tv"
  logo_url?: string | null;             // poster image shown in player
  youtube_channel_id?: string | null;   // used for CH21 YouTube live
  [k: string]: any;
};

/* ---------- Supabase client ---------- */

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
export const supabase = createClient(URL, KEY);

export const STANDBY_PLACEHOLDER_ID = "standby-placeholder";

/* ---------- Time utilities ---------- */

export function toUtcDate(val?: string | Date | null): Date | null {
  if (!val) return null;
  if (val instanceof Date) return Number.isNaN(val.getTime()) ? null : val;

  let s = String(val).trim();

  // "YYYY-MM-DD HH:mm:ssZ/z"
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(?:\.\d+)?[zZ]$/.test(s)) {
    s = s.replace(" ", "T").replace(/[zZ]$/, "Z");
  }
  // "YYYY-MM-DD HH:mm:ss±HH:MM" or ±HHMM
  else if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(?:\.\d+)?[+\-]\d{2}:?\d{2}$/.test(s)) {
    s = s.replace(" ", "T").replace(/([+\-]\d{2})(\d{2})$/, "$1:$2");
  }
  // ISO without tz → assume UTC
  else if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?$/.test(s)) {
    s = s + "Z";
  }
  // "YYYY-MM-DD HH:mm:ss" (no tz) → assume UTC
  else if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(?:\.\d+)?$/.test(s)) {
    s = s.replace(" ", "T") + "Z";
  }
  // else: assume already ISO-8601 with tz

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

/* ---------- Storage URL helpers (PUBLIC buckets) ---------- */

const ROOT = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/+$/, "");
const cleanKey = (k: string) =>
  (k || "").trim().replace(/^\.?\//, "").replace(/\\/g, "/").replace(/\/{2,}/g, "/");

const buildPublicUrl = (bucket: string, objectPath: string): string | undefined => {
  const key = cleanKey(objectPath);
  if (ROOT) return `${ROOT}/storage/v1/object/public/${bucket}/${key}`;
  try {
    const { data } = supabase.storage.from(bucket).getPublicUrl(key);
    return data?.publicUrl || undefined;
  } catch {
    return undefined;
  }
};

/**
 * Bucket mapping:
 * - Numeric (3 or "3") -> "channel3"
 * - "channel7" -> "channel7" (left as-is)
 * - "freedom_school" -> "freedom_school" (special bucket)
 */
function bucketNameForChannelId(channel_id: number | string): string {
  if (typeof channel_id === "number" && Number.isFinite(channel_id)) {
    return `channel${channel_id}`;
  }
  const s = String(channel_id).trim().toLowerCase();

  if (s === "freedom_school") return s;     // special bucket
  if (s.startsWith("channel")) return s;    // already bucket-like ("channel7")
  if (/^\d+$/.test(s)) return `channel${s}`;// digits as string → numeric channel

  // Fallback (rare): prefix
  return `channel${s}`;
}

/**
 * Resolve a playable URL from Program.mp4_url:
 * - Full http(s) or "/" → returned as-is
 * - "storage://bucket/key"
 * - "bucket:key"
 * - "bucket/key"
 * - Relative (e.g., "shows/0900.mp4") → resolved against per-channel bucket
 */
export function getVideoUrlForProgram(p: Program): string | undefined {
  const raw0 = p?.mp4_url ?? "";
  let raw = String(raw0).trim();
  if (!raw) return undefined;

  // Already a URL or root-relative
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

  // relative path → use channel bucket; strip accidental "channelX/" prefix
  const bucket = bucketNameForChannelId(p.channel_id);
  const key = cleanKey(raw).replace(/^channel[^/]+\/+/i, "");
  return buildPublicUrl(bucket, key);
}

/* ---------- Channels ---------- */

/** Fetch one channel by numeric id, text id, or slug (hyphen/underscore tolerant) */
export async function fetchChannelDetails(idOrSlug: string | number): Promise<Channel | null> {
  const raw = String(idOrSlug).trim();
  const slugAlt = raw.replace(/-/g, "_"); // in case you store underscores

  try {
    // 1) id = numeric (covers standard 1..N channels)
    const asNum = Number(raw);
    if (Number.isFinite(asNum)) {
      const { data, error } = await supabase
        .from("channels")
        .select("*")
        .eq("id", asNum)
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      if (data) return data as Channel;
    }

    // 2) id = text (covers '1' stored as text and any non-numeric id if present)
    {
      const { data, error } = await supabase
        .from("channels")
        .select("*")
        .eq("id", raw)
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      if (data) return data as Channel;
    }

    // 3) slug (exact hyphen form)
    {
      const { data, error } = await supabase
        .from("channels")
        .select("*")
        .eq("slug", raw)
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      if (data) return data as Channel;
    }

    // 4) slug (underscore-normalized form)
    if (slugAlt !== raw) {
      const { data, error } = await supabase
        .from("channels")
        .select("*")
        .eq("slug", slugAlt)
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      if (data) return data as Channel;
    }

    return null;
  } catch {
    return null;
  }
}
