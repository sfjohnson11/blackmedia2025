// lib/supabase.ts
import { createClient } from "@supabase/supabase-js";

/* Minimal types (kept simple; no extra fields) */
export type Program = {
  id: string | number;
  channel_id: number | string;
  title?: string | null;
  mp4_url?: string | null;
  duration?: number | string | null;
  start_time?: string | null;
  description?: string | null;
  [k: string]: any;
};

export type Channel = {
  id: number | string;
  name?: string | null;
  slug?: string | null;
  logo_url?: string | null;         // used for posters
  youtube_channel_id?: string | null;
  youtube_is_live?: boolean | null;
  [k: string]: any;
};

/** Supabase client (public anon) */
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
export const supabase = createClient(URL, KEY);

export const STANDBY_PLACEHOLDER_ID = "standby-placeholder";

/** ---------- Time utilities (UTC) ---------- */
export function toUtcDate(val?: string | Date | null): Date | null {
  if (!val) return null;
  if (val instanceof Date) return Number.isNaN(val.getTime()) ? null : val;

  let s = String(val).trim();
  if (!s) return null;

  // Has explicit timezone? normalize then parse
  const isoWithTz = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?([zZ]|[+\-]\d{2}:?\d{2})$/;
  if (isoWithTz.test(s)) {
    s = s.replace(" ", "T").replace(/([+\-]\d{2})(\d{2})$/, "$1:$2").replace(/[zZ]$/, "Z");
    const d = new Date(s);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  // ISO-like without timezone → interpret as UTC by components
  const isoNoTz = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?$/;
  let m = s.match(isoNoTz);
  if (m) {
    const [, Y, M, D, h, mi, se] = m;
    const d = new Date(Date.UTC(+Y, +M - 1, +D, +h, +mi, se ? +se : 0, 0));
    return Number.isNaN(d.getTime()) ? null : d;
  }

  // Date-only YYYY-MM-DD → UTC midnight
  const dateOnlyIso = /^(\d{4})-(\d{2})-(\d{2})$/;
  m = s.match(dateOnlyIso);
  if (m) {
    const [, Y, M, D] = m;
    const d = new Date(Date.UTC(+Y, +M - 1, +D, 0, 0, 0, 0));
    return Number.isNaN(d.getTime()) ? null : d;
  }

  // Fallback
  const fallback = new Date(s);
  return Number.isNaN(fallback.getTime()) ? null : fallback;
}

export function addSeconds(d: Date, secs: number) {
  return new Date(d.getTime() + secs * 1000);
}

/** Robust duration parser: "HH:MM:SS", "MM:SS", "2h15m", "90m", "45s", digits */
export function parseDurationSec(v: number | string | null | undefined): number {
  if (typeof v === "number") return Number.isFinite(v) && v > 0 ? v : 0;
  if (v == null) return 0;

  const s = String(v).trim().toLowerCase();
  if (!s) return 0;

  // HH:MM:SS
  let m = /^(\d+):([0-5]?\d):([0-5]?\d)$/.exec(s);
  if (m) return (+m[1]) * 3600 + (+m[2]) * 60 + (+m[3]);

  // MM:SS
  m = /^([0-5]?\d):([0-5]?\d)$/.exec(s);
  if (m) return (+m[1]) * 60 + (+m[2]);

  // 2h15m10s / 90m / 45s / 2h
  let total = 0;
  const re = /(\d+)\s*(h|hr|hrs|hour|hours|m|min|mins|minute|minutes|s|sec|secs|second|seconds)\b/g;
  let mm: RegExpExecArray | null;
  while ((mm = re.exec(s))) {
    const num = +mm[1];
    const unit = mm[2][0]; // h/m/s
    if (unit === "h") total += num * 3600;
    else if (unit === "m") total += num * 60;
    else if (unit === "s") total += num;
  }
  if (total > 0) return total;

  // Plain digits (assume seconds)
  const plain = /^\d+$/.test(s) ? +s : NaN;
  return Number.isFinite(plain) ? plain : 0;
}

/** ---------- Public storage URL helpers ---------- */
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

/** Video URL resolver for PUBLIC buckets (never touches logos) */
export function getVideoUrlForProgram(p: Program): string | undefined {
  let raw = (p?.mp4_url || "").trim();
  if (!raw) return undefined;

  // absolute URL or absolute path
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

  // relative filename → channel{channel_id}
  const bucket = `channel${Number(p.channel_id)}`;
  let key = cleanKey(raw)
    .replace(new RegExp(`^${bucket}/`, "i"), "")
    .replace(/^freedom_school\//i, ""); // tolerate common prefix

  return buildPublicUrl(bucket, key);
}

/** Fetch one channel (by id or slug) */
export async function fetchChannelDetails(idOrSlug: string | number): Promise<Channel | null> {
  try {
    const asNum = typeof idOrSlug === "number" ? idOrSlug : Number.parseInt(String(idOrSlug), 10);
    if (!Number.isNaN(asNum)) {
      const { data, error } = await supabase
        .from("channels").select("*").eq("id", asNum).limit(1).maybeSingle();
      if (error) throw error;
      return (data as Channel) ?? null;
    } else {
      const { data, error } = await supabase
        .from("channels").select("*").eq("slug", String(idOrSlug)).limit(1).maybeSingle();
      if (error) throw error;
      return (data as Channel) ?? null;
    }
  } catch {
    return null;
  }
}
