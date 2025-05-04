"use client"

import { useEffect, useState } from "react"
import { VideoPlayer } from "./video-player"
import { LongVideoPlayer } from "./long-video-player"
import { shouldDisableAutoRefresh } from "@/lib/supabase"
import type { Channel, Program } from "@/types"

interface SmartVideoPlayerProps {
  channel: Channel
  initialProgram: Program | null
  upcomingPrograms: Program[]
}

export function SmartVideoPlayer({ channel, initialProgram, upcomingPrograms }: SmartVideoPlayerProps) {
  const [useLongPlayer, setUseLongPlayer] = useState(false)
  const [videoUrl, setVideoUrl] = useState<string | null>(null)

  useEffect(() => {
    // Check if we should use the long player based on video duration
    if (initialProgram && initialProgram.duration) {
      const shouldUseLongPlayer = shouldDisableAutoRefresh(initialProgram.duration)
      setUseLongPlayer(shouldUseLongPlayer)

      if (shouldUseLongPlayer) {
        console.log(`Using long video player for ${initialProgram.duration}s video`)

        // For long videos, we'll use the mp4_url directly to avoid refresh issues
        setVideoUrl(initialProgram.mp4_url)
      }
    }
  }, [initialProgram])

  // For long videos (>10 minutes), use the specialized player
  if (useLongPlayer && initialProgram && videoUrl) {
    return (
      <div className="w-full">
        <LongVideoPlayer
          src={videoUrl}
          title={initialProgram.title || `${channel.name} Program`}
          programId={initialProgram.id}
          poster={`/placeholder.svg?height=720&width=1280&query=${encodeURIComponent(channel.name)}`}
        />

        {/* Program info */}
        <div className="mt-4 p-4 bg-gray-900 rounded-lg">
          <h2 className="text-xl font-bold mb-2">{initialProgram.title}</h2>
          <p className="text-gray-400">
            Channel: {channel.name} • Duration: {Math.floor(initialProgram.duration / 60)}:
            {(initialProgram.duration % 60).toString().padStart(2, "0")}
          </p>
        </div>
      </div>
    )
  }

  // For regular videos, use the standard player
  return <VideoPlayer channel={channel} initialProgram={initialProgram} upcomingPrograms={upcomingPrograms} />
}
