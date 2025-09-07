// lib/supabase.ts
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/* ---------- Types (match YOUR schema) ---------- */
export type Program = {
  channel_id: number | string;
  title?: string | null;
  mp4_url?: string | null;
  duration?: number | string | null;  // seconds
  start_time?: string | null;         // UTC-like string
  description?: string | null;
  [k: string]: any;
};

export type Channel = {
  id: number | string;                // channels.id (1..30)
  name?: string | null;
  slug?: string | null;
  logo_url?: string | null;
  youtube_channel_id?: string | null; // CH21 embeds YouTube Live if present
  [k: string]: any;
};

/* ---------- Supabase client ---------- */
export function getSupabase(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Back-compat: many pages import { supabase } from "@/lib/supabase" */
export const supabase = getSupabase();

/* ---------- Time (UTC + seconds) ---------- */
export function toUtcDate(val?: string | Date | null): Date | null {
  if (!val) return null;
  if (val instanceof Date) return Number.isNaN(val.getTime()) ? null : val;
  let s = String(val).trim();

  // "YYYY-MM-DD HH:mm:ss..." -> "YYYY-MM-DDTHH:mm:ss..."
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/.test(s)) s = s.replace(" ", "T");

  // Normalize trailing Z / offsets (+00, +0000, +00:00, -05, -0500, -05:00)
  if (/[zZ]$/.test(s)) {
    s = s.replace(/[zZ]$/, "Z");
  } else {
    const m = /([+\-]\d{2})(:?)(\d{2})?$/.exec(s);
    if (m) {
      const hh = m[1];
      const mm = m[3] ?? "00";
      s = s.replace(/([+\-]\d{2})(:?)(\d{2})?$/, `${hh}:${mm}`);
      if (/\+00:00$/.test(s) || /\-00:00$/.test(s)) s = s.replace(/([+\-]00:00)$/, "Z");
    } else if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?$/.test(s)) {
      s += "Z"; // bare ISO -> treat as UTC
    }
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
  const n = Number(String(v).trim().match(/^\d+/)?.[0] ?? "0");
  return Number.isFinite(n) ? Math.max(0, Math.round(n)) : 0;
}

/* ---------- Storage (PUBLIC buckets) ---------- */
const ROOT = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/+$/, "");
const cleanKey = (k: string) =>
  (k || "").trim().replace(/^\.?\//, "").replace(/\\/g, "/").replace(/\/{2,}/g, "/");

function buildPublicUrl(bucket: string, objectPath: string): string {
  const key = cleanKey(objectPath);
  return `${ROOT}/storage/v1/object/public/${bucket}/${key}`;
}

function bucketNameForChannelId(channel_id: number | string): string {
  const s = String(channel_id).trim().toLowerCase();
  return /^\d+$/.test(s) ? `channel${s}` : `channel${s}`;
}

/** Resolve a playable URL from a Program row using its channel_id. */
export function getVideoUrlForProgram(p: Program): string | undefined {
  const raw = String(p?.mp4_url || "").trim();
  if (!raw) return undefined;

  // Absolute or root-relative
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

  // relative file → resolve against the channel bucket
  const bucket = bucketNameForChannelId(p.channel_id);
  const key = cleanKey(raw).replace(/^channel[^/]+\/+/i, "");
  return buildPublicUrl(bucket, key);
}

/* ---------- Channels ---------- */
export async function fetchChannelById(
  client: SupabaseClient,
  id: number
): Promise<Channel | null> {
  try {
    const { data, error } = await client
      .from("channels")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    return (data as Channel) ?? null;
  } catch {
    return null;
  }
}

/* ---------- Programs (by Programs.channel_id) ---------- */
export async function fetchProgramsForChannel(
  client: SupabaseClient,
  channelId: number
): Promise<Program[]> {
  const { data, error } = await client
    .from("programs")
    .select("channel_id, title, mp4_url, start_time, duration")
    .eq("channel_id", channelId)
    .order("start_time", { ascending: true });
  if (error) throw error;
  return (data || []) as Program[];
}

/* ---------- Back-compat helpers used by admin/debug pages ---------- */
export async function listBuckets(client: SupabaseClient = supabase) {
  try {
    const { data, error } = await client.storage.listBuckets();
    if (error) throw error;
    return data ?? [];
  } catch {
    return [];
  }
}

export async function checkRLSStatus(client: SupabaseClient = supabase) {
  // Tries to read minimal rows to see if anon RLS allows public read
  try {
    const { error: chErr } = await client.from("channels").select("id").limit(1);
    const { error: prErr } = await client.from("programs").select("channel_id").limit(1);
    return { channelsReadable: !chErr, programsReadable: !prErr };
  } catch {
    return { channelsReadable: false, programsReadable: false };
  }
}

export async function getWatchProgress(/* userId?: string */) {
  // Stub to keep pages compiling; adjust to your real schema later
  return [];
}
