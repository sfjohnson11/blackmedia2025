// lib/supabase.ts
import type { Program, Channel } from "@/types";
import { getSupabaseClient } from "@/utils/supabase/client";

// Use the same client util your app already uses
export const supabase = getSupabaseClient();

export const STANDBY_PLACEHOLDER_ID = "standby-placeholder";

const ROOT = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/+$/, "");

/** normalize storage keys */
function cleanKey(k: string) {
  return k.trim().replace(/^\.?\//, "").replace(/\\/g, "/").replace(/\/{2,}/g, "/");
}

/** Build a PUBLIC URL for a storage object, even if env is missing during build */
function buildPublicUrl(bucket: string, objectPath: string): string | undefined {
  const key = cleanKey(objectPath);
  // Preferred: use the project URL from env
  if (ROOT) return `${ROOT}/storage/v1/object/public/${bucket}/${key}`;
  // Fallback: let supabase client compose it (pure, no network)
  try {
    const { data } = supabase.storage.from(bucket).getPublicUrl(key);
    return data?.publicUrl || undefined;
  } catch {
    return undefined;
  }
}

/**
 * Resolve a playable URL from a Program row (PUBLIC buckets).
 * Accepts:
 *  - Absolute URLs:                 https://...              → pass through
 *  - storage://bucket/key:          → public URL
 *  - bucket:key                     → public URL
 *  - bucket/key                     → public URL
 *  - filename.mp4                   → public URL in channel{channel_id}/filename.mp4
 * Also tolerates accidental prefixes (channel{id}/, freedom_school/).
 */
export function getVideoUrlForProgram(p: Program): string | undefined {
  let raw = (p?.mp4_url || "").trim();
  if (!raw) return undefined;

  // absolute URL or absolute path
  if (/^https?:\/\//i.test(raw) || raw.startsWith("/")) return raw;

  // storage://bucket/key
  let m = /^storage:\/\/([^/]+)\/(.+)$/.exec(raw);
  if (m) {
    const [, bucket, key] = m;
    return buildPublicUrl(bucket, key);
  }

  // bucket:key
  m = /^([a-z0-9_\-]+):(.+)$/i.exec(raw);
  if (m) {
    const [, bucket, key] = m;
    return buildPublicUrl(bucket, key);
  }

  // bucket/key
  m = /^([a-z0-9_\-]+)\/(.+)$/i.exec(raw);
  if (m) {
    const [, bucket, key] = m;
    return buildPublicUrl(bucket, key);
  }

  // relative filename → live in channel{channel_id}
  const bucket = `channel${Number(p.channel_id)}`;
  let key = cleanKey(raw)
    .replace(new RegExp(`^${bucket}/`, "i"), "")
    .replace(/^freedom_school\//i, ""); // tolerate that prefix if someone typed it

  return buildPublicUrl(bucket, key);
}

/** Fetch one channel by id (number or string) or slug (string) */
export async function fetchChannelDetails(idOrSlug: string | number): Promise<Channel | null> {
  try {
    // decide whether it's an id or a slug
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
  } catch {
    return null;
  }
}
