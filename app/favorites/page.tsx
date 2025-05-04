"use client"

import { useState, useEffect } from "react"
import { createClient } from "@supabase/supabase-js"
import { ChannelGrid } from "@/components/channel-grid"
import { Heart, Loader2 } from "lucide-react"

export default function FavoritesPage() {
  const [favorites, setFavorites] = useState<number[]>([])
  const [channels, setChannels] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

  useEffect(() => {
    // Load favorites from localStorage
    const loadFavorites = () => {
      try {
        const storedFavorites = localStorage.getItem("favorites")
        if (storedFavorites) {
          return JSON.parse(storedFavorites)
        }
      } catch (error) {
        console.error("Error loading favorites:", error)
      }
      return []
    }

    const favoritesList = loadFavorites()
    setFavorites(favoritesList)

    // Fetch channel data for favorites
    const fetchFavoriteChannels = async () => {
      if (favoritesList.length === 0) {
        setLoading(false)
        return
      }

      try {
        const { data, error } = await supabase.from("channels").select("*").in("id", favoritesList)

        if (error) {
          throw error
        }

        setChannels(data || [])
      } catch (error) {
        console.error("Error fetching favorite channels:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchFavoriteChannels()
  }, [])

  const toggleFavorite = (channelId: number) => {
    try {
      // Remove from favorites
      const updatedFavorites = favorites.filter((id) => id !== channelId)
      setFavorites(updatedFavorites)
      localStorage.setItem("favorites", JSON.stringify(updatedFavorites))

      // Update channels list
      setChannels(channels.filter((channel) => channel.id !== channelId))
    } catch (error) {
      console.error("Error updating favorites:", error)
    }
  }

  return (
    <div className="min-h-screen bg-black text-white pt-24 pb-16 px-4 md:px-8">
      <div className="max-w-7xl mx-auto">
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
              Add channels to your favorites by clicking the heart icon while watching
            </p>
          </div>
        ) : (
          <ChannelGrid channels={channels} onFavoriteToggle={toggleFavorite} favorites={favorites} />
        )}
      </div>
    </div>
  )
}
