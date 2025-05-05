"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Loader2, ChevronLeft } from "lucide-react"

interface FreedomSchoolPlayerProps {
  videoId: number
  videoUrl: string
  title: string
  fallbackUrl?: string
}

export function FreedomSchoolPlayer({ videoId, videoUrl, title, fallbackUrl }: FreedomSchoolPlayerProps) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [errorDetails, setErrorDetails] = useState<string | null>(null)
  const [currentUrl, setCurrentUrl] = useState("")
  const [usedFallback, setUsedFallback] = useState(false)

  // Go back
  const handleBack = () => {
    router.push("/freedom-school")
  }

  // Fix double slashes in URLs (but preserve http://)
  const fixUrl = (url: string): string => {
    if (!url) {
      console.log("Freedom School: WARNING - Empty URL passed to fixUrl")
      return ""
    }

    console.log("Freedom School: Original URL before fixing:", url)

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
    console.log("Freedom School: Fixed URL after processing:", fixedUrl)
    return fixedUrl
  }

  // Load video
  const loadVideo = (url: string) => {
    console.log("Freedom School: loadVideo called with URL:", url)

    if (!url) {
      console.error("Freedom School: ERROR - Empty URL passed to loadVideo")
      setError("No video URL available")
      setIsLoading(false)
      return
    }

    // Fix double slashes in the URL
    const fixedUrl = fixUrl(url)
    console.log("Freedom School: Setting video URL to:", fixedUrl)

    // Set the video URL - this will trigger a remount of the video element due to the key prop
    setCurrentUrl(fixedUrl)
    setIsLoading(true)
    setError(null)
    setErrorDetails(null)
  }

  // Try fallback
  const tryFallback = () => {
    if (!fallbackUrl || usedFallback) {
      console.log("Freedom School: No fallback URL available or already used fallback")
      return
    }

    console.log("Freedom School: Trying fallback URL:", fallbackUrl)
    setUsedFallback(true)
    loadVideo(fallbackUrl)
  }

  // Handle video error with improved error logging
  const handleVideoError = (e: React.SyntheticEvent<HTMLVideoElement>) => {
    const videoElement = e.currentTarget
    const videoError = videoElement.error

    console.log("Freedom School: Video error event triggered")

    if (videoError) {
      // Log the error code and message
      console.error("Freedom School: Video error code:", videoError.code)
      console.error("Freedom School: Video error message:", videoError.message)

      // Provide specific error messages based on the error code
      let errorMessage = "Unknown video error"

      switch (videoError.code) {
        case MediaError.MEDIA_ERR_ABORTED:
          errorMessage = "Video playback was aborted"
          console.error("Freedom School: MEDIA_ERR_ABORTED: Video playback was aborted")
          break
        case MediaError.MEDIA_ERR_NETWORK:
          errorMessage = "A network error occurred while loading the video"
          console.error("Freedom School: MEDIA_ERR_NETWORK: A network error occurred")
          break
        case MediaError.MEDIA_ERR_DECODE:
          errorMessage = "The video could not be decoded"
          console.error("Freedom School: MEDIA_ERR_DECODE: Failed to decode the video")
          break
        case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED:
          errorMessage = "The video format is not supported or the URL is invalid"
          console.error("Freedom School: MEDIA_ERR_SRC_NOT_SUPPORTED: Unsupported video source")
          break
        default:
          console.error("Freedom School: Unknown video error")
      }

      // Add the error message if available
      if (videoError.message) {
        errorMessage += `: ${videoError.message}`
      }

      // Log the current URL
      console.error("Freedom School: Current video URL when error occurred:", currentUrl)

      // Set the error state
      setError(`Video error: ${errorMessage}`)
      setErrorDetails(`Error code: ${videoError.code}, URL: ${currentUrl}`)
    } else {
      console.error("Freedom School: Video error event but no error object available")
      setError("Video error occurred")
    }

    if (!usedFallback && fallbackUrl) {
      tryFallback()
    } else {
      setIsLoading(false)
    }
  }

  // Handle video can play
  const handleCanPlay = () => {
    console.log("Freedom School: Video can play event triggered for URL:", currentUrl)
    setIsLoading(false)
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
  }, [videoId, videoUrl])

  // Log whenever currentUrl changes
  useEffect(() => {
    console.log("Freedom School: Video URL state changed to:", currentUrl)
  }, [currentUrl])

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
          <div className="text-center p-4">
            <p className="text-red-500 mb-4">{error}</p>
            {errorDetails && <p className="text-gray-400 text-sm mb-4">{errorDetails}</p>}
            <button
              onClick={() => loadVideo(usedFallback && fallbackUrl ? fallbackUrl : videoUrl)}
              className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 transition-colors"
            >
              Try Again
            </button>
          </div>
        </div>
      )}

      {/* Video element */}
      <div className="w-full aspect-video bg-black">
        {currentUrl ? (
          <video
            key={currentUrl} // This forces a complete remount when the URL changes
            className="w-full h-full"
            controls
            playsInline
            autoPlay // Add autoPlay to start playing automatically
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
      </div>

      {/* Debug info */}
      <div className="bg-black p-2 text-xs text-gray-500">
        <p>Video ID: {videoId}</p>
        <p>Original URL: {videoUrl || "None"}</p>
        <p>Current URL: {currentUrl || "None"}</p>
        <p>Using Fallback: {usedFallback ? "Yes" : "No"}</p>
        <p>Loading: {isLoading ? "Yes" : "No"}</p>
        <p>Error: {error || "None"}</p>
      </div>
    </div>
  )
}
