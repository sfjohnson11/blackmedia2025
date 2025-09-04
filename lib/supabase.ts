// lib/supabase.ts
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
export const supabase = createClient(url, anon);

export const STANDBY_PLACEHOLDER_ID = "standby-placeholder";

export async function fetchChannelDetails(channelIdOrSlug: string) {
  const asNum = Number(channelIdOrSlug);
  if (!Number.isNaN(asNum)) {
    const { data } = await supabase
      .from("channels")
      .select("id, name, slug, description, logo_url, image_url, youtube_channel_id, youtube_is_live, is_active")
      .eq("id", asNum)
      .maybeSingle();
    if (data) return data as any;
  }
  const { data: bySlug } = await supabase
    .from("channels")
    .select("id, name, slug, description, logo_url, image_url, youtube_channel_id, youtube_is_live, is_active")
    .eq("slug", channelIdOrSlug)
    .maybeSingle();
  if (bySlug) return bySlug as any;

  const { data: byId } = await supabase
    .from("channels")
    .select("id, name, slug, description, logo_url, image_url, youtube_channel_id, youtube_is_live, is_active")
    .eq("id", channelIdOrSlug)
    .maybeSingle();
  return byId as any;
}

export function getVideoUrlForProgram(program: any): string | undefined {
  return program?.mp4_url ?? undefined;
}
