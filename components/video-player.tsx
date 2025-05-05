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
  const [currentProgram, setCurrentProgram] = useState(initialProgram)
  const [upcomingPrograms, setUpcomingPrograms] = useState(initialUpcoming)
  const [programCheckInterval, setProgramCheckInterval] = useState<NodeJS.Timeout | null>(null)

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

        if (videoRef.current) {
          videoRef.current.src = program.mp4_url
          videoRef.current.load()
          videoRef.current.play().catch((err) => {
            console.error("Error playing video:", err)
          })
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
    if (initialProgram && initialProgram.mp4_url && videoRef.current) {
      console.log("Loading initial program:", initialProgram.title)
      console.log("URL:", initialProgram.mp4_url)

      videoRef.current.src = initialProgram.mp4_url
      videoRef.current.load()
      videoRef.current.play().catch((err) => {
        console.error("Error playing initial video:", err)
      })
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

      {/* Video element */}
      <div className="w-full aspect-video bg-black">
        <video
          ref={videoRef}
          className="w-full h-full"
          controls
          playsInline
          onCanPlay={() => setIsLoading(false)}
          onEnded={handleVideoEnd}
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

      {/* Manual refresh button */}
      <div className="bg-black p-4 flex justify-center">
        <button onClick={checkForProgramUpdates} className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700">
          Refresh Program
        </button>
      </div>
    </div>
  )
}
