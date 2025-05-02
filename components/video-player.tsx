"use client"

import type React from "react"
import { useState, useEffect, useRef } from "react"
import { getCurrentProgram, getUpcomingPrograms, calculateProgramProgress } from "@/lib/supabase"
import type { Channel, Program } from "@/types"
import { Clock, Calendar, AlertCircle, RefreshCw } from "lucide-react"

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
  const videoRef = useRef<HTMLVideoElement>(null)
  const standbyVideoRef = useRef<HTMLVideoElement>(null)
  const refreshTimerRef = useRef<NodeJS.Timeout | null>(null)
  const errorTimerRef = useRef<NodeJS.Timeout | null>(null)
  const standbyContainerRef = useRef<HTMLDivElement>(null)
  const mainContainerRef = useRef<HTMLDivElement>(null)

  // Standby video URL - using a reliable source
  const standbyVideoUrl =
    "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/standby_blacktruthtv-D7yZUERL2zhjE71Llxul69gbPLxGES.mp4"

  // Function to get video URL
  const getVideoUrl = (mp4Url: string) => {
    // Try different formats based on what we've seen in your storage
    const fileName = mp4Url.split("/").pop() || mp4Url

    // This is the most likely format based on your setup
    return `https://msllqpnxwbugvkpnquwx.supabase.co/storage/v1/object/public/channel${channel.id}/${fileName}`
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

          // Don't immediately hide standby - let the video load first
          // We'll handle this in the video's onLoadedData event
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

    // Don't immediately show standby - use a timer to prevent flickering
    if (!errorTimerRef.current) {
      errorTimerRef.current = setTimeout(() => {
        setShowStandby(true)
        errorTimerRef.current = null
      }, 2000) // Wait 2 seconds before showing standby
    }
  }

  // Function to retry playing the current video
  const retryPlayback = async () => {
    if (!currentProgram) return

    setIsRetrying(true)
    setErrorDetails(null)

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
          <h3 className="text-lg font-bold mb-1">Standby</h3>
          <p className="text-sm text-gray-300">
            {!currentProgram ? "No program currently scheduled" : "Content temporarily unavailable"}
          </p>

          {error && <p className="text-red-400 text-xs mt-2">{error}</p>}

          {errorDetails && (
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
