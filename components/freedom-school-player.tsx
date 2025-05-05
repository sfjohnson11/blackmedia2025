"use client"

import type React from "react"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { Loader2, ChevronLeft, AlertTriangle, RefreshCw } from "lucide-react"

interface FreedomSchoolPlayerProps {
  videoId?: number
  videoUrl?: string
  title?: string
  fallbackUrl?: string
}

export function FreedomSchoolPlayer({
  videoId = 1,
  videoUrl = "https://bttv-videos.s3.amazonaws.com/freedom-school/intro.mp4",
  title = "Freedom School Introduction",
  fallbackUrl = "https://bttv-videos.s3.amazonaws.com/freedom-school/welcome.mp4",
}: FreedomSchoolPlayerProps) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [errorDetails, setErrorDetails] = useState<string | null>(null)
  const [currentUrl, setCurrentUrl] = useState("")
  const [usedFallback, setUsedFallback] = useState(false)
  const [retryCount, setRetryCount] = useState(0)
  const videoRef = useRef<HTMLVideoElement>(null)
  const loadTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const maxRetries = 3

  // Go back
  const handleBack = () => {
    router.push("/")
  }

  // Fix double slashes in URLs (but preserve http://)
  const fixUrl = (url: string): string => {
    if (!url) {
      console.log("Freedom School: WARNING - Empty URL passed to fixUrl")
      return ""
    }

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
    return fixedUrl
  }

  // Check if URL is accessible
  const checkUrlAccessibility = async (url: string): Promise<boolean> => {
    try {
      const response = await fetch(url, { method: "HEAD", mode: "no-cors" })
      return true
    } catch (error) {
      console.error("Freedom School: URL accessibility check failed:", error)
      return false
    }
  }

  // Load video with retry logic
  const loadVideo = async (url: string, retry = 0) => {
    console.log(`Freedom School: loadVideo called with URL: ${url}, retry: ${retry}`)

    if (!url) {
      console.error("Freedom School: ERROR - Empty URL passed to loadVideo")
      setError("No video URL available")
      setIsLoading(false)
      return
    }

    // Clear any existing timeout
    if (loadTimeoutRef.current) {
      clearTimeout(loadTimeoutRef.current)
    }

    // Fix double slashes in the URL
    const fixedUrl = fixUrl(url)
    console.log("Freedom School: Setting video URL to:", fixedUrl)

    // Add cache-busting parameter if retrying
    const finalUrl = retry > 0 ? `${fixedUrl}${fixedUrl.includes("?") ? "&" : "?"}cb=${Date.now()}` : fixedUrl

    // Set the video URL - this will trigger a remount of the video element due to the key prop
    setCurrentUrl(finalUrl)
    setIsLoading(true)
    setError(null)
    setErrorDetails(null)
    setRetryCount(retry)

    // Set a timeout to detect if video loading takes too long
    loadTimeoutRef.current = setTimeout(() => {
      console.log("Freedom School: Video load timeout triggered")
      if (isLoading && videoRef.current) {
        handleLoadingTimeout()
      }
    }, 15000) // 15 seconds timeout
  }

  // Handle loading timeout
  const handleLoadingTimeout = () => {
    console.log("Freedom School: Loading timeout occurred")

    if (retryCount < maxRetries) {
      console.log(`Freedom School: Retrying (${retryCount + 1}/${maxRetries})`)
      loadVideo(videoUrl || "", retryCount + 1)
    } else if (!usedFallback && fallbackUrl) {
      tryFallback()
    } else {
      setError("Video loading timed out")
      setErrorDetails(`The video took too long to load. URL: ${currentUrl}`)
      setIsLoading(false)
    }
  }

  // Try fallback
  const tryFallback = () => {
    if (!fallbackUrl || usedFallback) {
      console.log("Freedom School: No fallback URL available or already used fallback")
      setIsLoading(false)
      return
    }

    console.log("Freedom School: Trying fallback URL:", fallbackUrl)
    setUsedFallback(true)
    setRetryCount(0)
    loadVideo(fallbackUrl)
  }

  // Handle video error with improved error logging
  const handleVideoError = (e: React.SyntheticEvent<HTMLVideoElement>) => {
    const videoElement = e.currentTarget

    console.log("Freedom School: Video error event triggered")
    console.log("Freedom School: Video network state:", videoElement.networkState)
    console.log("Freedom School: Video ready state:", videoElement.readyState)

    // Clear loading timeout
    if (loadTimeoutRef.current) {
      clearTimeout(loadTimeoutRef.current)
      loadTimeoutRef.current = null
    }

    // Check if we have an error object
    if (videoElement.error) {
      const videoError = videoElement.error

      // Log the error code and message
      console.error("Freedom School: Video error code:", videoError.code)
      console.error("Freedom School: Video error message:", videoError.message)

      // Provide specific error messages based on the error code
      let errorMessage = "Unknown video error"

      switch (videoError.code) {
        case MediaError.MEDIA_ERR_ABORTED:
          errorMessage = "Video playback was aborted"
          break
        case MediaError.MEDIA_ERR_NETWORK:
          errorMessage = "A network error occurred while loading the video"
          break
        case MediaError.MEDIA_ERR_DECODE:
          errorMessage = "The video could not be decoded"
          break
        case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED:
          errorMessage = "The video format is not supported or the URL is invalid"
          break
      }

      // Add the error message if available
      if (videoError.message) {
        errorMessage += `: ${videoError.message}`
      }

      // Set the error state
      setError(`Video error: ${errorMessage}`)
      setErrorDetails(`Error code: ${videoError.code}, URL: ${currentUrl}`)
    } else {
      console.error("Freedom School: Video error event but no error object available")

      // Provide more detailed information about the video element state
      const networkStateText =
        ["NETWORK_EMPTY", "NETWORK_IDLE", "NETWORK_LOADING", "NETWORK_NO_SOURCE"][videoElement.networkState] ||
        "Unknown"

      const readyStateText =
        ["HAVE_NOTHING", "HAVE_METADATA", "HAVE_CURRENT_DATA", "HAVE_FUTURE_DATA", "HAVE_ENOUGH_DATA"][
          videoElement.readyState
        ] || "Unknown"

      setError("Video error occurred")
      setErrorDetails(
        `Network state: ${networkStateText} (${videoElement.networkState}), Ready state: ${readyStateText} (${videoElement.readyState}), URL: ${currentUrl}`,
      )
    }

    // Try retry or fallback
    if (retryCount < maxRetries) {
      console.log(`Freedom School: Retrying (${retryCount + 1}/${maxRetries})`)
      loadVideo(videoUrl || "", retryCount + 1)
    } else if (!usedFallback && fallbackUrl) {
      tryFallback()
    } else {
      setIsLoading(false)
    }
  }

  // Handle video can play
  const handleCanPlay = () => {
    console.log("Freedom School: Video can play event triggered for URL:", currentUrl)

    // Clear loading timeout
    if (loadTimeoutRef.current) {
      clearTimeout(loadTimeoutRef.current)
      loadTimeoutRef.current = null
    }

    setIsLoading(false)

    // Start playing
    if (videoRef.current) {
      videoRef.current.play().catch((err) => {
        console.log("Freedom School: Autoplay prevented:", err)
      })
    }
  }

  // Manual refresh
  const handleManualRefresh = () => {
    console.log("Freedom School: Manual refresh triggered")
    setRetryCount(0)
    setUsedFallback(false)
    loadVideo(videoUrl || "")
  }

  // Initial setup
  useEffect(() => {
    console.log("Freedom School: Initial setup for video ID:", videoId)
    console.log("Freedom School: Initial video URL:", videoUrl)
    console.log("Freedom School: Fallback URL:", fallbackUrl)

    if (videoUrl) {
      loadVideo(videoUrl)
    } else {
      console.error("Freedom School: No video URL provided")
      setError("No video URL provided")
      setIsLoading(false)
    }

    // Cleanup function
    return () => {
      if (loadTimeoutRef.current) {
        clearTimeout(loadTimeoutRef.current)
      }
    }
  }, [videoId, videoUrl, fallbackUrl])

  return (
    <div className="relative bg-black min-h-screen">
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
            <p className="text-white">
              Loading video{retryCount > 0 ? ` (Attempt ${retryCount + 1}/${maxRetries + 1})` : ""}...
            </p>
          </div>
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-black z-20">
          <div className="text-center p-4 max-w-md">
            <AlertTriangle className="h-12 w-12 text-red-600 mx-auto mb-4" />
            <p className="text-red-500 text-lg mb-4">{error}</p>
            {errorDetails && (
              <details className="mb-4 text-left">
                <summary className="text-gray-400 text-sm cursor-pointer">Technical Details</summary>
                <p className="text-gray-400 text-xs mt-2 p-2 bg-gray-900 rounded">{errorDetails}</p>
              </details>
            )}
            <div className="flex justify-center space-x-4">
              <button
                onClick={handleManualRefresh}
                className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 transition-colors flex items-center"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Try Again
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Video element */}
      <div className="w-full aspect-video bg-black">
        {currentUrl ? (
          <video
            ref={videoRef}
            key={`${currentUrl}-${retryCount}`} // This forces a complete remount when the URL or retry count changes
            className="w-full h-full"
            controls
            playsInline
            preload="auto"
            onCanPlay={handleCanPlay}
            onError={handleVideoError}
            onLoadStart={() => console.log("Freedom School: Video load started for URL:", currentUrl)}
            onLoadedData={() => console.log("Freedom School: Video data loaded for URL:", currentUrl)}
          >
            <source src={currentUrl} type="video/mp4" />
            Your browser does not support the video tag.
          </video>
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <p className="text-white">No video URL available</p>
          </div>
        )}
      </div>

      {/* Video title */}
      <div className="bg-black p-4">
        <h2 className="text-xl font-bold text-white">{title}</h2>
        {usedFallback && <p className="text-yellow-500 text-sm mt-1">Using fallback video source</p>}
        {retryCount > 0 && (
          <p className="text-blue-500 text-sm mt-1">
            Retry attempt: {retryCount}/{maxRetries}
          </p>
        )}
      </div>

      {/* Debug info - only show in development */}
      {process.env.NODE_ENV === "development" && (
        <div className="bg-black p-2 text-xs text-gray-500">
          <p>Video ID: {videoId}</p>
          <p>Original URL: {videoUrl || "None"}</p>
          <p>Current URL: {currentUrl || "None"}</p>
          <p>Using Fallback: {usedFallback ? "Yes" : "No"}</p>
          <p>
            Retry Count: {retryCount}/{maxRetries}
          </p>
          <p>Loading: {isLoading ? "Yes" : "No"}</p>
          <p>Error: {error || "None"}</p>
        </div>
      )}
    </div>
  )
}
