// lib/supabase.ts
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/* ---------- Types (match YOUR schema) ---------- */
export type Program = {
  channel_id: number | string;
  title?: string | null;
  mp4_url?: string | null;
  duration?: number | string | null;  // seconds or "HH:MM:SS" / "MM:SS"
  start_time?: string | null;         // ISO string (UTC with Z preferred)
  [k: string]: any;
};

export type Channel = {
  id: number | string;
  name?: string | null;
  slug?: string | null;
  description?: string | null;
  logo_url?: string | null;
  youtube_channel_id?: string | null;
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

/* ---------- Time helpers (optional but kept) ---------- */
export function addSeconds(d: Date, secs: number) {
  return new Date(d.getTime() + secs * 1000);
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

/* ---------- Tolerant URL resolver (SURGICAL FIX) ---------- */
const GLOBAL_FALLBACK_CHANNEL_ID = 3; // the channel that currently has the files

/** Candidate URLs for a program (tolerant to misnamed/misplaced files) */
export function getCandidateUrlsForProgram(p: Program): string[] {
  const raw = String(p?.mp4_url || "").trim();
  if (!raw) return [];

  // Absolute or root-relative
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

  // Bare filename -> try multiple safe locations
  const cleaned = cleanKey(raw); // e.g., "whitney.mp4"
  const chanBucket = bucketNameForChannelId(p.channel_id);                    // "channelN"
  const fallbackBucket = bucketNameForChannelId(GLOBAL_FALLBACK_CHANNEL_ID);  // "channel3"
  const stripped = cleaned.replace(/^channel[^/]+\/+/i, ""); // remove accidental "channelX/" prefix

  const urls = new Set<string>([
    // 1) Expected per-channel
    buildPublicUrl(chanBucket, stripped),                         // channelN/file.mp4
    // 2) Known-good CH3 fallback so others still play today
    buildPublicUrl(fallbackBucket, stripped),                     // channel3/file.mp4
    // 3) Defensive: double channel pattern we’ve seen
    buildPublicUrl(chanBucket, `channel${String(p.channel_id).toLowerCase()}/${stripped}`), // channelN/channelN/file.mp4
  ]);

  return Array.from(urls);
}

/** Legacy helper: first candidate */
export function getVideoUrlForProgram(p: Program): string | undefined {
  const list = getCandidateUrlsForProgram(p);
  return list.length ? list[0] : undefined;
}

/* ---------- Channels & Programs ---------- */
export async function fetchChannelById(client: SupabaseClient, id: number | string): Promise<Channel | null> {
  try {
    const { data, error } = await client.from("channels").select("*").eq("id", String(id)).maybeSingle();
    if (error) throw error;
    return (data as Channel) ?? null;
  } catch {
    return null;
  }
}

/* Optional: your existing fetchPrograms if you keep it elsewhere
export async function fetchProgramsForChannel(client: SupabaseClient, channelId: number): Promise<Program[]> {
  const { data, error } = await client
    .from("programs")
    .select("channel_id, title, mp4_url, start_time, duration")
    .eq("channel_id", channelId)
    .order("start_time", { ascending: true });
  if (error) throw error;
  return (data || []) as Program[];
}
*/

export const STANDBY_PLACEHOLDER_ID = "__standby__";
