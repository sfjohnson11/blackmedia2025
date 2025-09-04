// lib/supabase.ts
import { createClient } from "@supabase/supabase-js";

export const STANDBY_PLACEHOLDER_ID = "__standby__";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(url, anon, {
  auth: { persistSession: false },
});

// Read-only: fetch a single channel by id or slug
export async function fetchChannelDetails(channelIdOrSlug: string | number) {
  const base = supabase
    .from("channels")
    .select(
      "id, name, slug, description, logo_url, youtube_channel_id, youtube_is_live, is_active"
    )
    .limit(1);

  const query =
    typeof channelIdOrSlug === "number" || /^\d+$/.test(String(channelIdOrSlug))
      ? base.eq("id", Number(channelIdOrSlug))
      : base.eq("slug", String(channelIdOrSlug));

  const { data, error } = await query.single();
  if (error) return null;
  return data;
}

/**
 * Keep this deliberately simple:
 * - If program.mp4_url is http(s) or starts with '/', return as-is.
 * - If it's a storage-ish path (e.g., "shows/news/0900.mp4"), let the WATCH page resolve it.
 * - No DB writes, no schema assumptions.
 */
export function getVideoUrlForProgram(program: {
  mp4_url?: string | null;
}): string | undefined {
  const raw = (program?.mp4_url || "").trim();
  if (!raw) return undefined;
  if (/^https?:\/\//i.test(raw) || raw.startsWith("/")) return raw;
  return raw; // relative/storage path—WATCH page resolver will convert to public URL
}
