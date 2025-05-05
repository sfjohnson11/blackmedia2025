"use client"

import type React from "react"

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
  const videoContainerRef = useRef<HTMLDivElement>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [currentProgram, setCurrentProgram] = useState(initialProgram)
  const [upcomingPrograms, setUpcomingPrograms] = useState(initialUpcoming)
  const [lastProgramCheck, setLastProgramCheck] = useState(Date.now())
  const [videoUrl, setVideoUrl] = useState("")
  const [error, setError] = useState<string | null>(null)

  // Go back
  const handleBack = () => {
    router.back()
  }

  // Fix double slashes in URLs (but preserve http://)
  const fixUrl = (url: string): string => {
    if (!url) {
      console.log("WARNING: Empty URL passed to fixUrl")
      return ""
    }

    console.log("Original URL before fixing:", url)

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
    console.log("Fixed URL after processing:", fixedUrl)
    return fixedUrl
  }

  // Load video with URL
  const loadVideo = (url: string) => {
    console.log("loadVideo called with URL:", url)

    if (!url) {
      console.error("ERROR: Empty URL passed to loadVideo")
      setError("No video URL available")
      setIsLoading(false)
      return
    }

    // Fix double slashes in the URL
    const fixedUrl = fixUrl(url)
    console.log("Setting video URL to:", fixedUrl)

    // Set the video URL - this will trigger a remount of the video element due to the key prop
    setVideoUrl(fixedUrl)
    setIsLoading(true)
    setError(null)
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

      console.log("Current program from API:", program)
      console.log("Program URL from API:", program?.mp4_url)

      // If we have a new program, switch to it
      if (program && (!currentProgram || program.id !== currentProgram.id)) {
        console.log("New program detected:", program.title)
        setCurrentProgram(program)

        if (program.mp4_url) {
          loadVideo(program.mp4_url)
        } else {
          console.error("ERROR: New program has no mp4_url:", program)
          setError("Program has no video URL")
          setIsLoading(false)
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

  // Handle video error
  const handleVideoError = (e: React.SyntheticEvent<HTMLVideoElement>) => {
  const video = e.currentTarget;
  const err = video?.error;

  console.error("🎬 Video error triggered at:", videoUrl);

  if (!err) {
    console.error("⚠️ No error object found on video element.");
    setError("Unknown video error. Try refreshing.");
    return;
  }

  let message = "";

  switch (err.code) {
    case 1:
      message = "MEDIA_ERR_ABORTED: The video was aborted.";
      break;
    case 2:
      message = "MEDIA_ERR_NETWORK: A network error occurred.";
      break;
    case 3:
      message = "MEDIA_ERR_DECODE: Failed to decode the video.";
      break;
    case 4:
      message = "MEDIA_ERR_SRC_NOT_SUPPORTED: Video source is unsupported or unreachable.";
      break;
    default:
      message = "An unknown video error occurred.";
      break;
  }

  console.error("🧨 VIDEO ERROR CODE:", err.code, "-", message);
  setError(message);
  setIsLoading(false);
}


  // Handle video can play
  const handleCanPlay = () => {
    console.log("Video can play event triggered for URL:", videoUrl)
    setIsLoading(false)
  }

  // Initial setup
  useEffect(() => {
    console.log("Initial setup for channel:", channel.id)
    console.log("Initial program:", initialProgram)
    console.log("Initial program URL:", initialProgram?.mp4_url)

    // Set up video player
    if (initialProgram && initialProgram.mp4_url) {
      console.log("Loading initial program:", initialProgram.title)
      loadVideo(initialProgram.mp4_url)
    } else {
      console.log("No initial program or no mp4_url, checking for current program")
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

  // Log whenever videoUrl changes
  useEffect(() => {
    console.log("Video URL state changed to:", videoUrl)
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
              onClick={() => currentProgram && loadVideo(currentProgram.mp4_url)}
              className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 transition-colors"
            >
              Try Again
            </button>
          </div>
        </div>
      )}

      {/* Video container */}
      <div ref={videoContainerRef} className="w-full aspect-video bg-black">
        {videoUrl ? (
          <video
            key={videoUrl} // This forces a complete remount when the URL changes
            className="w-full h-full"
            controls
            playsInline
            autoPlay // Add autoPlay to start playing automatically
            onCanPlay={handleCanPlay}
            onEnded={handleVideoEnd}
            onError={handleVideoError}
            onLoadStart={() => console.log("Video load started for URL:", videoUrl)}
            onLoadedData={() => console.log("Video data loaded for URL:", videoUrl)}
          >
            <source src={videoUrl} type="video/mp4" />
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

      {/* Debug info */}
      <div className="bg-black p-2 text-xs text-gray-500">
        <p>Channel ID: {channel.id}</p>
        <p>Current Program: {currentProgram?.title || "None"}</p>
        <p>Program URL: {currentProgram?.mp4_url || "None"}</p>
        <p>Video URL: {videoUrl || "None"}</p>
        <p>Loading: {isLoading ? "Yes" : "No"}</p>
        <p>Error: {error || "None"}</p>
      </div>
    </div>
  )
}
