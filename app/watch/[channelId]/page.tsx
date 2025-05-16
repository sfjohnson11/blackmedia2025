'use client'

import { useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { useParams } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { getProgressFor } from "@/lib/continue"
import { FavoriteToggle } from "@/components/favorite-toggle"
import VideoPlayer from "@/components/video-player"

interface Program {
  id: string
  title: string
  mp4_url: string
  channel_id: number
}

export default function WatchPage() {
  const { channelId } = useParams()
  const searchParams = useSearchParams()
  const overrideVideo = searchParams.get("video")

  const [programs, setPrograms] = useState<Program[]>([])
  const [activeProgram, setActiveProgram] = useState<Program | null>(null)

  useEffect(() => {
    async function load() {
      const { data, error } = await supabase
        .from("programs")
        .select("*")
        .eq("channel_id", channelId)
        .order("start_time")

      if (error) {
        console.error("Error loading programs", error)
        return
      }

      setPrograms(data || [])

      // If ?video= is in the URL, find that program
      if (overrideVideo) {
        const match = (data || []).find(p => p.mp4_url === overrideVideo)
        if (match) {
          setActiveProgram(match)
        }
      } else {
        // Default: pick first
        setActiveProgram((data || [])[0] || null)
      }
    }

    load()
  }, [channelId, overrideVideo])

  if (!activeProgram) {
    return <div className="text-center pt-24 text-gray-400">Loading video...</div>
  }

  const videoSrc = `https://msllqpnxwbugvkpnquwx.supabase.co/storage/v1/object/public/channel${activeProgram.channel_id}/${activeProgram.mp4_url}`
  const progress = getProgressFor(videoSrc)

  return (
    <div className="pt-24 px-4 md:px-10">
      <h1 className="text-2xl font-bold mb-2 text-white">{activeProgram.title}</h1>
      <div className="mb-4">
        <FavoriteToggle programId={activeProgram.id} />
      </div>
      <VideoPlayer src={videoSrc} poster="" />
      {progress && (
        <p className="text-sm text-gray-400 mt-2">
          Resuming from {Math.floor(progress / 60)} min {Math.floor(progress % 60)} sec
        </p>
      )}
    </div>
  )
}
