// lib/supabase.ts
import { createClient } from "@supabase/supabase-js";

/* Minimal types (avoid '@/types' during build) */
export type Program = {
  id: string | number;
  channel_id: number | string;
  title?: string | null;
  mp4_url?: string | null;
  duration?: number | null;
  start_time?: string | null;
  poster_url?: string | null;
  description?: string | null;
  [k: string]: any;
};
export type Channel = {
  id: number | string;
  name?: string | null;
  slug?: string | null;
  logo_url?: string | null;         // use this for poster
  youtube_channel_id?: string | null;
  [k: string]: any;
};

/** Supabase client (public anon) */
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
export const supabase = createClient(URL, KEY);

export const STANDBY_PLACEHOLDER_ID = "standby-placeholder";

/** Utilities */
export function toUtcDate(val?: string | Date | null): Date | null {
  if (!val) return null;
  if (val instanceof Date) return Number.isNaN(val.getTime()) ? null : val;
  let s = String(val).trim();
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(\.\d+)?$/.test(s)) s = s.replace(" ", "T") + "Z";
  else if (!/[zZ]|[+\-]\d{2}:\d{2}$/.test(s)) s = s + "Z";
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}
export function addSeconds(d: Date, secs: number) { return new Date(d.getTime() + secs * 1000); }

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
  m = /^([a-z0-9_\-]+)\/(.+)$/i.exec(raw);
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
      const { data, error } = await supabase.from("channels").select("*").eq("id", asNum).limit(1).maybeSingle();
      if (error) throw error;
      return (data as Channel) ?? null;
    } else {
      const { data, error } = await supabase.from("channels").select("*").eq("slug", String(idOrSlug)).limit(1).maybeSingle();
      if (error) throw error;
      return (data as Channel) ?? null;
    }
  } catch { return null; }
}
