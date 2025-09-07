// lib/supabase.ts
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/* ---------- Types (match YOUR schema) ---------- */
export type Program = {
  id?: string | number;
  channel_id: number | string;
  title?: string | null;
  mp4_url?: string | null;
  duration?: number | string | null;  // seconds or "HH:MM:SS" / "MM:SS"
  start_time?: string | null;         // UTC-like string
  description?: string | null;
  poster_url?: string | null;
  [k: string]: any;
};

export type Channel = {
  id: number | string;                // channels.id (1..30)
  name?: string | null;
  slug?: string | null;
  description?: string | null;
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
export const supabase = getSupabase();

/* ---------- Time helpers (robust UTC) ---------- */
// Accepts: "...Z", "...+00", "...+0000", "...+00:00", or bare "YYYY-MM-DD HH:mm:ss"/ISO
export function toUtcDate(val?: string | Date | null): Date | null {
  if (!val) return null;
  if (val instanceof Date) return Number.isNaN(val.getTime()) ? null : val;

  let s = String(val).trim();

  // "YYYY-MM-DD HH:mm:ss" → "YYYY-MM-DDTHH:mm:ss"
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/.test(s)) s = s.replace(" ", "T");

  if (/[zZ]$/.test(s)) {
    s = s.replace(/[zZ]$/, "Z");
  } else {
    const m = /([+\-]\d{2})(:?)(\d{2})?$/.exec(s);
    if (m) {
      const hh = m[1];
      const mm = m[3] ?? "00";
      s = s.replace(/([+\-]\d{2})(:?)(\d{2})?$/, `${hh}:${mm}`);
      if (/([+\-]00:00)$/.test(s)) s = s.replace(/([+\-]00:00)$/, "Z");
    } else if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?$/.test(s)) {
      s += "Z"; // bare ISO → treat as UTC
    } else if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(?:\.\d+)?$/.test(s)) {
      s = s.replace(" ", "T") + "Z"; // bare datetime string → UTC
    }
  }

  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function addSeconds(d: Date, secs: number) {
  return new Date(d.getTime() + secs * 1000);
}

export function parseDurationSec(v: number | string | null | undefined): number {
  if (typeof v === "number") return v > 0 ? Math.round(v) : 0;
  if (v == null) return 0;
  const s = String(v).trim();

  // HH:MM:SS or MM:SS
  let m = /^(\d{1,3}):([0-5]?\d)(?::([0-5]?\d))?$/.exec(s);
  if (m) {
    const hh = m[3] ? Number(m[1]) : 0;
    const mm = Number(m[3] ? m[2] : m[1]);
    const ss = Number(m[3] ? m[3] : m[2]);
    const total = hh * 3600 + mm * 60 + ss;
    return total > 0 ? total : 0;
  }

  // plain numeric (allow decimals)
  const num = Number(s.replace(/[^\d.]+/g, ""));
  return Number.isFinite(num) && num > 0 ? Math.round(num) : 0;
}

/* ---------- Storage public URLs ---------- */
const ROOT = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/+$/, "");
const cleanKey = (k: string) =>
  (k || "").trim().replace(/^\.?\//, "").replace(/\\/g, "/").replace(/\/{2,}/g, "/");

function safeEncodePath(path: string) {
  return cleanKey(path)
    .split("/")
    .map((seg) => {
      try {
        return encodeURIComponent(decodeURIComponent(seg));
      } catch {
        return encodeURIComponent(seg);
      }
    })
    .join("/");
}

function buildPublicUrl(bucket: string, objectPath: string): string {
  return `${ROOT}/storage/v1/object/public/${bucket}/${safeEncodePath(objectPath)}`;
}

function bucketNameForChannelId(channel_id: number | string): string {
  const s = String(channel_id).trim().toLowerCase();
  return /^\d+$/.test(s) ? `channel${s}` : `channel${s}`;
}

/** Candidate URLs for a program (tries both common layouts for safety) */
export function getCandidateUrlsForProgram(p: Program): string[] {
  const raw = String(p?.mp4_url || "").trim();
  if (!raw) return [];

  // absolute or root-relative
  if (/^https?:\/\//i.test(raw) || raw.startsWith("/")) return [raw];

  // storage://bucket/key
  let m = /^storage:\/\/([^/]+)\/(.+)$/.exec(raw);
  if (m) return [buildPublicUrl(m[1], m[2])];

  // bucket:key
  m = /^([a-z0-9_\-]+):(.+)$/i.exec(raw);
  if (m) return [buildPublicUrl(m[1], m[2])];

  // bucket/key
  m = /^([a-z0-9_\-]+)\/(.+)$/.exec(raw);
  if (m) return [buildPublicUrl(m[1], m[2])];

  // relative → resolve against the channel bucket
  const bucket = bucketNameForChannelId(p.channel_id);
  const cleaned = cleanKey(raw);
  const stripped = cleaned.replace(/^channel[^/]+\/+/i, "");

  const urls = new Set<string>();
  urls.add(buildPublicUrl(bucket, stripped)); // expected: key without "channelX/" prefix
  urls.add(buildPublicUrl(bucket, cleaned));  // also try as-is (in case object key includes "channelX/")

  return Array.from(urls);
}

/** Single URL (first candidate) — legacy helper */
export function getVideoUrlForProgram(p: Program): string | undefined {
  const list = getCandidateUrlsForProgram(p);
  return list.length ? list[0] : undefined;
}

/** Back-compat for any old imports elsewhere */
export function getCandidateUrlsForProgramLegacy(p: Program): string[] {
  return getCandidateUrlsForProgram(p);
}

/* ---------- Channels & Programs ---------- */
export async function fetchChannelById(client: SupabaseClient, id: number): Promise<Channel | null> {
  try {
    const { data, error } = await client.from("channels").select("*").eq("id", id).maybeSingle();
    if (error) throw error;
    return (data as Channel) ?? null;
  } catch {
    return null;
  }
}

export async function fetchProgramsForChannel(client: SupabaseClient, channelId: number): Promise<Program[]> {
  const { data, error } = await client
    .from("programs")
    .select("id, channel_id, title, mp4_url, start_time, duration, description, poster_url")
    .eq("channel_id", channelId)
    .order("start_time", { ascending: true });
  if (error) throw error;
  return (data || []) as Program[];
}
