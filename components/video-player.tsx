"use client"

import type React from "react"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { Loader2, RefreshCw, Download, ExternalLink } from "lucide-react"

interface VideoPlayerProps {
  channel: any
  initialProgram: any
  upcomingPrograms: any[]
}

export function VideoPlayer({ channel, initialProgram, upcomingPrograms }: VideoPlayerProps) {
  const router = useRouter()
  const videoRef = useRef<HTMLVideoElement>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [videoUrl, setVideoUrl] = useState<string | null>(null)
  const [debugInfo, setDebugInfo] = useState<string>("")
  const [attemptCount, setAttemptCount] = useState(0)

  // Go back
  const handleBack = () => {
    router.back()
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

  // Add aggressive cache buster with random values
  const addCacheBuster = (url: string): string => {
    const random = Math.floor(Math.random() * 1000000)
    const timestamp = Date.now()
    const cacheBuster = `t=${timestamp}&r=${random}`
    return url.includes("?") ? `${url}&${cacheBuster}` : `${url}?${cacheBuster}`
  }

  // Try to download the video directly
  const downloadVideo = () => {
    if (!videoUrl) return

    try {
      // Create a temporary anchor element
      const a = document.createElement("a")
      a.href = videoUrl
      a.download = `video-${initialProgram?.id || "download"}.mp4`
      a.target = "_blank"
      a.rel = "noopener noreferrer"
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
    } catch (err) {
      console.error("Error downloading video:", err)
      alert("Could not download the video. Please try opening it directly instead.")
    }
  }

  // Open the video URL directly in a new tab
  const openDirectly = () => {
    if (videoUrl) {
      window.open(videoUrl, "_blank")
    }
  }

  // Load the video with more aggressive error handling
  const loadVideo = () => {
    if (!initialProgram || !initialProgram.mp4_url || !videoRef.current) {
      setError("No video URL available")
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    setError(null)
    setAttemptCount((prev) => prev + 1)

    try {
      // Get the URL from the program and fix any double slashes
      const rawUrl = initialProgram.mp4_url
      const fixedUrl = fixUrl(rawUrl)

      // Add an aggressive cache buster
      const urlWithCacheBuster = addCacheBuster(fixedUrl)

      // Set debug info
      setDebugInfo(`
        Attempt: ${attemptCount + 1}
        Original URL: ${rawUrl}
        Fixed URL: ${fixedUrl}
        URL with cache buster: ${urlWithCacheBuster}
        Channel ID: ${channel.id}
        Program ID: ${initialProgram.id}
        Program title: ${initialProgram.title}
        Time: ${new Date().toISOString()}
      `)

      // Set the video source
      videoRef.current.src = urlWithCacheBuster
      setVideoUrl(urlWithCacheBuster)

      // Set CORS attributes
      videoRef.current.crossOrigin = "anonymous"

      // Set other attributes that might help
      videoRef.current.preload = "auto"

      // Load the video
      videoRef.current.load()

      // Try to play
      videoRef.current
        .play()
        .then(() => {
          setIsLoading(false)
          setError(null)
        })
        .catch((err) => {
          console.error("Error playing video:", err)
          setError(`Error playing video: ${err.message}`)
          setIsLoading(false)
        })
    } catch (err) {
      console.error("Error loading video:", err)
      setError(`Error loading video: ${err instanceof Error ? err.message : String(err)}`)
      setIsLoading(false)
    }
  }

  // Handle video error with more detailed reporting
  const handleVideoError = (e: React.SyntheticEvent<HTMLVideoElement>) => {
    const videoElement = e.currentTarget
    let errorMessage = "Unknown error"

    if (videoElement.error) {
      switch (videoElement.error.code) {
        case MediaError.MEDIA_ERR_ABORTED:
          errorMessage = "The fetching process was aborted by the user"
          break
        case MediaError.MEDIA_ERR_NETWORK:
          errorMessage = "Network error - video download failed"
          break
        case MediaError.MEDIA_ERR_DECODE:
          errorMessage = "Video decoding failed - format may be unsupported"
          break
        case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED:
          errorMessage = "Video not found (404) or access denied"
          break
        default:
          errorMessage = `Error code: ${videoElement.error.code}`
      }

      if (videoElement.error.message) {
        errorMessage += ` - ${videoElement.error.message}`
      }
    }

    console.error("Video error:", errorMessage)
    setError(`Video error: ${errorMessage}`)
    setIsLoading(false)

    // Update debug info with error details
    setDebugInfo((prev) => `${prev}\n\nError: ${errorMessage}\nTime: ${new Date().toISOString()}`)
  }

  // Initial setup
  useEffect(() => {
    console.log("Initial setup for channel:", channel.id)
    console.log("Initial program:", initialProgram)

    if (initialProgram && initialProgram.mp4_url) {
      console.log("Program URL:", initialProgram.mp4_url)
      loadVideo()
    } else {
      setError("No video URL available")
      setIsLoading(false)
    }
  }, [channel.id, initialProgram])

  // Test if the URL is accessible
  const testUrl = async () => {
    if (!videoUrl) return

    setDebugInfo((prev) => `${prev}\n\nTesting URL accessibility...`)

    try {
      const response = await fetch(videoUrl, { method: "HEAD" })
      const status = response.status
      const headers = Array.from(response.headers.entries())
        .map(([key, value]) => `${key}: ${value}`)
        .join("\n")

      setDebugInfo(
        (prev) => `${prev}\n\nURL Test Results:
        Status: ${status}
        Headers:
        ${headers}
      `,
      )
    } catch (err) {
      setDebugInfo((prev) => `${prev}\n\nURL Test Error: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  return (
    <div className="relative bg-black">
      {/* Back button */}
      <button
        onClick={handleBack}
        className="absolute top-4 left-4 z-10 bg-black/50 p-2 rounded-full hover:bg-black/70 transition-colors"
      >
        <span className="text-white">← Back</span>
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
            <p className="text-red-500 mb-4">{error}</p>
            <div className="flex flex-wrap justify-center gap-3">
              <button
                onClick={loadVideo}
                className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 transition-colors flex items-center"
              >
                <RefreshCw className="h-4 w-4 mr-2" /> Try Again
              </button>
              <button
                onClick={openDirectly}
                className="bg-gray-700 text-white px-4 py-2 rounded hover:bg-gray-600 transition-colors flex items-center"
              >
                <ExternalLink className="h-4 w-4 mr-2" /> Open Directly
              </button>
              <button
                onClick={downloadVideo}
                className="bg-gray-700 text-white px-4 py-2 rounded hover:bg-gray-600 transition-colors flex items-center"
              >
                <Download className="h-4 w-4 mr-2" /> Download
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Video element */}
      <div className="w-full aspect-video bg-black">
        <video
          ref={videoRef}
          className="w-full h-full"
          controls
          playsInline
          crossOrigin="anonymous"
          onError={handleVideoError}
          onCanPlay={() => setIsLoading(false)}
        >
          Your browser does not support the video tag.
        </video>
      </div>

      {/* Program info */}
      {initialProgram && (
        <div className="bg-black p-4">
          <h2 className="text-xl font-bold text-white">{initialProgram.title}</h2>
          {upcomingPrograms.length > 0 && (
            <p className="text-gray-400 text-sm mt-1">Next: {upcomingPrograms[0].title}</p>
          )}
        </div>
      )}

      {/* Debug info */}
      <div className="bg-black p-4 border-t border-gray-800">
        <h3 className="text-white font-bold mb-2">Debug Information</h3>
        <pre className="text-xs text-gray-400 whitespace-pre-wrap bg-gray-900 p-3 rounded overflow-auto max-h-40">
          {debugInfo}
        </pre>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            onClick={openDirectly}
            className="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700 flex items-center"
          >
            <ExternalLink className="h-3 w-3 mr-1" /> Open Directly
          </button>
          <button
            onClick={downloadVideo}
            className="bg-green-600 text-white px-3 py-1 rounded text-sm hover:bg-green-700 flex items-center"
          >
            <Download className="h-3 w-3 mr-1" /> Download
          </button>
          <button
            onClick={loadVideo}
            className="bg-yellow-600 text-white px-3 py-1 rounded text-sm hover:bg-yellow-700 flex items-center"
          >
            <RefreshCw className="h-3 w-3 mr-1" /> Reload
          </button>
          <button onClick={testUrl} className="bg-purple-600 text-white px-3 py-1 rounded text-sm hover:bg-purple-700">
            Test URL
          </button>
        </div>
      </div>
    </div>
  )
}
