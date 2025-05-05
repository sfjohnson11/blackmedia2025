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
  const [currentUrl, setCurrentUrl] = useState("")
  const [usedFallback, setUsedFallback] = useState(false)

  // Go back
  const handleBack = () => {
    router.push("/freedom-school")
  }

  // Fix double slashes in URLs (but preserve http://)
  const fixUrl = (url: string): string => {
    if (!url) return ""

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
    return protocol + url
  }

  // Load video
  const loadVideo = (url: string) => {
    if (!url) return

    // Fix double slashes in the URL
    const fixedUrl = fixUrl(url)
    console.log("Freedom School: Loading video with URL:", fixedUrl)

    // Set the video URL - this will trigger a remount of the video element due to the key prop
    setCurrentUrl(fixedUrl)
    setIsLoading(true)
    setError(null)
  }

  // Try fallback
  const tryFallback = () => {
    if (!fallbackUrl || usedFallback) return

    console.log("Freedom School: Trying fallback URL:", fallbackUrl)
    setUsedFallback(true)
    loadVideo(fallbackUrl)
  }

  // Handle video error
  const handleVideoError = (e: React.SyntheticEvent<HTMLVideoElement>) => {
    console.error("Freedom School: Video error:", e)

    if (!usedFallback && fallbackUrl) {
      tryFallback()
    } else {
      setError("Error playing video. Please try again.")
      setIsLoading(false)
    }
  }

  // Initial setup
  useEffect(() => {
    console.log("Freedom School: Initial setup for video ID:", videoId)

    if (videoUrl) {
      loadVideo(videoUrl)
    } else {
      setError("No video URL provided")
      setIsLoading(false)
    }
  }, [videoId, videoUrl])

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
        {currentUrl && (
          <video
            key={currentUrl} // This forces a complete remount when the URL changes
            className="w-full h-full"
            controls
            playsInline
            autoPlay // Add autoPlay to start playing automatically
            onCanPlay={() => setIsLoading(false)}
            onError={handleVideoError}
          >
            <source src={currentUrl} type="video/mp4" />
            Your browser does not support the video tag.
          </video>
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
        <p>Current URL: {currentUrl || "None"}</p>
        <p>Using Fallback: {usedFallback ? "Yes" : "No"}</p>
      </div>
    </div>
  )
}
