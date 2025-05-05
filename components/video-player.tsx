"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { Loader2, ChevronLeft, ExternalLink } from "lucide-react"
import { getCurrentProgram, getUpcomingPrograms } from "@/lib/supabase"

interface VideoPlayerProps {
  channel: any
  initialProgram: any
  upcomingPrograms: any[]
}

export function VideoPlayer({ channel, initialProgram, upcomingPrograms: initialUpcoming }: VideoPlayerProps) {
  const router = useRouter()
  const videoRef = useRef<HTMLVideoElement>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [currentProgram, setCurrentProgram] = useState(initialProgram)
  const [upcomingPrograms, setUpcomingPrograms] = useState(initialUpcoming)
  const [programCheckInterval, setProgramCheckInterval] = useState<NodeJS.Timeout | null>(null)
  const [currentUrl, setCurrentUrl] = useState<string | null>(null)
  const [videoElement, setVideoElement] = useState<HTMLVideoElement | null>(null)

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

  // Open URL directly in a new tab
  const openUrlDirectly = () => {
    if (currentUrl) {
      window.open(currentUrl, "_blank")
    }
  }

  // Create a new video element programmatically
  const createVideoElement = () => {
    if (!videoRef.current) return

    // Remove any existing video element
    while (videoRef.current.firstChild) {
      videoRef.current.removeChild(videoRef.current.firstChild)
    }

    // Create a new video element
    const video = document.createElement("video")
    video.className = "w-full h-full"
    video.controls = true
    video.playsInline = true
    video.crossOrigin = "anonymous"
    video.autoplay = true

    // Add event listeners
    video.addEventListener("canplay", () => {
      setIsLoading(false)
      setError(null)
    })

    video.addEventListener("ended", handleVideoEnd)

    video.addEventListener("error", (e) => {
      console.error("Video error:", e)
      setError(`Error playing video: ${video.error?.message || "Unknown error"}`)
      setIsLoading(false)
    })

    // Append the video element to the container
    videoRef.current.appendChild(video)
    setVideoElement(video)

    return video
  }

  // Load video with URL
  const loadVideo = (url: string) => {
    if (!url) {
      setError("No video URL provided")
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      // Fix double slashes in the URL
      const fixedUrl = fixUrl(url)
      console.log("Loading video with URL:", fixedUrl)
      setCurrentUrl(fixedUrl)

      // Create a new video element
      const video = createVideoElement()
      if (!video) return

      // Set the source
      video.src = fixedUrl

      // Try to play
      video.play().catch((err) => {
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

  // Check for program updates
  const checkForProgramUpdates = async () => {
    try {
      const { program } = await getCurrentProgram(channel.id)
      const { programs } = await getUpcomingPrograms(channel.id)

      if (program && (!currentProgram || program.id !== currentProgram.id)) {
        console.log("New program detected:", program.title)
        setCurrentProgram(program)

        if (program.mp4_url) {
          loadVideo(program.mp4_url)
        }
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

  // Initial setup
  useEffect(() => {
    console.log("Initial setup for channel:", channel.id)

    // Set up video player
    if (initialProgram && initialProgram.mp4_url) {
      console.log("Loading initial program:", initialProgram.title)
      loadVideo(initialProgram.mp4_url)
    } else {
      console.log("No initial program, checking for current program")
      checkForProgramUpdates()
    }

    // Check for program updates every minute
    const interval = setInterval(checkForProgramUpdates, 60000)
    setProgramCheckInterval(interval)

    return () => {
      if (interval) clearInterval(interval)
    }
  }, [])

  // Try alternative approach with iframe
  const tryWithIframe = () => {
    if (!currentUrl) return

    setIsLoading(true)
    setError(null)

    try {
      if (!videoRef.current) return

      // Remove any existing content
      while (videoRef.current.firstChild) {
        videoRef.current.removeChild(videoRef.current.firstChild)
      }

      // Create an iframe
      const iframe = document.createElement("iframe")
      iframe.className = "w-full h-full border-0"
      iframe.src = currentUrl
      iframe.allow = "autoplay; fullscreen"
      iframe.setAttribute("allowfullscreen", "true")

      // Append the iframe to the container
      videoRef.current.appendChild(iframe)
      setIsLoading(false)
    } catch (err) {
      console.error("Error creating iframe:", err)
      setError(`Error creating iframe: ${err instanceof Error ? err.message : String(err)}`)
      setIsLoading(false)
    }
  }

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
            <p className="text-red-500 mb-4">{error}</p>
            <div className="flex flex-wrap justify-center gap-3">
              <button
                onClick={() => currentProgram && loadVideo(currentProgram.mp4_url)}
                className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 transition-colors"
              >
                Try Again
              </button>
              <button
                onClick={openUrlDirectly}
                className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition-colors flex items-center"
              >
                <ExternalLink className="h-4 w-4 mr-2" /> Open Directly
              </button>
              <button
                onClick={tryWithIframe}
                className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 transition-colors"
              >
                Try with Iframe
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Video container */}
      <div ref={videoRef} className="w-full aspect-video bg-black"></div>

      {/* Program info */}
      {currentProgram && (
        <div className="bg-black p-4">
          <h2 className="text-xl font-bold text-white">{currentProgram.title}</h2>
          {upcomingPrograms.length > 0 && (
            <p className="text-gray-400 text-sm mt-1">Next: {upcomingPrograms[0].title}</p>
          )}
        </div>
      )}

      {/* Debug info */}
      <div className="bg-black p-4 border-t border-gray-800">
        <h3 className="text-white font-bold mb-2">Debug Information</h3>
        <div className="text-xs text-gray-400">
          <p>Channel ID: {channel.id}</p>
          <p>Program: {currentProgram?.title || "None"}</p>
          <p>Original URL: {currentProgram?.mp4_url || "None"}</p>
          <p>Fixed URL: {currentUrl || "None"}</p>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            onClick={checkForProgramUpdates}
            className="bg-yellow-600 text-white px-3 py-1 rounded text-sm hover:bg-yellow-700"
          >
            Refresh Program
          </button>
          <button
            onClick={openUrlDirectly}
            className="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700 flex items-center"
          >
            <ExternalLink className="h-3 w-3 mr-1" /> Open URL
          </button>
          <button
            onClick={tryWithIframe}
            className="bg-green-600 text-white px-3 py-1 rounded text-sm hover:bg-green-700"
          >
            Try with Iframe
          </button>
        </div>
      </div>
    </div>
  )
}
