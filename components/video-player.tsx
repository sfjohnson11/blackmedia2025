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

  // Check for program updates
  const checkForProgramUpdates = async () => {
    try {
      const { program } = await getCurrentProgram(channel.id)
      const { programs } = await getUpcomingPrograms(channel.id)

      if (program && (!currentProgram || program.id !== currentProgram.id)) {
        console.log("New program detected:", program.title)
        setCurrentProgram(program)
        playVideo(program.mp4_url)
      }

      setUpcomingPrograms(programs)
    } catch (err) {
      console.error("Error checking for program updates:", err)
    }
  }

  // Play video with direct URL
  const playVideo = (url: string) => {
    if (!videoRef.current || !url) return

    setIsLoading(true)
    setError(null)

    try {
      console.log("Playing video with URL:", url)

      // Set the video source directly
      videoRef.current.src = url
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

  // Handle video end
  const handleVideoEnd = () => {
    console.log("Video ended, checking for next program")
    checkForProgramUpdates()
  }

  // Initial setup
  useEffect(() => {
    console.log("Initial setup for channel:", channel.id)

    if (initialProgram && initialProgram.mp4_url) {
      console.log("Initial program:", initialProgram.title)
      playVideo(initialProgram.mp4_url)
    } else {
      console.log("No initial program, checking for current program")
      checkForProgramUpdates()
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
              onClick={() => currentProgram && playVideo(currentProgram.mp4_url)}
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
          onError={() => {
            setError("Error loading video. Please try again.")
            setIsLoading(false)
          }}
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

      {/* Debug info */}
      <div className="bg-gray-900 p-2 text-xs text-gray-400">
        <p>Channel ID: {channel.id}</p>
        <p>Current Program: {currentProgram?.title || "None"}</p>
        <p>URL: {currentProgram?.mp4_url || "None"}</p>
        <button
          onClick={checkForProgramUpdates}
          className="bg-gray-800 text-gray-300 px-2 py-1 rounded text-xs mt-1 hover:bg-gray-700"
        >
          Check for Updates
        </button>
      </div>
    </div>
  )
}
