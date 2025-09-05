// lib/supabase.ts (add or replace your existing resolver)
import { supabase } from "./supabaseClient"; // or your local export
// import type { Program } from "@/types";   // keep your existing Program type

const ROOT = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/+$/, "");

function cleanKey(k: string) {
  return k.trim().replace(/^\.?\//, "").replace(/\\/g, "/").replace(/\/{2,}/g, "/");
}

function buildPublicUrl(bucket: string, objectPath: string): string | undefined {
  const key = cleanKey(objectPath);
  if (ROOT) return `${ROOT}/storage/v1/object/public/${bucket}/${key}`;
  try {
    // fallback if env var is missing
    const { data } = supabase.storage.from(bucket).getPublicUrl(key);
    return data?.publicUrl || undefined;
  } catch {
    return undefined;
  }
}

/**
 * Resolves the playable video URL for a program.
 * Accepts:
 *  - absolute URLs                 → pass through
 *  - "bucket:key"                  → public URL
 *  - "storage://bucket/key"        → public URL
 *  - "bucket/key" (pseudo path)    → public URL
 *  - "filename.mp4"                → channel{channel_id}/filename.mp4
 * Also strips accidental "channel{id}/" or "freedom_school/" prefixes.
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

  // bucket/key (pseudo)
  m = /^([a-z0-9_\-]+)\/(.+)$/i.exec(raw);
  if (m) {
    const [, bucket, key] = m;
    return buildPublicUrl(bucket, key);
  }

  // relative filename → channel bucket
  const bucket = `channel${Number(p.channel_id)}`;
  let key = cleanKey(raw)
    .replace(new RegExp(`^${bucket}/`, "i"), "")
    .replace(/^freedom_school\//i, ""); // tolerate that prefix if someone typed it

  return buildPublicUrl(bucket, key);
}
