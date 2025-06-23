"use client"

import { type ReactNode, useEffect, useState, useCallback } from "react"
import { useParams, useRouter } from "next/navigation"
import VideoPlayer from "@/components/video-player"
import { getVideoUrlForProgram, fetchChannelDetails, supabase, STANDBY_PLACEHOLDER_ID } from "@/lib/supabase"
import type { Program, Channel } from "@/types"
import { ChevronLeft, Loader2 } from "lucide-react"

const HLS_LIVE_STREAM_URL_CH21 = "https://cdn.livepush.io/hls/fe96095a2d2b4314aa1789fb309e48f8/index.m3u8"
const CH21_ID_NUMERIC = 21

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
  const [hlsStreamFailedForCh21, setHlsStreamFailedForCh21] = useState(false)

  useEffect(() => {
    if (!channelIdString) {
      setError("Channel ID is missing in URL.")
      setIsLoading(false)
      return
    }
    const numericId = Number.parseInt(channelIdString, 10)
    if (isNaN(numericId)) {
      setError("Invalid channel ID format in URL.")
      setIsLoading(false)
      return
    }
    setValidatedNumericChannelId(numericId)
    setError(null)
    // Reset HLS fail state if navigating away from Ch21 or to a different channel
    if (numericId !== CH21_ID_NUMERIC) {
      setHlsStreamFailedForCh21(false)
    } else {
      // If navigating TO Ch21, we don't want to reset hlsStreamFailedForCh21 here
      // as it might have been set due to a previous failure on this channel.
      // The fetchCurrentProgram logic will handle resetting it if a DB program plays.
    }

    const loadChannelDetails = async () => {
      setIsLoading(true)
      const details = await fetchChannelDetails(channelIdString)
      setChannelDetails(details)
      if (!details) setError((prev) => prev || "Could not load channel details.")
      // setIsLoading(false) // Moved to fetchCurrentProgram's finally block
    }
    loadChannelDetails()
  }, [channelIdString])

  const getCh21StandbyMp4Program = useCallback(
    (now: Date): Program => ({
      id: STANDBY_PLACEHOLDER_ID,
      title: "Channel 21 - Standby",
      description: "Live stream currently unavailable. Standby programming will play.",
      channel_id: CH21_ID_NUMERIC,
      mp4_url: `channel${CH21_ID_NUMERIC}/standby_blacktruthtv.mp4`,
      duration: 300, // Example duration, actual loop is handled by player
      start_time: now.toISOString(),
      poster_url: null,
    }),
    [],
  )

  const fetchCurrentProgram = useCallback(
    async (numericChannelId: number) => {
      setIsLoading(true)
      const now = new Date()
      try {
        const { data: programsData, error: dbError } = await supabase
          .from("programs")
          .select("*, duration")
          .eq("channel_id", numericChannelId)
          .order("start_time", { ascending: true })

        if (dbError) throw new Error(`Database error: ${dbError.message}`)

        const programs = programsData as Program[]
        const activeProgram = programs?.find((p) => {
          if (!p.start_time || typeof p.duration !== "number" || p.duration <= 0) return false
          const start = new Date(p.start_time)
          const end = new Date(start.getTime() + p.duration * 1000)
          return now >= start && now < end
        })

        let programToSet: Program | null = null

        if (activeProgram) {
          programToSet = { ...activeProgram, channel_id: numericChannelId }
          if (numericChannelId === CH21_ID_NUMERIC) {
            // If a DB program is active on Ch21, the HLS stream is not relevant, so reset its failure state.
            setHlsStreamFailedForCh21(false)
          }
        } else if (numericChannelId === CH21_ID_NUMERIC) {
          if (hlsStreamFailedForCh21) {
            programToSet = getCh21StandbyMp4Program(now)
          } else {
            programToSet = {
              id: "live-ch21-hls",
              title: "Live Broadcast (Channel 21)",
              description: "Currently broadcasting live.",
              channel_id: CH21_ID_NUMERIC,
              mp4_url: `/api/cors-proxy?url=${encodeURIComponent(HLS_LIVE_STREAM_URL_CH21)}`,
              duration: 86400 * 7, // Effectively infinite for a live stream
              start_time: new Date(Date.now() - 3600000).toISOString(), // Mark as started recently
              poster_url: channelDetails?.image_url || null, // Use channel image as poster
            }
          }
        } else {
          // Standby for other channels
          programToSet = {
            id: STANDBY_PLACEHOLDER_ID,
            title: "Standby Programming",
            description: "Programming will resume shortly.",
            channel_id: numericChannelId,
            mp4_url: `channel${numericChannelId}/standby_blacktruthtv.mp4`,
            duration: 300, // Example duration
            start_time: now.toISOString(),
            poster_url: channelDetails?.image_url || null,
          }
        }

        setCurrentProgram((prev) => {
          if (
            prev?.id !== programToSet!.id ||
            prev?.start_time !== programToSet!.start_time ||
            prev?.mp4_url !== programToSet!.mp4_url
          ) {
            setVideoPlayerKey(Date.now()) // Force player re-init for new source/program
          }
          return programToSet
        })
      } catch (e: any) {
        console.error("Error in fetchCurrentProgram:", e.message)
        setError(e.message)
        // Fallback to standby, ensuring it's specific for Ch21 if on Ch21
        if (numericChannelId === CH21_ID_NUMERIC) {
          setCurrentProgram(getCh21StandbyMp4Program(now))
        } else {
          // Generic standby for other channels on error
          setCurrentProgram({
            id: STANDBY_PLACEHOLDER_ID,
            title: "Standby Programming - Error",
            description: "Error loading schedule. Standby content will play.",
            channel_id: numericChannelId,
            mp4_url: `channel${numericChannelId}/standby_blacktruthtv.mp4`,
            duration: 300,
            start_time: now.toISOString(),
            poster_url: channelDetails?.image_url || null,
          })
        }
      } finally {
        setIsLoading(false)
      }
    },
    [hlsStreamFailedForCh21, getCh21StandbyMp4Program, channelDetails], // Added channelDetails
  )

  useEffect(() => {
    let pollingInterval: NodeJS.Timeout | undefined
    if (validatedNumericChannelId !== null) {
      fetchCurrentProgram(validatedNumericChannelId) // Initial fetch
      pollingInterval = setInterval(() => {
        if (document.visibilityState === "visible") {
          fetchCurrentProgram(validatedNumericChannelId)
        }
      }, 60000) // Poll every 60 seconds
    }
    return () => {
      if (pollingInterval) clearInterval(pollingInterval)
    }
  }, [validatedNumericChannelId, fetchCurrentProgram]) // Rerun if channelId or fetchCurrentProgram changes

  const handlePrimaryLiveStreamError = useCallback(() => {
    if (validatedNumericChannelId === CH21_ID_NUMERIC && !hlsStreamFailedForCh21) {
      console.warn("WatchPage: Primary HLS live stream for Channel 21 failed. Falling back to standby MP4.")
      setHlsStreamFailedForCh21(true)
      // No need to call fetchCurrentProgram immediately,
      // the state update of hlsStreamFailedForCh21 will trigger a re-render,
      // and if fetchCurrentProgram is in its deps, it will re-run.
      // For a more immediate switch without waiting for polling or re-fetch:
      setCurrentProgram(getCh21StandbyMp4Program(new Date()))
      setVideoPlayerKey(Date.now()) // Ensure player reinitializes
    }
  }, [validatedNumericChannelId, hlsStreamFailedForCh21, getCh21StandbyMp4Program])

  const videoSrc = currentProgram ? getVideoUrlForProgram(currentProgram) : undefined
  const posterSrc = currentProgram?.poster_url || channelDetails?.image_url || undefined
  const shouldLoopInPlayer = currentProgram?.id === STANDBY_PLACEHOLDER_ID
  const isPrimaryHLS = currentProgram?.id === "live-ch21-hls"

  // Determine if the "No Live Programming" notice should be shown
  const showNoLiveNoticeForCh21 =
    validatedNumericChannelId === CH21_ID_NUMERIC &&
    hlsStreamFailedForCh21 &&
    currentProgram?.id === STANDBY_PLACEHOLDER_ID

  const handleProgramEnded = useCallback(() => {
    // This should only be called for non-looping, non-HLS scheduled programs.
    // The VideoPlayer's onEnded will not call this if isStandby is true.
    if (validatedNumericChannelId !== null) {
      console.log("WatchPage: Program ended, fetching next program.", currentProgram?.title)
      fetchCurrentProgram(validatedNumericChannelId)
    }
  }, [validatedNumericChannelId, fetchCurrentProgram, currentProgram])

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
        isStandby={shouldLoopInPlayer}
        programTitle={currentProgram?.title}
        onVideoEnded={handleProgramEnded}
        isPrimaryLiveStream={isPrimaryHLS && validatedNumericChannelId === CH21_ID_NUMERIC}
        onPrimaryLiveStreamError={handlePrimaryLiveStreamError}
        showNoLiveNotice={showNoLiveNoticeForCh21} // Pass the new prop
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
        <div className="w-10 h-10" /> {/* Spacer */}
      </div>
      <div className="w-full aspect-video bg-black flex items-center justify-center">{content}</div>
      <div className="p-4 flex-grow">
        {currentProgram && !isLoading && (
          <>
            <h2 className="text-2xl font-bold">{currentProgram.title}</h2>
            <p className="text-sm text-gray-400">Channel: {channelDetails?.name || `Channel ${channelIdString}`}</p>
            {currentProgram.id !== STANDBY_PLACEHOLDER_ID &&
              currentProgram.id !== "live-ch21-hls" &&
              currentProgram.start_time && (
                <p className="text-sm text-gray-400">
                  Scheduled Start: {new Date(currentProgram.start_time).toLocaleString()}
                </p>
              )}
            <p className="text-xs text-gray-300 mt-1">{currentProgram.description}</p>
          </>
        )}
      </div>
    </div>
  )
}
