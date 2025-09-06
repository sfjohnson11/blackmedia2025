// lib/supabase.ts
import type { SupabaseClient } from "@supabase/supabase-js";

/* ---------- Types (match your tables) ---------- */
export type Program = {
  channel_id: number;             // 1..30
  title?: string | null;
  mp4_url?: string | null;        // filename OR bucket/key OR storage://bucket/key OR full URL
  start_time?: string | null;     // UTC-ish string
  duration?: number | string | null;
  [k: string]: any;
};

export type Channel = {
  channel_id: number;             // 1..30
  name?: string | null;
  slug?: string | null;
  description?: string | null;
  logo_url?: string | null;
  youtube_channel_id?: string | null;
  youtube_is_live?: boolean | null;
  [k: string]: any;
};

export const STANDBY_PLACEHOLDER_ID = "standby-placeholder";

/* ---------- Time (UTC + seconds) ---------- */
export function toUtcDate(val?: string | Date | null): Date | null {
  if (!val) return null;
  if (val instanceof Date) return Number.isNaN(val.getTime()) ? null : val;

  let s = String(val).trim();

  // "YYYY-MM-DD HH:mm:ss..." -> "YYYY-MM-DDTHH:mm:ss..."
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/.test(s)) s = s.replace(" ", "T");

  // Normalize Z or offsets (+00, +0000, +00:00, -05, -0500, -05:00)
  if (/[zZ]$/.test(s)) {
    s = s.replace(/[zZ]$/, "Z");
  } else if (/([+\-]\d{2})(:?)(\d{2})?$/.test(s)) {
    s = s.replace(
      /([+\-]\d{2})(:?)(\d{2})?$/,
      (_match: string, hours: string, _colon: string, minutes?: string) =>
        `${hours}:${minutes ?? "00"}`
    );
    if (/\+00:00$/.test(s) || /\-00:00$/.test(s)) s = s.replace(/([+\-]00:00)$/, "Z");
  } else if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?$/.test(s)) {
    s = s + "Z"; // bare ISO -> assume UTC
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

/* ---------- Storage URL builder (PUBLIC buckets) ---------- */
const ROOT = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/+$/, "");
const cleanKey = (k: string) =>
  (k || "").trim().replace(/^\.?\//, "").replace(/\\/g, "/").replace(/\/{2,}/g, "/");

function buildPublicUrl(bucket: string, objectPath: string): string | undefined {
  const key = cleanKey(objectPath);
  if (!ROOT) return undefined;
  return `${ROOT}/storage/v1/object/public/${bucket}/${key}`;
}

/** bucket name: channel1, channel2, … */
function bucketForChannelId(channel_id: number): string {
  return `channel${channel_id}`;
}

/** Resolve playable URL from Program.mp4_url. */
export function getVideoUrlForProgram(p: Program): string | undefined {
  const raw0 = p?.mp4_url ?? "";
  let raw = String(raw0).trim();
  if (!raw) return undefined;

  if (/^https?:\/\//i.test(raw) || raw.startsWith("/")) return raw;        // absolute
  let m = /^storage:\/\/([^/]+)\/(.+)$/.exec(raw);                         // storage://bucket/key
  if (m) return buildPublicUrl(m[1], m[2]);
  m = /^([a-z0-9_\-]+):(.+)$/i.exec(raw);                                  // bucket:key
  if (m) return buildPublicUrl(m[1], m[2]);
  m = /^([a-z0-9_\-]+)\/(.+)$/.exec(raw);                                  // bucket/key
  if (m) return buildPublicUrl(m[1], m[2]);

  // filename only → use that channel's public bucket
  const bucket = bucketForChannelId(Number(p.channel_id));
  const key = cleanKey(raw).replace(/^channel[^/]+\/+/i, "");
  return buildPublicUrl(bucket, key);
}

/* ---------- Channels (channel_id is INT) ---------- */
export async function fetchChannelDetails(
  supabase: SupabaseClient,
  channelId: number
): Promise<Channel | null> {
  try {
    const { data, error } = await supabase
      .from("channels")
      .select("*")
      .eq("channel_id", channelId)
      .maybeSingle();
    if (error) throw error;
    return (data as Channel) ?? null;
  } catch {
    return null;
  }
}
