// lib/supabase.ts
import type { SupabaseClient } from "@supabase/supabase-js";

/* ---------- Types (match YOUR schema exactly) ---------- */
export type Channel = {
  id: number;                       // 1..30
  name?: string | null;
  slug?: string | null;
  description?: string | null;
  logo_url?: string | null;
  youtube_channel_id?: string | null;
  youtube_is_live?: boolean | null;
  [k: string]: any;
};

export type Program = {
  channel_id: number;               // FK to channels.id
  title?: string | null;
  mp4_url?: string | null;
  start_time?: string | null;       // UTC string
  duration?: number | string | null; // seconds
  [k: string]: any;
};

export const STANDBY_PLACEHOLDER_ID = "standby-placeholder";

/* ---------- Time helpers (UTC + seconds) ---------- */
export function toUtcDate(val?: string | Date | null): Date | null {
  if (!val) return null;
  if (val instanceof Date) return Number.isNaN(val.getTime()) ? null : val;

  let s = String(val).trim();
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/.test(s)) s = s.replace(" ", "T");
  if (/[zZ]$/.test(s)) s = s.replace(/[zZ]$/, "Z");
  else if (/([+\-]\d{2})(:?)(\d{2})?$/.test(s)) {
    s = s.replace(
      /([+\-]\d{2})(:?)(\d{2})?$/,
      (_m, h: string, _c: string, m?: string) => `${h}:${m ?? "00"}`
    ).replace(/([+\-]00:00)$/, "Z");
  } else if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?$/.test(s)) {
    s += "Z";
  }
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}
export function addSeconds(d: Date, secs: number) {
  return new Date(d.getTime() + secs * 1000);
}
export function parseDurationSec(v: number | string | null | undefined): number {
  if (typeof v === "number" && Number.isFinite(v)) return Math.max(0, Math.round(v));
  if (v == null) return 0;
  const n = Number(String(v).trim());
  return Number.isFinite(n) ? Math.max(0, Math.round(n)) : 0;
}

/* ---------- Public storage URL builder ---------- */
const ROOT = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/+$/, "");
const cleanKey = (k: string) => (k || "").trim().replace(/^\.?\//, "").replace(/\\/g, "/").replace(/\/{2,}/g, "/");
const bucketForChannel = (n: number) => `channel${n}`;

function buildPublicUrl(bucket: string, objectPath: string): string | undefined {
  if (!ROOT) return undefined;
  return `${ROOT}/storage/v1/object/public/${bucket}/${cleanKey(objectPath)}`;
}

/** Resolve playable URL from Program.mp4_url. */
export function getVideoUrlForProgram(p: Program): string | undefined {
  const raw = String(p?.mp4_url ?? "").trim();
  if (!raw) return undefined;

  if (/^https?:\/\//i.test(raw) || raw.startsWith("/")) return raw;   // absolute
  let m = /^storage:\/\/([^/]+)\/(.+)$/.exec(raw);                    // storage://bucket/key
  if (m) return buildPublicUrl(m[1], m[2]);
  m = /^([a-z0-9_\-]+):(.+)$/i.exec(raw);                             // bucket:key
  if (m) return buildPublicUrl(m[1], m[2]);
  m = /^([a-z0-9_\-]+)\/(.+)$/.exec(raw);                             // bucket/key
  if (m) return buildPublicUrl(m[1], m[2]);

  // filename only → use channel bucket
  const bucket = bucketForChannel(Number(p.channel_id));
  const key = cleanKey(raw).replace(/^channel[^/]+\/+/i, "");
  return buildPublicUrl(bucket, key);
}

/* ---------- DB helpers wired to YOUR keys ---------- */
export async function fetchChannelDetails(
  supabase: SupabaseClient,
  id: number
): Promise<Channel | null> {
  const { data, error } = await supabase
    .from("channels")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) return null;
  return (data as Channel) ?? null;
}

export async function fetchProgramsForChannel(
  supabase: SupabaseClient,
  id: number
): Promise<Program[]> {
  const { data, error } = await supabase
    .from("programs")
    .select("channel_id, title, mp4_url, start_time, duration")
    .eq("channel_id", id)
    .order("start_time", { ascending: true });
  if (error) return [];
  return (data || []) as Program[];
}
