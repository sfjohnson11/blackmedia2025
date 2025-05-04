"use client"

import { useState, useEffect } from "react"
import { createClient } from "@supabase/supabase-js"
import Link from "next/link"
import Image from "next/image"
import { Play } from "lucide-react"
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
  image_url: string
}

export function ContinueWatching() {
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

        // Limit to 10 most recent
        const recentHistory = historyArray.slice(0, 10)

        setHistory(recentHistory)

        // Get channel details for all history items
        const channelIds = recentHistory.map((item) => item.channelId)

        const { data, error } = await supabase.from("channels").select("id, name, image_url").in("id", channelIds)

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

  if (loading || history.length === 0) {
    return null
  }

  return (
    <div className="mb-12">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl md:text-2xl font-bold text-white">Continue Watching</h2>
        <Link href="/history" className="text-sm text-gray-400 hover:text-white">
          See all
        </Link>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
        {history.map((item) => {
          const channel = channels[item.channelId]
          if (!channel) return null

          return (
            <div key={item.channelId} className="group relative">
              <div className="aspect-video relative rounded-md overflow-hidden">
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
                  <div className="bg-red-600 rounded-full p-3">
                    <Play className="h-6 w-6 text-white" fill="white" />
                  </div>
                </Link>
              </div>

              <Progress value={(item.progress / item.duration) * 100} className="h-1 bg-gray-700 mt-1" />

              <h3 className="text-sm font-medium text-white mt-2 truncate">{channel.name}</h3>
            </div>
          )
        })}
      </div>
    </div>
  )
}
