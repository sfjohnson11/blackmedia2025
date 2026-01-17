import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/* ---------- Types (match YOUR schema) ---------- */
export type Program = {
  channel_id: number | string;
  title?: string | null;
  mp4_url?: string | null;
  duration?: number | string | null; // seconds or "HH:MM:SS" / "MM:SS"
  start_time?: string | null; // ISO-like string (UTC with Z preferred)
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

/* ---------- Storage public URLs ---------- */
const ROOT = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/+$/, "");
const cleanKey = (k: string) =>
  (k || "")
    .trim()
    .replace(/^\.?\//, "")
    .replace(/\\/g, "/")
    .replace(/\/{2,}/g, "/");

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

/* ---------- URL candidates: ONLY this channel’s bucket ---------- */
/** Candidate URLs for a program (tries the channel bucket; small defensive variant) */
export function getCandidateUrlsForProgram(p: Program): string[] {
  const raw = String(p?.mp4_url || "").trim();
  if (!raw) return [];

  // Absolute or root-relative given → use as-is
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

  // Bare filename → look ONLY in this channel’s bucket
  const cleaned = cleanKey(raw); // e.g. "show.mp4"
  const chanBucket = bucketNameForChannelId(p.channel_id); // "channelN"
  const stripped = cleaned.replace(/^channel[^/]+\/+/i, ""); // remove accidental "channelX/" prefix

  // 1) channelN/file.mp4
  // 2) channelN/channelN/file.mp4 (defensive: nested folder)
  const urls = new Set<string>([
    buildPublicUrl(chanBucket, stripped),
    buildPublicUrl(
      chanBucket,
      `channel${String(p.channel_id).toLowerCase()}/${stripped}`
    ),
  ]);

  return Array.from(urls);
}

/** Legacy helper: first candidate */
export function getVideoUrlForProgram(p: Program): string | undefined {
  const list = getCandidateUrlsForProgram(p);
  return list.length ? list[0] : undefined;
}

/* ---------- Channels ---------- */
export async function fetchChannelById(
  client: SupabaseClient,
  id: number | string
): Promise<Channel | null> {
  try {
    const { data, error } = await client
      .from("channels")
      .select("*")
      .eq("id", String(id))
      .maybeSingle();
    if (error) throw error;
    return (data as Channel) ?? null;
  } catch {
    return null;
  }
}

export const STANDBY_PLACEHOLDER_ID = "__standby__";

/* -------------------------------------------------------------------
   ✅ Missing exports required by your build
   These stop the "Attempted import error: not exported" warnings.
   They are SAFE placeholders and will not affect playback.
------------------------------------------------------------------- */

/** Used by /app/debug/rls-checker/page.tsx */
export async function listBuckets() {
  // If you later want real buckets, you must use a service-role key server-side.
  return { data: [], error: null };
}

/** Used by /app/debug/rls-checker/page.tsx */
export async function checkRLSStatus() {
  // Placeholder so build succeeds; wire real checks later if needed.
  return { ok: true, notes: "RLS checker placeholder (not wired)" };
}

/** Used by /app/history/page.tsx */
export async function getWatchProgress() {
  // Placeholder response until you connect a watch-progress table.
  return { data: [], error: null };
}
