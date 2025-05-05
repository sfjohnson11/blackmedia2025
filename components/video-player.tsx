"use client"

import type React from "react"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { Loader2, ChevronLeft, RefreshCw, AlertTriangle } from "lucide-react"
import { getCurrentProgram, getUpcomingPrograms, forceRefreshAllData, getFullUrl } from "@/lib/supabase"

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
  const [loadingTimeout, setLoadingTimeout] = useState<NodeJS.Timeout | null>(null)
  const [retryCount, setRetryCount] = useState(0)
  const maxRetries = 3 // Increased from 2 to 3
  const [debugInfo, setDebugInfo] = useState<Record<string, any>>({})
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [videoType, setVideoType] = useState<"mp4" | "hls" | "unknown">("unknown")

  // Go back
  const handleBack = () => {
    router.back()
  }

  // Add debug info
  const addDebugInfo = (key: string, value: any) => {
    setDebugInfo((prev) => ({
      ...prev,
      [key]: value,
    }))
  }

  // Clear loading timeout if it exists
  const clearLoadingTimeout = () => {
    if (loadingTimeout) {
      clearTimeout(loadingTimeout)
      setLoadingTimeout(null)
    }
  }

  // Determine video type from URL
  const getVideoType = (url: string): "mp4" | "hls" | "unknown" => {
    if (!url) return "unknown"

    const lowerUrl = url.toLowerCase()
    if (lowerUrl.includes(".m3u8")) return "hls"
    if (lowerUrl.includes(".mp4")) return "mp4"

    // Try to guess based on domain
    if (lowerUrl.includes("mux.dev") || lowerUrl.includes("livestream") || lowerUrl.includes("stream")) {
      return "hls"
    }

    return "mp4" // Default to mp4 if we can't determine
  }

  // Validate URL before loading
  const isValidUrl = (url: string): boolean => {
    try {
      new URL(url)
      return true
    } catch (e) {
      return false
    }
  }

  // Load video with improved validation and error handling
  const loadVideo = (url: string, forceRetry = false) => {
    console.log("loadVideo called with URL:", url)
    addDebugInfo("loadVideoUrl", url)
    addDebugInfo("channelId", channel.id)
    addDebugInfo("programTitle", currentProgram?.title || "None")

    clearLoadingTimeout()

    if (!url) {
      console.error("ERROR: Empty URL passed to loadVideo")
      setError("No video URL available")
      setIsLoading(false)
      return
    }

    // Reset retry count if this is a new URL or forced retry
    if (forceRetry || url !== videoUrl) {
      setRetryCount(0)
    }

    // Process the URL
    let fullUrl

    // If it's already a full URL, use it directly
    if (url.startsWith("http")) {
      fullUrl = url
    } else {
      // Otherwise, use getFullUrl to construct the full path
      try {
        fullUrl = getFullUrl(url)
      } catch (err) {
        console.error("Error constructing full URL:", err)
        setError(`Invalid URL format: ${url}`)
        setIsLoading(false)
        return
      }
    }

    // Validate the URL
    if (!isValidUrl(fullUrl)) {
      console.error("Invalid URL:", fullUrl)
      setError(`Invalid URL format: ${fullUrl}`)
      setIsLoading(false)
      return
    }

    // Add a cache-busting parameter if this is a retry
    if (retryCount > 0) {
      const separator = fullUrl.includes("?") ? "&" : "?"
      fullUrl = `${fullUrl}${separator}retry=${Date.now()}`
    }

    // Determine video type
    const type = getVideoType(fullUrl)
    setVideoType(type)

    console.log(`Setting video URL to: ${fullUrl} (type: ${type})`)
    addDebugInfo("finalVideoUrl", fullUrl)
    addDebugInfo("originalVideoUrl", url)
    addDebugInfo("retryCount", retryCount)
    addDebugInfo("videoType", type)

    setVideoUrl(fullUrl)
    setIsLoading(true)
    setError(null)
    setErrorDetails(null)

    // Set a timeout to catch silent failures - increased to 20 seconds
    const timeout = setTimeout(() => {
      console.log("Video loading timeout reached")
      addDebugInfo("loadingTimeout", true)

      if (isLoading) {
        console.error("Video failed to load within timeout period")

        // If we haven't reached max retries, try again
        if (retryCount < maxRetries) {
          console.log(`Retry ${retryCount + 1}/${maxRetries} after timeout`)
          setRetryCount((prev) => prev + 1)
          loadVideo(url, false)
        } else {
          setError("Video failed to load (timeout)")
          setErrorDetails(`URL: ${fullUrl} | Type: ${type}`)
          setIsLoading(false)
        }
      }
    }, 20000) // 20 second timeout (increased from 15)

    setLoadingTimeout(timeout)
  }

  // Update current time every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date())
    }, 1000)

    return () => clearInterval(timer)
  }, [])

  // Cleanup loading timeout on unmount
  useEffect(() => {
    return () => {
      clearLoadingTimeout()
    }
  }, [])

  // Format current time for display
  const formattedTime = currentTime.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })

  // Force refresh the current program with cache busting
  const forceRefreshProgram = async () => {
    setIsLoading(true)
    setError(null)
    setErrorDetails(null)
    setLastRefreshTime(new Date())
    setRetryCount(0)
    clearLoadingTimeout()
    setIsRefreshing(true)

    console.log("Force refreshing program for channel:", channel.id)
    addDebugInfo("forceRefreshChannel", channel.id)
    addDebugInfo("forceRefreshTime", new Date().toISOString())

    try {
      // First, force a complete refresh of all data
      await forceRefreshAllData()

      // Then get the current program with fresh data
      const { program } = await getCurrentProgram(channel.id)
      const { programs } = await getUpcomingPrograms(channel.id)

      console.log("Force refresh result - Current program:", program)
      addDebugInfo("refreshedProgram", program?.title || "None")

      if (program) {
        setCurrentProgram(program)
        addDebugInfo("currentProgram", program.title)
        addDebugInfo("programStartTime", program.start_time)
        addDebugInfo("programDuration", program.duration)

        if (program.mp4_url) {
          loadVideo(program.mp4_url, true)
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
      addDebugInfo("refreshError", err instanceof Error ? err.message : String(err))
      setIsLoading(false)
    } finally {
      setIsRefreshing(false)
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
      addDebugInfo("programCheckTime", new Date().toISOString())

      // Force a complete refresh of all data to ensure we get fresh programs
      await forceRefreshAllData()

      const { program } = await getCurrentProgram(channel.id)
      const { programs } = await getUpcomingPrograms(channel.id)

      console.log("Program check result - Current program:", program)
      addDebugInfo("scheduledCheckProgram", program?.title || "None")

      // If we have a new program, switch to it
      if (program && (!currentProgram || program.id !== currentProgram.id)) {
        console.log("New program detected:", program.title)
        setCurrentProgram(program)
        addDebugInfo("switchedToProgram", program.title)

        if (program.mp4_url) {
          loadVideo(program.mp4_url, true)
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
      addDebugInfo("checkError", err instanceof Error ? err.message : String(err))
    }
  }

  // Handle video end
  const handleVideoEnd = () => {
    console.log("Video ended, checking for next program")
    addDebugInfo("videoEnded", new Date().toISOString())
    checkForProgramUpdates()
  }

  // Improved error handling specifically for the case where no error object is available
  const handleVideoError = (e: React.SyntheticEvent<HTMLVideoElement>) => {
    console.log("Video error event triggered")
    addDebugInfo("errorTriggered", new Date().toISOString())

    // Clear the loading timeout since we've received an error event
    clearLoadingTimeout()

    const videoElement = e.currentTarget
    const videoError = videoElement.error
    let errorMessage = "Unknown video error"
    let errorDetailsText = ""

    if (videoError) {
      // Log the error code and message
      console.error("Video error code:", videoError.code)
      console.error("Video error message:", videoError.message)
      addDebugInfo("errorCode", videoError.code)
      addDebugInfo("errorMessage", videoError.message)

      // Provide specific error messages based on the error code
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

      errorDetailsText = `Error code: ${videoError.code}, URL: ${videoUrl}`
    } else {
      console.error("Video error event but no error object available")
      addDebugInfo("emptyErrorObject", true)

      // If we haven't reached max retries, try again
      if (retryCount < maxRetries) {
        console.log(`Retry ${retryCount + 1}/${maxRetries} after error with no error object`)
        setRetryCount((prev) => prev + 1)

        // Try loading the video again with the same URL
        if (currentProgram?.mp4_url) {
          // Add a small delay before retrying
          setTimeout(() => {
            loadVideo(currentProgram.mp4_url, false)
          }, 1000)
          return
        }
      }

      // CORS or security errors often trigger without an error object
      errorMessage = "Video loading failed"
      errorDetailsText = "This could be due to a CORS issue, invalid URL, or unsupported file format."

      // Add additional debug info for troubleshooting
      addDebugInfo("videoElement", {
        src: videoElement.src,
        networkState: videoElement.networkState,
        readyState: videoElement.readyState,
        paused: videoElement.paused,
        ended: videoElement.ended,
        currentSrc: videoElement.currentSrc,
      })

      // Map network state to helpful text
      let networkStateText = "Unknown"
      switch (videoElement.networkState) {
        case HTMLMediaElement.NETWORK_EMPTY:
          networkStateText = "NETWORK_EMPTY"
          break
        case HTMLMediaElement.NETWORK_IDLE:
          networkStateText = "NETWORK_IDLE"
          break
        case HTMLMediaElement.NETWORK_LOADING:
          networkStateText = "NETWORK_LOADING"
          break
        case HTMLMediaElement.NETWORK_NO_SOURCE:
          networkStateText = "NETWORK_NO_SOURCE"
          break
      }

      errorDetailsText += ` Network state: ${networkStateText}. URL: ${videoUrl}`
    }

    // Log the current URL
    console.error("Current video URL when error occurred:", videoUrl)

    // Set the error state
    setError(`Video error: ${errorMessage}`)
    setErrorDetails(errorDetailsText)
    setIsLoading(false)
  }

  // Handle video can play
  const handleCanPlay = () => {
    console.log("Video can play event triggered for URL:", videoUrl)
    addDebugInfo("canPlay", true)
    addDebugInfo("canPlayTime", new Date().toISOString())
    clearLoadingTimeout()
    setIsLoading(false)
    setError(null)
    setRetryCount(0) // Reset retry count on successful load
  }

  // Initial setup
  useEffect(() => {
    console.log("Initial setup for channel:", channel.id)
    console.log("Initial program:", initialProgram)
    console.log("Initial program URL:", initialProgram?.mp4_url)
    console.log("Current time (ISO):", new Date().toISOString())
    console.log("Current time (local):", new Date().toLocaleString())

    addDebugInfo("initialSetupTime", new Date().toISOString())
    addDebugInfo("channelId", channel.id)
    addDebugInfo("initialProgramTitle", initialProgram?.title || "None")
    addDebugInfo("initialProgramUrl", initialProgram?.mp4_url || "None")

    // If we have an initial program with a URL, load it
    if (initialProgram && initialProgram.mp4_url) {
      loadVideo(initialProgram.mp4_url)
    } else {
      console.error("No initial program or URL available")
      setError("No video available for this channel")
      setIsLoading(false)
    }

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
      clearLoadingTimeout()
    }
  }, [])

  // Log whenever videoUrl changes
  useEffect(() => {
    console.log("Video URL state changed to:", videoUrl)
    addDebugInfo("videoUrlChanged", videoUrl)
  }, [videoUrl])

  // Try to load HLS.js if needed
  useEffect(() => {
    if (videoType === "hls") {
      // This is just a placeholder - in a real implementation, you would load HLS.js here
      console.log("HLS video detected, should load HLS.js if needed")
    }
  }, [videoType])

  // Function to check if the URL is accessible
  const checkUrlAccessibility = async (url: string) => {
    try {
      const response = await fetch(url, { method: "HEAD", mode: "no-cors" })
      return true
    } catch (error) {
      console.error("URL accessibility check failed:", error)
      return false
    }
  }

  // Try to verify URL accessibility when URL changes
  useEffect(() => {
    if (videoUrl) {
      checkUrlAccessibility(videoUrl).then((isAccessible) => {
        addDebugInfo("urlAccessible", isAccessible)
      })
    }
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
            <p className="text-white">Loading video{retryCount > 0 ? ` (Retry ${retryCount}/${maxRetries})` : ""}...</p>
            {retryCount > 0 && (
              <p className="text-gray-400 text-sm mt-2">
                If loading fails, try refreshing the page or checking the video URL.
              </p>
            )}
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
                disabled={isRefreshing}
                className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 transition-colors flex items-center"
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? "animate-spin" : ""}`} />
                {isRefreshing ? "Refreshing..." : "Force Refresh"}
              </button>
              <button
                onClick={() => router.back()}
                className="bg-gray-600 text-white px-4 py-2 rounded hover:bg-gray-700 transition-colors"
              >
                Go Back
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
            key={`${videoUrl}-${retryCount}`} // This forces a complete remount when the URL or retry count changes
            className="w-full h-full"
            controls
            playsInline
            autoPlay // Add autoPlay to start playing automatically
            onCanPlay={handleCanPlay}
            onEnded={handleVideoEnd}
            onError={handleVideoError}
            onLoadStart={() => {
              console.log("Video load started for URL:", videoUrl)
              addDebugInfo("loadStarted", new Date().toISOString())
              addDebugInfo("videoType", videoType)
            }}
            onLoadedData={() => {
              console.log("Video data loaded for URL:", videoUrl)
              addDebugInfo("loadedData", new Date().toISOString())
            }}
            crossOrigin="anonymous" // Add crossOrigin to help with CORS issues
          >
            {videoType === "hls" ? (
              // HLS stream
              <source src={videoUrl} type="application/vnd.apple.mpegurl" />
            ) : (
              // Regular MP4
              <source src={videoUrl} type="video/mp4" />
            )}
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
          disabled={isRefreshing}
          className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 flex items-center"
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? "animate-spin" : ""}`} />
          {isRefreshing ? "Refreshing..." : "Force Refresh Program"}
        </button>
      </div>

      {/* Debug info */}
      <div className="bg-black p-2 text-xs text-gray-500">
        <p>Channel ID: {channel.id}</p>
        <p>Current Program: {currentProgram?.title || "None"}</p>
        <p>Program URL: {currentProgram?.mp4_url || "None"}</p>
        <p>Video URL: {videoUrl || "None"}</p>
        <p>Video Type: {videoType}</p>
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
        <p>
          Retry Count: {retryCount}/{maxRetries}
        </p>

        {/* Advanced Debug Info */}
        <details className="mt-2">
          <summary className="cursor-pointer text-gray-400">Advanced Debug Info</summary>
          <div className="mt-2 pl-2 border-l border-gray-700">
            {Object.entries(debugInfo).map(([key, value]) => (
              <p key={key}>
                {key}: {typeof value === "object" ? JSON.stringify(value) : String(value)}
              </p>
            ))}
          </div>
        </details>
      </div>
    </div>
  )
}
