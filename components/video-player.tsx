"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { Loader2, ChevronLeft } from "lucide-react"
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

  // Go back
  const handleBack = () => {
    router.back()
  }

  // Fix URL - ONLY fix double slashes, nothing else
  const fixUrl = (url: string): string => {
    if (!url) return ""

    // First preserve the protocol (http:// or https://)
    const parts = url.split("://")
    if (parts.length <= 1) return url

    const protocol = parts[0] + "://"
    const path = parts[1].replace(/\/+/g, "/")

    return protocol + path
  }

  // Check for program updates
  const checkForProgramUpdates = async () => {
    try {
      const { program } = await getCurrentProgram(channel.id)
      const { programs } = await getUpcomingPrograms(channel.id)

      if (program && (!currentProgram || program.id !== currentProgram.id)) {
        setCurrentProgram(program)
        loadVideo(program)
      }

      setUpcomingPrograms(programs)
    } catch (err) {
      console.error("Error checking for program updates:", err)
    }
  }

  // Load video
  const loadVideo = (program: any) => {
    if (!program || !program.mp4_url || !videoRef.current) return

    setIsLoading(true)
    setError(null)

    try {
      // Get the URL and fix any double slashes
      const fixedUrl = fixUrl(program.mp4_url)
      console.log("Loading video with URL:", fixedUrl)

      // Set the video source
      videoRef.current.src = fixedUrl
      videoRef.current.load()

      // Play the video
      videoRef.current
        .play()
        .then(() => {
          setIsLoading(false)
        })
        .catch((err) => {
          console.error("Error playing video:", err)
          setError("Error playing video. Please try again.")
          setIsLoading(false)
        })
    } catch (err) {
      console.error("Error loading video:", err)
      setError("Error loading video. Please try again.")
      setIsLoading(false)
    }
  }

  // Handle video error
  const handleVideoError = () => {
    setError("Error loading video. Please try again.")
    setIsLoading(false)
  }

  // Handle video end
  const handleVideoEnd = () => {
    checkForProgramUpdates()
  }

  // Initial setup
  useEffect(() => {
    if (initialProgram) {
      loadVideo(initialProgram)
    }

    // Check for program updates every minute
    const interval = setInterval(checkForProgramUpdates, 60000)

    return () => clearInterval(interval)
  }, [])

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
              onClick={() => loadVideo(currentProgram)}
              className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 transition-colors"
            >
              Try Again
            </button>
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
          onError={handleVideoError}
          onEnded={handleVideoEnd}
          onCanPlay={() => setIsLoading(false)}
        >
          Your browser does not support the video tag.
        </video>
      </div>

      {/* Program info */}
      {currentProgram && (
        <div className="bg-black p-4">
          <h2 className="text-xl font-bold text-white">{currentProgram.title}</h2>
          {upcomingPrograms.length > 0 && (
            <p className="text-gray-400 text-sm mt-1">Next: {upcomingPrograms[0].title}</p>
          )}
        </div>
      )}

      {/* Debug info - only visible in development */}
      {process.env.NODE_ENV === "development" && currentProgram && (
        <div className="bg-gray-900 p-2 text-xs text-gray-400">
          <p>Channel ID: {channel.id}</p>
          <p>Program ID: {currentProgram.id}</p>
          <p>Original URL: {currentProgram.mp4_url}</p>
          <p>Fixed URL: {fixUrl(currentProgram.mp4_url)}</p>
        </div>
      )}
    </div>
  )
}
