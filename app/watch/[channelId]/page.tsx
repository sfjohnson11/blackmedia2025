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

  // Effect 1: Validate channelIdString and fetch channel details
  useEffect(() => {
    // console.log("WatchPage Effect 1: Validating channelIdString and fetching channel details. channelIdString:", channelIdString)
    if (!channelIdString) {
      setError("Channel ID is missing in URL.")
      setIsLoading(false)
      setValidatedNumericChannelId(null)
      setChannelDetails(null)
      setCurrentProgram(null)
      return
    }

    const numericId = Number.parseInt(channelIdString, 10)
    if (isNaN(numericId)) {
      setError("Invalid channel ID format in URL.")
      setIsLoading(false)
      setValidatedNumericChannelId(null)
      setChannelDetails(null)
      setCurrentProgram(null)
      return
    }

    setValidatedNumericChannelId(numericId)
    setError(null) // Clear previous errors

    const loadChannelDetails = async () => {
      // console.log("WatchPage Effect 1: Fetching channel details for numericId:", numericId)
      setIsLoading(true) // Set loading true before fetching channel details
      const details = await fetchChannelDetails(channelIdString)
      setChannelDetails(details)
      if (!details) {
        setError((prevError) => prevError || "Could not load channel details.")
      }
      // setIsLoading(false) will be handled by fetchCurrentProgram's finally block
    }
    loadChannelDetails()
  }, [channelIdString])

  // Effect 2: Program fetching logic (memoized)
  const fetchCurrentProgram = useCallback(async (numericChannelId: number) => {
    if (typeof numericChannelId !== "number") {
      console.warn("fetchCurrentProgram: called with invalid numericChannelId", numericChannelId)
      return
    }
    // console.log("WatchPage fetchCurrentProgram: Fetching for channel:", numericChannelId)
    setIsLoading(true)
    try {
      const { data: programsData, error: dbError } = await supabase
        .from("programs")
        .select("*, duration")
        .eq("channel_id", numericChannelId)
        .order("start_time", { ascending: true })

      if (dbError) {
        console.error("Supabase error fetching programs:", dbError.message)
        throw new Error(`Database error: ${dbError.message}`)
      }

      const programs = programsData as Program[]
      const now = new Date()
      // console.log("Current client time (UTC):", now.toISOString())

      const activeProgram = programs?.find((p) => {
        if (!p.start_time || typeof p.duration !== "number" || p.duration <= 0) {
          // console.warn("Skipping program due to invalid start_time or duration:", p.title, p.start_time, p.duration)
          return false
        }
        const start = new Date(p.start_time) // Assumes start_time is UTC or correctly parsable
        const end = new Date(start.getTime() + p.duration * 1000)
        // console.log(`Checking ${p.title}: Start ${start.toISOString()}, End ${end.toISOString()}, Active: ${now >= start && now < end}`)
        return now >= start && now < end
      })

      if (activeProgram) {
        // console.log("Active program found:", activeProgram.title)
        setCurrentProgram((prev) => {
          if (prev?.id !== activeProgram.id || prev?.start_time !== activeProgram.start_time) {
            setVideoPlayerKey(Date.now()) // New key for new program
          }
          return { ...activeProgram, channel_id: numericChannelId }
        })
      } else {
        // console.warn("No active program found. Setting standby.")
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
          if (prev?.id !== STANDBY_PLACEHOLDER_ID || prev?.channel_id !== numericChannelId) {
            setVideoPlayerKey(Date.now()) // New key for standby
          }
          return newStandby
        })
      }
    } catch (e: any) {
      console.error("Error in fetchCurrentProgram:", e.message)
      setError(e.message)
    } finally {
      setIsLoading(false)
    }
  }, []) // Empty dependency array as it doesn't depend on props/state from this component's scope directly

  // Effect 3: Polling for current program (replaces the previous polling logic)
  useEffect(() => {
    let pollingInterval: NodeJS.Timeout | undefined

    const startPolling = (idToPoll: number) => {
      // Run immediately
      fetchCurrentProgram(idToPoll)

      // Poll every 60 seconds
      pollingInterval = setInterval(() => {
        console.log("🔁 Polling for active program for channel:", idToPoll)
        fetchCurrentProgram(idToPoll)
      }, 60000)
    }

    if (validatedNumericChannelId !== null) {
      startPolling(validatedNumericChannelId)
    }

    return () => {
      if (pollingInterval) {
        clearInterval(pollingInterval)
        // console.log("Cleared polling interval for channel:", validatedNumericChannelId)
      }
    }
  }, [validatedNumericChannelId, fetchCurrentProgram]) // Depends on validatedNumericChannelId and the stable fetchCurrentProgram

  const videoSrc = currentProgram ? getVideoUrlForProgram(currentProgram) : undefined
  const posterSrc = currentProgram?.poster_url ? getFullUrl(currentProgram.poster_url) : undefined
  const isStandbyProgram = currentProgram?.id === STANDBY_PLACEHOLDER_ID

  const handleProgramEnded = useCallback(() => {
    // console.log("WatchPage: Program ended, re-fetching current program.")
    if (validatedNumericChannelId !== null) {
      fetchCurrentProgram(validatedNumericChannelId)
    }
  }, [validatedNumericChannelId, fetchCurrentProgram])

  let content: ReactNode
  if (error) {
    content = <p className="text-red-400 p-4 text-center">Error: {error}</p>
  } else if (isLoading && !currentProgram) {
    // Show loader if loading and no program yet
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
  } else if (currentProgram && !videoSrc) {
    // Program selected, but URL failed (should be rare)
    content = (
      <p className="text-orange-400 p-4 text-center">
        Program selected ({currentProgram.title}), but video URL generation failed.
      </p>
    )
  } else {
    // Fallback if no other condition met (e.g., initial state before any loading)
    content = <p className="text-gray-400 p-4 text-center">Initializing channel or no program data...</p>
  }

  return (
    <div className="bg-black min-h-screen flex flex-col text-white">
      <div className="p-4 flex items-center justify-between bg-gray-900/50 sticky top-0 z-10">
        <button onClick={() => router.back()} className="p-2 rounded-full hover:bg-gray-700" aria-label="Go back">
          <ChevronLeft className="h-6 w-6" />
        </button>
        <h1 className="text-xl font-semibold truncate px-2">
          {channelDetails?.name || (channelIdString ? `Channel ${channelIdString}` : "Channel")}
        </h1>
        <div className="w-10 h-10" /> {/* Spacer */}
      </div>

      <div className="w-full aspect-video bg-black flex items-center justify-center">{content}</div>

      <div className="p-4 flex-grow">
        {currentProgram &&
          !isLoading && ( // Display program info if not loading and program exists
            <>
              <h2 className="text-2xl font-bold">{currentProgram.title}</h2>
              <p className="text-sm text-gray-400">
                Channel: {channelDetails?.name || (channelIdString ? `Channel ${channelIdString}` : "...")}
              </p>
              {currentProgram.id !== STANDBY_PLACEHOLDER_ID && currentProgram.start_time && (
                <p className="text-sm text-gray-400">
                  Scheduled Start:{" "}
                  {new Date(
                    currentProgram.start_time.endsWith("Z") || /[-+]\d{2}:\d{2}$/.test(currentProgram.start_time)
                      ? currentProgram.start_time
                      : currentProgram.start_time + "Z",
                  ).toLocaleString()}
                </p>
              )}
              <p className="text-xs text-gray-300 mt-1">{currentProgram.description}</p>
            </>
          )}
        {isLoading &&
          !currentProgram && ( // Show "Checking schedule..." if loading initial program
            <p className="text-gray-500">Checking schedule...</p>
          )}
        {!isLoading &&
          !currentProgram &&
          !error && ( // If not loading, no program, and no error
            <p className="text-gray-500">No program scheduled at this time or channel data unavailable.</p>
          )}
      </div>
    </div>
  )
}
