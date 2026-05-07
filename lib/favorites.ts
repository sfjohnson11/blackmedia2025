// lib/favorites.ts
import { createClient } from "@/utils/supabase/client";

export async function getFavorites(): Promise<string[]> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("user_favorites")
    .select("channel_id")
    .eq("user_id", user.id);

  if (error) {
    console.error("Error loading favorites:", error);
    return [];
  }
  return (data ?? []).map((row) => row.channel_id);
}

export async function toggleFavorite(channelId: string | number): Promise<boolean> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;

  const id = String(channelId);

  // Try to delete first; if nothing was deleted, insert
  const { data: existing } = await supabase
    .from("user_favorites")
    .select("id")
    .eq("user_id", user.id)
    .eq("channel_id", id)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from("user_favorites")
      .delete()
      .eq("id", existing.id);
    if (error) {
      console.error("Error removing favorite:", error);
      return true; // still favorited (delete failed)
    }
    return false; // no longer favorited
  } else {
    const { error } = await supabase
      .from("user_favorites")
      .insert({ user_id: user.id, channel_id: id });
    if (error) {
      console.error("Error adding favorite:", error);
      return false;
    }
    return true; // now favorited
  }
}

export async function isFavorited(channelId: string | number): Promise<boolean> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;

  const { data } = await supabase
    .from("user_favorites")
    .select("id")
    .eq("user_id", user.id)
    .eq("channel_id", String(channelId))
    .maybeSingle();

  return !!data;
}
