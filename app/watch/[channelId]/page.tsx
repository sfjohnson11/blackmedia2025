"use client"

import { useEffect, useState, useCallback, useRef } from "react"
import { useParams, useRouter } from "next/navigation"
import MsePlayer from "@/components/mse-player"
// Import the new function and the old one (for posters, tentatively)
import { getCurrentProgram, getVideoUrlForProgram, getFullUrl, fetchChannelDetails } from "@/lib/supabase"
import type { Program, Channel } from "@/types"
import { ChevronLeft, RefreshCw, Loader2 } from "lucide-react"

export default function WatchPage() {
  const params = useParams()
  const router = useRouter()
  const channelId = params.channelId as string

  const [currentProgram, setCurrentProgram] = useState<Program | null>(null)
  const [channelDetails, setChannelDetails] = useState<Channel | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const isInitialFetchRef = useRef(true)

  const refreshData = useCallback(async () => {
    console.log(
      `WatchPage: refreshData called for channelId: ${channelId}. Initial fetch: ${isInitialFetchRef.current}`,
    )
    if (!channelId) {
      console.warn("WatchPage: refreshData - no channelId, returning.")
      return
    }
    if (isInitialFetchRef.current) {
      setIsLoading(true)
    }
    setError(null)

    try {
      console.log("WatchPage: Attempting to fetch channel details...")
      const details = await fetchChannelDetails(channelId)
      console.log("WatchPage: Fetched channelDetails:", JSON.stringify(details, null, 2))
      setChannelDetails(details)

      console.log("WatchPage: Attempting to fetch current program...")
      const program = await getCurrentProgram(channelId)
      console.log("WatchPage: Fetched currentProgram:", JSON.stringify(program, null, 2))
      setCurrentProgram(program)

      if (!details && !program && !isInitialFetchRef.current) {
        console.warn(`WatchPage: Channel details and program not found for ID ${channelId} after initial load.`)
      }
    } catch (err: any) {
      console.error(
        "WatchPage: Error in refreshData catch block:",
        JSON.stringify(err, Object.getOwnPropertyNames(err)),
      )
      setError(err.message || "Failed to load channel data.")
    } finally {
      if (isInitialFetchRef.current) {
        setIsLoading(false)
        isInitialFetchRef.current = false
        console.log("WatchPage: Initial load finished.")
      } else {
        console.log("WatchPage: Background refresh finished.")
      }
    }
  }, [channelId])

  useEffect(() => {
    isInitialFetchRef.current = true
    refreshData()
    const intervalId = setInterval(() => {
      console.log("WatchPage: Interval triggered refreshData.")
      refreshData()
    }, 30000)
    return () => {
      console.log("WatchPage: Clearing interval.")
      clearInterval(intervalId)
    }
  }, [refreshData])

  // Use the new function for videoSrc
  const videoSrc = getVideoUrlForProgram(currentProgram)

  // For posterSrc, we'll tentatively use the old getFullUrl.
  // If posters are also in dynamic buckets and poster_url is just a filename,
  // this will need a similar function like getVideoUrlForProgram.
  const posterPath = currentProgram?.poster_url
  const posterSrc = posterPath ? getFullUrl(posterPath) : undefined
  if (posterPath) {
    console.log(`WatchPage: Poster path from DB: ${posterPath}, Generated posterSrc: ${posterSrc}`)
  }

  console.log("WatchPage render: currentProgram:", JSON.stringify(currentProgram, null, 2))
  console.log("WatchPage render: videoSrc (from getVideoUrlForProgram):", videoSrc)
  console.log("WatchPage render: isLoading:", isLoading, "isInitialFetchRef.current:", isInitialFetchRef.current)
  console.log("WatchPage render: error state:", error)

  if (isLoading && isInitialFetchRef.current) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-black text-white">
        <Loader2 className="h-12 w-12 animate-spin text-red-600 mb-4" />
        <p>Loading Channel...</p>
      </div>
    )
  }

  return (
    <div className="bg-black min-h-screen flex flex-col text-white">
      <div className="p-4 flex items-center justify-between bg-gray-900/50 sticky top-0 z-10">
        <button
          onClick={() => router.back()}
          className="p-2 rounded-full hover:bg-gray-700 transition-colors"
          aria-label="Go back"
        >
          <ChevronLeft className="h-6 w-6" />
        </button>
        <h1 className="text-xl font-semibold truncate px-2">{channelDetails?.name || "Channel"}</h1>
        <button
          onClick={() => {
            isInitialFetchRef.current = true
            refreshData()
          }}
          className="p-2 rounded-full hover:bg-gray-700 transition-colors"
          aria-label="Refresh"
          disabled={isLoading && isInitialFetchRef.current}
        >
          {isLoading && isInitialFetchRef.current ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <RefreshCw className="h-5 w-5" />
          )}
        </button>
      </div>

      <div className="w-full aspect-video bg-black flex items-center justify-center">
        {currentProgram && videoSrc ? (
          <MsePlayer src={videoSrc} poster={posterSrc} />
        ) : (
          <div className="text-gray-400 p-4 text-center">
            {isLoading && isInitialFetchRef.current ? (
              <Loader2 className="h-10 w-10 animate-spin text-red-500" />
            ) : error ? (
              <p className="text-red-400">Error: {error}</p>
            ) : (
              <p>Programming will resume shortly.</p>
            )}
          </div>
        )}
      </div>

      <div className="p-4 flex-grow">
        {currentProgram ? (
          <>
            <h2 className="text-2xl font-bold">{currentProgram.title}</h2>
            <p className="text-sm text-gray-400">Channel: {channelDetails?.name || "Loading..."}</p>
            {currentProgram.start_time && (
              <p className="text-sm text-gray-400">
                Started: {new Date(currentProgram.start_time).toLocaleTimeString()}
              </p>
            )}
            <p className="text-xs text-gray-300 mt-1">{currentProgram.description}</p>
          </>
        ) : (
          !isLoading && !error && <p className="text-gray-500">Checking for scheduled programs...</p>
        )}
      </div>
    </div>
  )
}
