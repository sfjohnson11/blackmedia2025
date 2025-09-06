// lib/supabase.ts
import type { SupabaseClient } from "@supabase/supabase-js";

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
  logo_url?: string | null;
  youtube_channel_id?: string | null;
  [k: string]: any;
};

export const STANDBY_PLACEHOLDER_ID = "standby-placeholder";

export function toUtcDate(val?: string | Date | null): Date | null {
  if (!val) return null;
  if (val instanceof Date) return Number.isNaN(val.getTime()) ? null : val;
  let s = String(val).trim();
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/.test(s)) s = s.replace(" ", "T");
  if (/[zZ]$/.test(s)) s = s.replace(/[zZ]$/, "Z");
  else if (/^\d{4}-\d{2}-\d{2}T/.test(s) && !/[+\-]\d{2}:\d{2}$/.test(s)) s += "Z";
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}
export const addSeconds = (d: Date, secs: number) => new Date(d.getTime() + secs * 1000);
export function parseDurationSec(v: number | string | null | undefined): number {
  if (typeof v === "number" && Number.isFinite(v)) return Math.max(0, Math.round(v));
  if (v == null) return 0;
  const n = Number(String(v).trim());
  return Number.isFinite(n) ? Math.max(0, Math.round(n)) : 0;
}

const cleanKey = (k: string) =>
  (k || "").trim().replace(/^\.?\//, "").replace(/\\/g, "/").replace(/\/{2,}/g, "/");

function bucketNameForChannelId(channel_id: number | string): string {
  const s = String(channel_id).trim().toLowerCase();
  if (/^\d+$/.test(s)) return `channel${s}`;
  if (s.startsWith("channel")) return s;
  return `channel${s}`;
}

function buildPublicUrl(client: SupabaseClient, bucket: string, objectPath: string): string | undefined {
  try {
    const key = cleanKey(objectPath);
    const { data } = client.storage.from(bucket).getPublicUrl(key);
    return data?.publicUrl || undefined;
  } catch { return undefined; }
}

export function getVideoUrlForProgram(client: SupabaseClient, p: Program): string | undefined {
  const raw = String(p?.mp4_url || "").trim();
  if (!raw) return undefined;
  if (/^https?:\/\//i.test(raw) || raw.startsWith("/")) return raw;

  let m = /^storage:\/\/([^/]+)\/(.+)$/.exec(raw);
  if (m) return buildPublicUrl(client, m[1], m[2]);
  m = /^([a-z0-9_\-]+):(.+)$/i.exec(raw);
  if (m) return buildPublicUrl(client, m[1], m[2]);
  m = /^([a-z0-9_\-]+)\/(.+)$/.exec(raw);
  if (m) return buildPublicUrl(client, m[1], m[2]);

  const bucket = bucketNameForChannelId(p.channel_id);
  const key = cleanKey(raw).replace(/^channel[^/]+\/+/i, "");
  return buildPublicUrl(client, bucket, key);
}

export async function fetchChannelDetails(client: SupabaseClient, id: number): Promise<Channel | null> {
  try {
    const { data, error } = await client.from("channels").select("*").eq("id", id).maybeSingle();
    if (error) throw error;
    return (data as Channel) ?? null;
  } catch { return null; }
}
