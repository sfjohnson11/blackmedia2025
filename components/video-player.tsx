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
  const [lastProgramCheck, setLastProgramCheck] = useState(Date.now())

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

  // Check for program updates
  const checkForProgramUpdates = async () => {
    // Don't check too frequently
    const now = Date.now()
    if (now - lastProgramCheck < 10000) {
      // 10 seconds minimum between checks
      return
    }
    setLastProgramCheck(now)

    try {
      const { program } = await getCurrentProgram(channel.id)
      const { programs } = await getUpcomingPrograms(channel.id)

      // If we have a new program, switch to it
      if (program && (!currentProgram || program.id !== currentProgram.id)) {
        console.log("New program detected:", program.title)
        setCurrentProgram(program)

        if (videoRef.current && program.mp4_url) {
          // Fix double slashes in the URL
          const fixedUrl = fixUrl(program.mp4_url)
          console.log("Playing new program with URL:", fixedUrl)

          // Set the fixed URL as the video source
          videoRef.current.src = fixedUrl
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

      // Fix double slashes in the URL
      const fixedUrl = fixUrl(initialProgram.mp4_url)
      console.log("Playing initial program with URL:", fixedUrl)

      // Set the fixed URL as the video source
      videoRef.current.src = fixedUrl
      videoRef.current.load()
      videoRef.current.play().catch((err) => {
        console.error("Error playing initial video:", err)
      })
    } else {
      console.log("No initial program, checking for current program")
      checkForProgramUpdates()
    }

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
            <p className="text-gray-400 text-sm mt-1">
              Next: {upcomingPrograms[0].title} at {new Date(upcomingPrograms[0].start_time).toLocaleTimeString()}
            </p>
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
