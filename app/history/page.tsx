"use client"

import { useState, useEffect } from "react"
import { createClient } from "@supabase/supabase-js"
import Link from "next/link"
import Image from "next/image"
import { Clock, Loader2, Play, X } from "lucide-react"
import { Progress } from "@/components/ui/progress"
import { getWatchProgress } from "@/lib/supabase"

interface WatchHistoryItem {
  channelId: number
  timestamp: number
  progress: number
  duration: number
}

interface ChannelData {
  id: number
  name: string
  description: string
  image_url: string
}

export default function HistoryPage() {
  const [history, setHistory] = useState<WatchHistoryItem[]>([])
  const [channels, setChannels] = useState<Record<number, ChannelData>>({})
  const [loading, setLoading] = useState(true)

  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

  useEffect(() => {
    const loadHistory = async () => {
      try {
        // Get watch history from localStorage
        const watchHistory = getWatchProgress()

        if (Object.keys(watchHistory).length === 0) {
          setLoading(false)
          return
        }

        // Convert to array and sort by most recent
        const historyArray = Object.entries(watchHistory).map(([channelId, data]) => ({
          channelId: Number.parseInt(channelId),
          timestamp: data.timestamp,
          progress: data.progress,
          duration: data.duration,
        }))

        // Sort by most recent first
        historyArray.sort((a, b) => b.timestamp - a.timestamp)

        setHistory(historyArray)

        // Get channel details for all history items
        const channelIds = historyArray.map((item) => item.channelId)

        const { data, error } = await supabase
          .from("channels")
          .select("id, name, description, image_url")
          .in("id", channelIds)

        if (error) {
          throw error
        }

        // Convert to record for easy lookup
        const channelsRecord: Record<number, ChannelData> = {}
        data?.forEach((channel) => {
          channelsRecord[channel.id] = channel
        })

        setChannels(channelsRecord)
      } catch (error) {
        console.error("Error loading watch history:", error)
      } finally {
        setLoading(false)
      }
    }

    loadHistory()
  }, [])

  const removeFromHistory = (channelId: number) => {
    try {
      // Get current history
      const watchHistory = getWatchProgress()

      // Remove the item
      delete watchHistory[channelId]

      // Save back to localStorage
      localStorage.setItem("watchProgress", JSON.stringify(watchHistory))

      // Update state
      setHistory(history.filter((item) => item.channelId !== channelId))
    } catch (error) {
      console.error("Error removing history item:", error)
    }
  }

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp)
    return date.toLocaleDateString() + " " + date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
  }

  const formatDuration = (seconds: number) => {
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = Math.floor(seconds % 60)
    return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`
  }

  return (
    <div className="min-h-screen bg-black text-white pt-24 pb-16 px-4 md:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center mb-8">
          <Clock className="h-6 w-6 text-blue-500 mr-3" />
          <h1 className="text-3xl font-bold">Continue Watching</h1>
        </div>

        {loading ? (
          <div className="flex justify-center items-center h-64">
            <Loader2 className="h-8 w-8 text-red-600 animate-spin" />
          </div>
        ) : history.length === 0 ? (
          <div className="text-center py-16 bg-gray-900/50 rounded-lg">
            <Clock className="h-16 w-16 text-gray-700 mx-auto mb-4" />
            <h2 className="text-2xl font-medium text-gray-300 mb-2">No watch history yet</h2>
            <p className="text-gray-400 max-w-md mx-auto">Your recently watched channels will appear here</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {history.map((item) => {
              const channel = channels[item.channelId]
              if (!channel) return null

              return (
                <div key={item.channelId} className="bg-gray-900 rounded-lg overflow-hidden group relative">
                  <div className="aspect-video relative">
                    <Image
                      src={channel.image_url || "/placeholder.svg?height=180&width=320&query=channel"}
                      alt={channel.name}
                      fill
                      className="object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
                    <Link
                      href={`/watch/${item.channelId}`}
                      className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <div className="bg-red-600 rounded-full p-4">
                        <Play className="h-8 w-8 text-white" fill="white" />
                      </div>
                    </Link>
                  </div>

                  <div className="p-4">
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="font-medium text-lg text-white">{channel.name}</h3>
                      <button
                        onClick={() => removeFromHistory(item.channelId)}
                        className="text-gray-400 hover:text-white p-1"
                        aria-label="Remove from history"
                      >
                        <X className="h-5 w-5" />
                      </button>
                    </div>

                    <p className="text-sm text-gray-400 mb-3">Watched {formatDate(item.timestamp)}</p>

                    <div className="mb-1 flex justify-between text-xs text-gray-400">
                      <span>{formatDuration(item.progress)}</span>
                      <span>{formatDuration(item.duration)}</span>
                    </div>

                    <Progress value={(item.progress / item.duration) * 100} className="h-1 bg-gray-700" />
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
