"use client"

import type React from "react"
import { useState, useEffect, useRef } from "react"
import { getCurrentProgram, getUpcomingPrograms, calculateProgramProgress } from "@/lib/supabase"
import type { Channel, Program } from "@/types"
import { Clock, Calendar, AlertCircle, RefreshCw, Info } from "lucide-react"

interface VideoPlayerProps {
  channel: Channel
  initialProgram: Program | null
  upcomingPrograms: Program[]
}

export function VideoPlayer({ channel, initialProgram, upcomingPrograms: initialUpcoming }: VideoPlayerProps) {
  const [currentProgram, setCurrentProgram] = useState<Program | null>(initialProgram)
  const [upcomingPrograms, setUpcomingPrograms] = useState<Program[]>(initialUpcoming)
  const [progress, setProgress] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showStandby, setShowStandby] = useState(!initialProgram)
  const [errorDetails, setErrorDetails] = useState<string | null>(null)
  const [isRetrying, setIsRetrying] = useState(false)
  const [attemptedUrls, setAttemptedUrls] = useState<string[]>([])
  const [showDebugInfo, setShowDebugInfo] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)
  const standbyVideoRef = useRef<HTMLVideoElement>(null)
  const refreshTimerRef = useRef<NodeJS.Timeout | null>(null)
  const errorTimerRef = useRef<NodeJS.Timeout | null>(null)
  const standbyContainerRef = useRef<HTMLDivElement>(null)
  const mainContainerRef = useRef<HTMLDivElement>(null)
  const loadAttemptRef = useRef(0)

  // Standby video URL - using a reliable source
  const standbyVideoUrl =
    "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/standby_blacktruthtv-D7yZUERL2zhjE71Llxul69gbPLxGES.mp4"

  // Function to get video URL - try different formats
  const getVideoUrl = (mp4Url: string) => {
    // If we've already tried this URL format, try a different one
    const fileName = mp4Url.split("/").pop() || mp4Url

    // Generate URL formats based on attempt number
    const urlFormats = [
      // Format 1: Direct from mp4_url if it's a full URL
      mp4Url.startsWith("http") ? mp4Url : null,

      // Format 2: channel{id}/{filename}
      `https://msllqpnxwbugvkpnquwx.supabase.co/storage/v1/object/public/channel${channel.id}/${fileName}`,

      // Format 3: channel{id}/{original_path}
      `https://msllqpnxwbugvkpnquwx.supabase.co/storage/v1/object/public/channel${channel.id}/${mp4Url}`,

      // Format 4: videos/channel{id}/{filename}
      `https://msllqpnxwbugvkpnquwx.supabase.co/storage/v1/object/public/videos/channel${channel.id}/${fileName}`,

      // Format 5: videos/{filename}
      `https://msllqpnxwbugvkpnquwx.supabase.co/storage/v1/object/public/videos/${fileName}`,

      // Format 6: Add .mp4 if missing
      `https://msllqpnxwbugvkpnquwx.supabase.co/storage/v1/object/public/channel${channel.id}/${fileName}${
        fileName.includes(".") ? "" : ".mp4"
      }`,
    ].filter(Boolean) as string[]

    // Use the current attempt to select a URL format
    const attemptIndex = loadAttemptRef.current % urlFormats.length
    const url = urlFormats[attemptIndex]

    // Log which format we're trying
    console.log(`Trying URL format ${attemptIndex + 1}/${urlFormats.length}: ${url}`)

    // Add to attempted URLs for debugging
    if (!attemptedUrls.includes(url)) {
      setAttemptedUrls((prev) => [...prev, url])
    }

    return url
  }

  // Function to refresh the current program
  const refreshCurrentProgram = async () => {
    try {
      setIsLoading(true)
      const { program, isNext, error } = await getCurrentProgram(channel.id)

      if (error) {
        throw error
      }

      if (program) {
        // Only update if the program has changed to avoid unnecessary re-renders
        if (!currentProgram || program.id !== currentProgram.id) {
          setCurrentProgram(program)
          // Reset attempted URLs and load attempt counter
          setAttemptedUrls([])
          loadAttemptRef.current = 0
        }

        // Calculate progress if it's a current program
        if (!isNext) {
          const { progressPercent } = calculateProgramProgress(program)
          setProgress(progressPercent)
        } else {
          setProgress(0)
        }
      } else {
        setCurrentProgram(null)
        setShowStandby(true)
        setProgress(0)
      }

      // Also refresh upcoming programs
      const { programs } = await getUpcomingPrograms(channel.id)
      setUpcomingPrograms(programs)

      setError(null)
    } catch (err) {
      console.error("Error refreshing program:", err)
      setError("Failed to load program")
    } finally {
      setIsLoading(false)
    }
  }

  // Handle video loaded successfully
  const handleVideoLoaded = () => {
    console.log("Main video loaded successfully")

    // Clear any error timers
    if (errorTimerRef.current) {
      clearTimeout(errorTimerRef.current)
      errorTimerRef.current = null
    }

    // Hide standby with a slight delay to ensure smooth transition
    setTimeout(() => {
      setShowStandby(false)
      setErrorDetails(null)
    }, 500)
  }

  // Handle video error with improved error reporting
  const handleVideoError = (e: React.SyntheticEvent<HTMLVideoElement, Event>) => {
    // Extract detailed error information
    const target = e.target as HTMLVideoElement
    let errorMessage = "Unknown error"

    if (target.error) {
      // Get the MediaError details
      switch (target.error.code) {
        case 1:
          errorMessage = "The fetching process was aborted by the user"
          break
        case 2:
          errorMessage = "Network error - video download failed"
          break
        case 3:
          errorMessage = "Video decoding failed - format may be unsupported"
          break
        case 4:
          errorMessage = "Video not found (404) or access denied"
          break
        default:
          errorMessage = `Error code: ${target.error.code}`
      }

      if (target.error.message) {
        errorMessage += ` - ${target.error.message}`
      }
    }

    // Log the detailed error
    console.error("Error loading video:", errorMessage)
    console.error("Failed URL:", target.src)

    // Store error details for display
    setErrorDetails(errorMessage)

    // Try the next URL format automatically
    loadAttemptRef.current += 1

    // If we have a current program, try the next URL format
    if (currentProgram && videoRef.current) {
      console.log(`Automatically trying next URL format (attempt ${loadAttemptRef.current})`)
      const nextUrl = getVideoUrl(currentProgram.mp4_url)
      videoRef.current.src = nextUrl
      videoRef.current.load()

      // Only show standby after we've tried all formats
      if (loadAttemptRef.current >= 6) {
        console.log("All URL formats failed, showing standby")
        setShowStandby(true)
      }
    } else {
      // If no program, show standby
      setShowStandby(true)
    }
  }

  // Function to retry playing the current video
  const retryPlayback = async () => {
    if (!currentProgram) return

    setIsRetrying(true)
    setErrorDetails(null)
    // Reset the load attempt counter to try all formats again
    loadAttemptRef.current = 0
    setAttemptedUrls([])

    try {
      // Try to load the video again
      if (videoRef.current) {
        // Get a fresh URL with a cache-busting parameter
        const freshUrl = `${getVideoUrl(currentProgram.mp4_url)}?t=${Date.now()}`
        videoRef.current.src = freshUrl
        videoRef.current.load()

        // The onLoadedData event will handle hiding the standby if successful
      }
    } catch (err) {
      console.error("Error in retry:", err)
      setErrorDetails(`Retry failed: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setIsRetrying(false)
    }
  }

  // Effect to handle initial setup and periodic refresh
  useEffect(() => {
    // Initial refresh if no program provided
    if (!currentProgram) {
      refreshCurrentProgram()
    } else {
      // If we have an initial program, try to load it
      if (videoRef.current) {
        // Reset counters
        loadAttemptRef.current = 0
        setAttemptedUrls([])

        // Set the video source
        videoRef.current.src = getVideoUrl(currentProgram.mp4_url)
        videoRef.current.load()
      }
    }

    // Set up periodic refresh (every minute)
    refreshTimerRef.current = setInterval(() => {
      refreshCurrentProgram()
    }, 60000)

    return () => {
      if (refreshTimerRef.current) {
        clearInterval(refreshTimerRef.current)
      }
      if (errorTimerRef.current) {
        clearTimeout(errorTimerRef.current)
      }
    }
  }, [channel.id])

  // Effect to update progress for current program
  useEffect(() => {
    if (!currentProgram) return

    const progressTimer = setInterval(() => {
      const { progressPercent, isFinished } = calculateProgramProgress(currentProgram)

      if (isFinished) {
        // Time to refresh and get the next program
        refreshCurrentProgram()
      } else {
        setProgress(progressPercent)
      }
    }, 1000)

    return () => clearInterval(progressTimer)
  }, [currentProgram])

  // Effect to handle video playback when program changes
  useEffect(() => {
    if (videoRef.current && currentProgram) {
      // Reset counters
      loadAttemptRef.current = 0
      setAttemptedUrls([])

      // Set the video source
      videoRef.current.src = getVideoUrl(currentProgram.mp4_url)
      videoRef.current.load()

      // Play will be handled by the onLoadedData event
    }
  }, [currentProgram])

  // Render both videos but control visibility with CSS
  return (
    <div className="w-full aspect-video bg-black relative">
      {/* Main video container - always rendered but may be hidden */}
      <div
        ref={mainContainerRef}
        className={`absolute inset-0 transition-opacity duration-500 ${showStandby ? "opacity-0" : "opacity-100"}`}
        style={{ zIndex: showStandby ? 1 : 2 }}
      >
        <video
          ref={videoRef}
          className="w-full h-full"
          controls
          autoPlay
          onError={handleVideoError}
          onLoadedData={handleVideoLoaded}
          playsInline
        />
      </div>

      {/* Standby video container - always rendered but may be hidden */}
      <div
        ref={standbyContainerRef}
        className={`absolute inset-0 transition-opacity duration-500 ${showStandby ? "opacity-100" : "opacity-0"}`}
        style={{ zIndex: showStandby ? 2 : 1 }}
      >
        <video
          ref={standbyVideoRef}
          src={standbyVideoUrl}
          className="w-full h-full"
          controls
          autoPlay
          loop
          playsInline
        />

        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold mb-1">
              Channel {channel.id}: {channel.name}
            </h3>
            <button
              onClick={() => setShowDebugInfo(!showDebugInfo)}
              className="text-gray-400 hover:text-white"
              aria-label="Toggle debug info"
            >
              <Info className="h-4 w-4" />
            </button>
          </div>

          <div className="bg-gray-800/50 p-3 rounded-md mb-3">
            <p className="text-sm text-gray-300">
              {!currentProgram
                ? "No program currently scheduled for this channel."
                : "Content temporarily unavailable. We're working on adding videos for this channel."}
            </p>
            <p className="text-xs text-gray-400 mt-1">Please check back later or try another channel.</p>
          </div>

          {error && <p className="text-red-400 text-xs mt-2">{error}</p>}

          {showDebugInfo && errorDetails && (
            <div className="mt-2 p-2 bg-red-900/30 rounded-md flex items-start">
              <AlertCircle className="h-4 w-4 text-red-400 mr-2 mt-0.5 flex-shrink-0" />
              <p className="text-red-400 text-xs">{errorDetails}</p>
            </div>
          )}

          {isLoading && <p className="text-blue-400 text-xs mt-2">Loading program schedule...</p>}

          {currentProgram && (
            <button
              onClick={retryPlayback}
              disabled={isRetrying}
              className="mt-3 px-3 py-1.5 bg-red-600/80 hover:bg-red-700 rounded-md text-sm flex items-center"
            >
              {isRetrying ? (
                <>
                  <RefreshCw className="h-3 w-3 mr-2 animate-spin" />
                  Trying alternative sources...
                </>
              ) : (
                <>
                  <RefreshCw className="h-3 w-3 mr-2" />
                  Retry Playback
                </>
              )}
            </button>
          )}

          {showDebugInfo && attemptedUrls.length > 0 && (
            <div className="mt-3 p-2 bg-gray-800/50 rounded-md">
              <p className="text-xs text-gray-400 mb-1">Attempted URLs:</p>
              <div className="text-xs text-gray-500 max-h-20 overflow-y-auto">
                {attemptedUrls.map((url, index) => (
                  <div key={index} className="truncate text-xs">
                    {index + 1}. {url}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Channel name overlay - always visible */}
      <div className="absolute top-4 left-4 bg-black/70 px-3 py-1 rounded-md z-10">
        <span className="text-sm font-medium">{channel.name}</span>
      </div>

      {/* Program info overlay - only visible when showing main video */}
      {currentProgram && !showStandby && (
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4 z-10 pointer-events-none">
          <h3 className="text-lg font-bold mb-1">{currentProgram.title}</h3>
          <div className="flex items-center text-sm text-gray-300 mb-2">
            <Clock className="h-3 w-3 mr-1" />
            <span>
              {new Date(currentProgram.start_time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </span>
          </div>

          <div className="w-full bg-gray-700 rounded-full h-1 mb-4">
            <div className="bg-red-600 h-1 rounded-full" style={{ width: `${progress}%` }}></div>
          </div>

          {upcomingPrograms.length > 0 && (
            <div className="hidden md:block">
              <h4 className="text-sm font-semibold mb-2 flex items-center">
                <Calendar className="h-3 w-3 mr-1" />
                Coming Up Next
              </h4>
              <div className="flex space-x-4 overflow-x-auto pb-2">
                {upcomingPrograms.slice(0, 3).map((program, index) => (
                  <div key={index} className="min-w-[200px] bg-black/50 p-2 rounded">
                    <p className="font-medium text-sm">{program.title}</p>
                    <p className="text-xs text-gray-400">
                      {new Date(program.start_time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
