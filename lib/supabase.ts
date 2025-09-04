// lib/supabase.ts (snippet – keep your existing supabase client export)
export async function fetchChannelDetails(idOrSlug: string) {
  const selectCols =
    "id, name, slug, description, logo_url, image_url, youtube_channel_id, youtube_is_live, is_active";

  const n = Number(idOrSlug);
  if (Number.isFinite(n)) {
    const { data, error } = await supabase
      .from("channels")
      .select(selectCols)
      .eq("id", n)
      .single();
    if (error) return null;
    return data;
  } else {
    const { data, error } = await supabase
      .from("channels")
      .select(selectCols)
      .eq("slug", idOrSlug)
      .single();
    if (error) return null;
    return data;
  }
}
