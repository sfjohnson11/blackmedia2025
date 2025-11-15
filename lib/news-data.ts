// lib/news-data.ts
import { supabase } from "@/lib/supabase";

/** Load all ticker items from Supabase */
export async function getNewsItems(): Promise<string[]> {
  const { data, error } = await supabase
    .from("news_ticker")
    .select("text")
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Error loading news:", error);
    return [];
  }

  return data?.map((row: any) => row.text) ?? [];
}

/** Save entire list (CLEAR + INSERT NEW) */
export async function saveNewsItems(items: string[]) {
  try {
    // Remove all existing rows
    const del = await supabase
      .from("news_ticker")
      .delete()
      .neq("id", "00000000-0000-0000-0000-000000000000"); // dummy condition to delete all

    if (del.error) throw del.error;

    // Insert new list if any
    if (items.length > 0) {
      const { error } = await supabase.from("news_ticker").insert(
        items.map((text) => ({ text }))
      );
      if (error) throw error;
    }

    return { ok: true };
  } catch (err: any) {
    console.error("Save error:", err);
    return { ok: false, error: err.message };
  }
}
