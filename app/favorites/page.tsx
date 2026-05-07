"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";
import { ChannelGrid } from "@/components/channel-grid";
import { Button } from "@/components/ui/button";
import { Heart, Loader2, ArrowLeft } from "lucide-react";
import { getFavorites, toggleFavorite as toggleFavoriteRemote } from "@/lib/favorites";

export default function FavoritesPage() {
  const [favorites, setFavorites] = useState<string[]>([]);
  const [channels, setChannels] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const favIds = await getFavorites();
        if (cancelled) return;
        setFavorites(favIds);

        if (favIds.length === 0) {
          setChannels([]);
          return;
        }

        const supabase = createClient();
        const { data, error } = await supabase
          .from("channels")
          .select("*")
          .in("id", favIds);

        if (error) {
          console.error("Error fetching favorite channels:", error);
          setChannels([]);
        } else if (!cancelled) {
          setChannels(data ?? []);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  async function handleToggle(channelId: string | number) {
    const idStr = String(channelId);
    const stillFavorited = await toggleFavoriteRemote(idStr);
    if (!stillFavorited) {
      setFavorites((prev) => prev.filter((id) => id !== idStr));
      setChannels((prev) => prev.filter((c) => String(c.id) !== idStr));
    }
  }

  return (
    <div className="min-h-screen bg-black text-white pt-24 pb-16 px-4 md:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-4">
          <Link href="/app">
            <Button
              variant="outline"
              className="flex items-center gap-2 border-amber-500/50 text-amber-300 hover:bg-amber-500/10 hover:text-amber-200"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Member Hub
            </Button>
          </Link>
        </div>

        <div className="flex items-center mb-8">
          <Heart className="h-6 w-6 text-red-500 mr-3" />
          <h1 className="text-3xl font-bold">My Favorites</h1>
        </div>

        {loading ? (
          <div className="flex justify-center items-center h-64">
            <Loader2 className="h-8 w-8 text-red-600 animate-spin" />
          </div>
        ) : favorites.length === 0 ? (
          <div className="text-center py-16 bg-gray-900/50 rounded-lg">
            <Heart className="h-16 w-16 text-gray-700 mx-auto mb-4" />
            <h2 className="text-2xl font-medium text-gray-300 mb-2">No favorites yet</h2>
            <p className="text-gray-400 max-w-md mx-auto">
              Add channels to your favorites by clicking the heart icon while watching.
            </p>
          </div>
        ) : (
          <ChannelGrid channels={channels} onFavoriteToggle={handleToggle} favorites={favorites} />
        )}
      </div>
    </div>
  );
}
