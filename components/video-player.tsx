"use client"

import type React from "react"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { Loader2, ChevronLeft, RefreshCw, AlertTriangle } from "lucide-react"
import { getCurrentProgram, getUpcomingPrograms } from "@/lib/supabase"

// Add this at the top of your component (using your Supabase URL from environment variables)
const SUPABASE_PUBLIC_BUCKET_BASE = process.env.NEXT_PUBLIC_SUPABASE_URL + "/storage/v1/object/public/videos/"

interface VideoPlayerProps {
  channel: any
  initialProgram: any
  upcomingPrograms: any[]
}

export function VideoPlayer({ channel, initialProgram, upcomingPrograms: initialUpcoming }: VideoPlayerProps) {
  const router = useRouter()
  const videoRef = useRef<HTMLVideoElement>(null)
  const videoContainerRef = useRef<HTMLDivElement>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [currentProgram, setCurrentProgram] = useState(initialProgram)
  const [upcomingPrograms, setUpcomingPrograms] = useState(initialUpcoming)
  const [lastProgramCheck, setLastProgramCheck] = useState(Date.now())
  const [videoUrl, setVideoUrl] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [errorDetails, setErrorDetails] = useState<string | null>(null)
  const [currentTime, setCurrentTime] = useState(new Date())
  const [lastRefreshTime, setLastRefreshTime] = useState(new Date())
  const [retryCount, setRetryCount] = useState(0)
  const [fallbackMode, setFallbackMode] = useState(false)

  // Go back
  const handleBack = () => {
    router.back()
  }

  // Fix double slashes in URLs (but preserve http://)
  const fixUrl = (url: string): string => {
    if (!url) {
      console.log("WARNING: Empty URL passed to fixUrl")
      return ""
    }

    console.log("Original URL before fixing:", url)

    // First preserve the protocol (http:// or https://)
    let protocol = ""
    const protocolMatch = url.match(/^(https?:\/\/)/)
    if (protocolMatch) {
      protocol = protocolMatch[0]
      url = url.substring(protocol.length)
    }

    // Replace any double slashes with single slashes
    url = url.replace(/\/+/g, "/")

    // Put the protocol back
    const fixedUrl = protocol + url
    console.log("Fixed URL after processing:", fixedUrl)
    return fixedUrl
  }

  // Replace this function inside your VideoPlayer component
  const loadVideo = (url: string) => {
    console.log("loadVideo called with URL:", url)

    if (!url) {
      console.error("ERROR: Empty URL passed to loadVideo")
      setError("No video URL available")
      setIsLoading(false)
      return
    }

    // Reset retry count and fallback mode when loading a new video
    setRetryCount(0)
    setFallbackMode(false)

    // Check if the URL is already a full URL or just a filename
    let fullUrl
    if (url.startsWith("http")) {
      // It's already a full URL, just fix any double slashes
      fullUrl = fixUrl(url)
    } else {
      // It's just a filename, combine with Supabase path
      fullUrl = fixUrl(SUPABASE_PUBLIC_BUCKET_BASE + url)
    }

    console.log("Setting video URL to:", fullUrl)

    setVideoUrl(fullUrl) // This will trigger the <video> to reload
    setIsLoading(true)
    setError(null)
    setErrorDetails(null)
  }

  // Update current time every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date())
    }, 1000)

    return () => clearInterval(timer)
  }, [])

  // Format current time for display
  const formattedTime = currentTime.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })

  // Force refresh the current program
  const forceRefreshProgram = async () => {
    setIsLoading(true)
    setError(null)
    setErrorDetails(null)
    setLastRefreshTime(new Date())

    console.log("Force refreshing program for channel:", channel.id)

    try {
      const { program } = await getCurrentProgram(channel.id)
      const { programs } = await getUpcomingPrograms(channel.id)

      console.log("Force refresh result - Current program:", program)

      if (program) {
        setCurrentProgram(program)

        if (program.mp4_url) {
          loadVideo(program.mp4_url)
        } else {
          setError("Program has no video URL")
          setIsLoading(false)
        }
      } else {
        setError("No current program found for this channel")
        setIsLoading(false)
      }

      setUpcomingPrograms(programs)
    } catch (err) {
      console.error("Error force refreshing program:", err)
      setError("Error refreshing program")
      setIsLoading(false)
    }
  }

  // Check for program updates with improved logging
  const checkForProgramUpdates = async () => {
    // Don't check too frequently
    const now = Date.now()
    if (now - lastProgramCheck < 10000) {
      // 10 seconds minimum between checks
      return
    }
    setLastProgramCheck(now)

    try {
      console.log("Checking for program updates at:", new Date().toLocaleString())

      const { program } = await getCurrentProgram(channel.id)
      const { programs } = await getUpcomingPrograms(channel.id)

      console.log("Program check result - Current program:", program)

      // If we have a new program, switch to it
      if (program && (!currentProgram || program.id !== currentProgram.id)) {
        console.log("New program detected:", program.title)
        setCurrentProgram(program)

        if (program.mp4_url) {
          loadVideo(program.mp4_url)
        } else {
          console.error("ERROR: New program has no mp4_url:", program)
          setError("Program has no video URL")
          setIsLoading(false)
        }
      } else if (!program) {
        console.log("No current program found for channel", channel.id)
        setError("No current program found for this channel")
        setIsLoading(false)
      }

      setUpcomingPrograms(programs)
    } catch (err) {
      console.error("Error checking for program updates:", err)
    }
  }

  // Handle video end
  const handleVideoEnd = () => {
    console.log("Video ended, checking for next program")
    checkForProgramUpdates()
  }

  // Try alternative URL formats if the current one fails
  const tryAlternativeUrl = () => {
    if (!currentProgram?.mp4_url) return false

    const url = currentProgram.mp4_url
    const retryOptions = [
      // Option 1: Try with a different path structure
      url.startsWith("http")
        ? url
        : `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/channel${channel.id}/${url}`,

      // Option 2: Try with a different bucket name
      url.startsWith("http")
        ? url
        : `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/ch${channel.id}/${url}`,

      // Option 3: Try with videos prefix
      url.startsWith("http")
        ? url
        : `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/videos/ch${channel.id}/${url}`,
    ]

    if (retryCount < retryOptions.length) {
      const alternativeUrl = retryOptions[retryCount]
      console.log(`Trying alternative URL format (${retryCount + 1}/${retryOptions.length}):`, alternativeUrl)
      setVideoUrl(alternativeUrl)
      setRetryCount(retryCount + 1)
      return true
    }

    return false
  }

  // Handle video error with improved error recovery
  const handleVideoError = (e: React.SyntheticEvent<HTMLVideoElement>) => {
    const videoElement = e.currentTarget
    const videoError = videoElement.error

    console.log("Video error event triggered")

    // First try alternative URL formats
    if (tryAlternativeUrl()) {
      console.log("Trying alternative URL format...")
      return
    }

    // If we've tried all alternative URLs and still have errors, show error state
    if (videoError) {
      // Log the error code and message
      console.error("Video error code:", videoError.code)
      console.error("Video error message:", videoError.message)

      // Provide specific error messages based on the error code
      let errorMessage = "Unknown video error"

      switch (videoError.code) {
        case MediaError.MEDIA_ERR_ABORTED:
          errorMessage = "Video playback was aborted"
          console.error("MEDIA_ERR_ABORTED: Video playback was aborted")
          break
        case MediaError.MEDIA_ERR_NETWORK:
          errorMessage = "A network error occurred while loading the video"
          console.error("MEDIA_ERR_NETWORK: A network error occurred")
          break
        case MediaError.MEDIA_ERR_DECODE:
          errorMessage = "The video could not be decoded"
          console.error("MEDIA_ERR_DECODE: Failed to decode the video")
          break
        case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED:
          errorMessage = "The video format is not supported or the URL is invalid"
          console.error("MEDIA_ERR_SRC_NOT_SUPPORTED: Unsupported video source")
          break
        default:
          console.error("Unknown video error")
      }

      // Add the error message if available
      if (videoError.message) {
        errorMessage += `: ${videoError.message}`
      }

      // Log the current URL
      console.error("Current video URL when error occurred:", videoUrl)

      // Set the error state
      setError(`Video error: ${errorMessage}`)
      setErrorDetails(`Error code: ${videoError.code}, URL: ${videoUrl}`)
    } else {
      console.error("Video error event but no error object available")

      // Even without an error object, we can try to recover
      if (!fallbackMode) {
        console.log("Switching to fallback mode...")
        setFallbackMode(true)
        forceRefreshProgram() // Try to refresh the program
      } else {
        setError("Video error occurred")
        setErrorDetails("No error details available. URL: " + videoUrl)
      }
    }

    setIsLoading(false)
  }

  // Handle video can play
  const handleCanPlay = () => {
    console.log("Video can play event triggered for URL:", videoUrl)
    setIsLoading(false)
  }

  // Initial setup
  useEffect(() => {
    console.log("Initial setup for channel:", channel.id)
    console.log("Initial program:", initialProgram)
    console.log("Initial program URL:", initialProgram?.mp4_url)
    console.log("Current time (ISO):", new Date().toISOString())
    console.log("Current time (local):", new Date().toLocaleString())

    // Force refresh to get the current program
    forceRefreshProgram()

    // Set up regular program checks
    const programCheckInterval = setInterval(checkForProgramUpdates, 30000) // Check every 30 seconds

    // Set up a more frequent check for the exact program change time
    const scheduleCheckInterval = setInterval(() => {
      // Check if we have upcoming programs
      if (upcomingPrograms.length > 0) {
        const nextProgram = upcomingPrograms[0]
        const nextProgramTime = new Date(nextProgram.start_time).getTime()
        const now = Date.now()

        // If it's time for the next program (within 5 seconds), check for updates
        if (nextProgramTime <= now + 5000 && nextProgramTime >= now - 5000) {
          console.log("It's time for the next program, checking for updates")
          checkForProgramUpdates()
        }
      }
    }, 5000) // Check every 5 seconds

    return () => {
      clearInterval(programCheckInterval)
      clearInterval(scheduleCheckInterval)
    }
  }, [])

  // Log whenever videoUrl changes
  useEffect(() => {
    console.log("Video URL state changed to:", videoUrl)
  }, [videoUrl])

  return (
    <div className="relative bg-black">
      {/* Back button */}
      <button
        onClick={handleBack}
        className="absolute top-4 left-4 z-10 bg-black/50 p-2 rounded-full hover:bg-black/70 transition-colors"
      >
        <ChevronLeft className="h-6 w-6 text-white" />
      </button>

      {/* Loading state */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black z-20">
          <div className="flex flex-col items-center">
            <Loader2 className="h-12 w-12 text-red-600 animate-spin mb-2" />
            <p className="text-white">Loading video...</p>
          </div>
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-black z-20">
          <div className="text-center p-4 max-w-md">
            <AlertTriangle className="h-12 w-12 text-red-600 mx-auto mb-4" />
            <p className="text-red-500 mb-4">{error}</p>
            {errorDetails && <p className="text-gray-400 text-sm mb-4">{errorDetails}</p>}
            <div className="flex flex-wrap justify-center gap-3">
              <button
                onClick={forceRefreshProgram}
                className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 transition-colors flex items-center"
              >
                <RefreshCw className="h-4 w-4 mr-2" /> Force Refresh
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Video container */}
      <div ref={videoContainerRef} className="w-full aspect-video bg-black">
        {videoUrl ? (
          <video
            ref={videoRef}
            key={videoUrl} // This forces a complete remount when the URL changes
            className="w-full h-full"
            controls
            playsInline
            autoPlay // Add autoPlay to start playing automatically
            onCanPlay={handleCanPlay}
            onEnded={handleVideoEnd}
            onError={handleVideoError}
            onLoadStart={() => console.log("Video load started for URL:", videoUrl)}
            onLoadedData={() => console.log("Video data loaded for URL:", videoUrl)}
            crossOrigin="anonymous" // Add crossOrigin to help with CORS issues
          >
            <source src={videoUrl} type="video/mp4" />
            Your browser does not support the video tag.
          </video>
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <p className="text-white">No video URL available</p>
          </div>
        )}
      </div>

      {/* Program info */}
      {currentProgram && (
        <div className="bg-black p-4">
          <h2 className="text-xl font-bold text-white">{currentProgram.title}</h2>
          <p className="text-gray-400 text-sm">Current time: {formattedTime}</p>
          {currentProgram.start_time && (
            <p className="text-gray-400 text-sm">
              Started at: {new Date(currentProgram.start_time).toLocaleTimeString()}
            </p>
          )}
          {upcomingPrograms.length > 0 && (
            <p className="text-gray-400 text-sm mt-1">
              Next: {upcomingPrograms[0].title} at {new Date(upcomingPrograms[0].start_time).toLocaleTimeString()}
            </p>
          )}
        </div>
      )}

      {/* Manual refresh button */}
      <div className="bg-black p-4 flex justify-center">
        <button
          onClick={forceRefreshProgram}
          className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 flex items-center"
        >
          <RefreshCw className="h-4 w-4 mr-2" /> Force Refresh Program
        </button>
      </div>

      {/* Debug info */}
      <div className="bg-black p-2 text-xs text-gray-500">
        <p>Channel ID: {channel.id}</p>
        <p>Current Program: {currentProgram?.title || "None"}</p>
        <p>Program URL: {currentProgram?.mp4_url || "None"}</p>
        <p>Video URL: {videoUrl || "None"}</p>
        <p>Current Time (UTC): {new Date().toISOString()}</p>
        <p>Current Time (Local): {new Date().toLocaleString()}</p>
        {currentProgram && <p>Program Start Time: {new Date(currentProgram.start_time).toLocaleString()}</p>}
        {currentProgram && <p>Program Duration: {currentProgram.duration || "Unknown"} seconds</p>}
        {currentProgram && currentProgram.duration && (
          <p>
            Program End Time:{" "}
            {new Date(new Date(currentProgram.start_time).getTime() + currentProgram.duration * 1000).toLocaleString()}
          </p>
        )}
        <p>Last Refresh: {lastRefreshTime.toLocaleString()}</p>
        <p>Loading: {isLoading ? "Yes" : "No"}</p>
        <p>Error: {error || "None"}</p>
        <p>Retry Count: {retryCount}</p>
        <p>Fallback Mode: {fallbackMode ? "Yes" : "No"}</p>
      </div>
    </div>
  )
}
