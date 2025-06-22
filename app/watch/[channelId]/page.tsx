"use client"

import { type ReactNode, useEffect, useState, useCallback } from "react"
import { useParams, useRouter } from "next/navigation"
import VideoPlayer from "@/components/video-player"
import {
  getVideoUrlForProgram,
  getFullUrl,
  fetchChannelDetails,
  supabase,
  STANDBY_PLACEHOLDER_ID,
} from "@/lib/supabase"
import type { Program, Channel } from "@/types"
import { ChevronLeft, Loader2 } from "lucide-react"

export default function WatchPage() {
  const params = useParams()
  const router = useRouter()
  const channelIdString = params.channelId as string

  const [validatedNumericChannelId, setValidatedNumericChannelId] = useState<number | null>(null)
  const [currentProgram, setCurrentProgram] = useState<Program | null>(null)
  const [channelDetails, setChannelDetails] = useState<Channel | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [videoPlayerKey, setVideoPlayerKey] = useState(Date.now())

  useEffect(() => {
    if (!channelIdString) {
      setError("Channel ID is missing.")
      setIsLoading(false)
      return
    }
    const numericId = Number.parseInt(channelIdString, 10)
    if (isNaN(numericId)) {
      setError("Invalid channel ID.")
      setIsLoading(false)
      return
    }
    setValidatedNumericChannelId(numericId)
    setError(null)
    const loadChannelDetails = async () => {
      setIsLoading(true)
      const details = await fetchChannelDetails(channelIdString)
      setChannelDetails(details)
      if (!details) setError((prev) => prev || "Could not load channel details.")
    }
    loadChannelDetails()
  }, [channelIdString])

  const fetchCurrentProgram = useCallback(async (numericChannelId: number) => {
    setIsLoading(true)
    try {
      const { data: programsData, error: dbError } = await supabase
        .from("programs")
        .select("*, duration")
        .eq("channel_id", numericChannelId)
        .order("start_time", { ascending: true })

      if (dbError) throw new Error(dbError.message)

      const programs = programsData as Program[]
      const now = new Date()
      const activeProgram = programs?.find((p) => {
        if (!p.start_time || typeof p.duration !== "number") return false
        const start = new Date(p.start_time)
        const end = new Date(start.getTime() + p.duration * 1000)
        return now >= start && now < end
      })

      if (activeProgram) {
        setCurrentProgram((prev) => {
          if (prev?.id !== activeProgram.id) setVideoPlayerKey(Date.now())
          return { ...activeProgram, channel_id: numericChannelId }
        })
      } else {
        setCurrentProgram((prev) => {
          const newStandby = {
            id: STANDBY_PLACEHOLDER_ID,
            title: "Standby",
            description: "Programming will resume shortly.",
            channel_id: numericChannelId,
            mp4_url: `channel${numericChannelId}/standby_blacktruthtv.mp4`,
            duration: 300,
            start_time: now.toISOString(),
            poster_url: null,
          }
          if (prev?.id !== STANDBY_PLACEHOLDER_ID) setVideoPlayerKey(Date.now())
          return newStandby
        })
      }
    } catch (e: any) {
      setError(e.message)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    if (validatedNumericChannelId !== null) {
      fetchCurrentProgram(validatedNumericChannelId)
      const intervalId = setInterval(() => fetchCurrentProgram(validatedNumericChannelId), 60000)
      return () => clearInterval(intervalId)
    }
  }, [validatedNumericChannelId, fetchCurrentProgram])

  const videoSrc = currentProgram ? getVideoUrlForProgram(currentProgram) : undefined
  const posterSrc = currentProgram?.poster_url ? getFullUrl(currentProgram.poster_url) : undefined
  const isStandbyProgram = currentProgram?.id === STANDBY_PLACEHOLDER_ID

  const handleProgramEnded = useCallback(() => {
    if (validatedNumericChannelId !== null) {
      fetchCurrentProgram(validatedNumericChannelId)
    }
  }, [validatedNumericChannelId, fetchCurrentProgram])

  let content: ReactNode
  if (error) {
    content = <p className="text-red-400 p-4 text-center">Error: {error}</p>
  } else if (isLoading && !currentProgram) {
    content = (
      <div className="flex flex-col items-center justify-center h-full">
        <Loader2 className="h-10 w-10 animate-spin text-red-500 mb-2" />
        <p>Loading Channel...</p>
      </div>
    )
  } else if (currentProgram && videoSrc) {
    content = (
      <VideoPlayer
        key={videoPlayerKey}
        src={videoSrc}
        poster={posterSrc}
        isStandby={isStandbyProgram}
        programTitle={currentProgram?.title}
        onVideoEnded={isStandbyProgram ? undefined : handleProgramEnded}
      />
    )
  } else {
    content = <p className="text-gray-400 p-4 text-center">Initializing channel...</p>
  }

  return (
    <div className="bg-black min-h-screen flex flex-col text-white">
      <div className="p-4 flex items-center justify-between bg-gray-900/50 sticky top-0 z-10">
        <button onClick={() => router.back()} className="p-2 rounded-full hover:bg-gray-700" aria-label="Go back">
          <ChevronLeft className="h-6 w-6" />
        </button>
        <h1 className="text-xl font-semibold truncate px-2">{channelDetails?.name || `Channel ${channelIdString}`}</h1>
        <div className="w-10 h-10" />
      </div>
      <div className="w-full aspect-video bg-black flex items-center justify-center">{content}</div>
      <div className="p-4 flex-grow">
        {currentProgram && !isLoading && (
          <>
            <h2 className="text-2xl font-bold">{currentProgram.title}</h2>
            <p className="text-sm text-gray-400">Channel: {channelDetails?.name || "..."}</p>
            {currentProgram.id !== STANDBY_PLACEHOLDER_ID && (
              <p className="text-sm text-gray-400">Scheduled: {new Date(currentProgram.start_time).toLocaleString()}</p>
            )}
            <p className="text-xs text-gray-300 mt-1">{currentProgram.description}</p>
          </>
        )}
      </div>
    </div>
  )
}
