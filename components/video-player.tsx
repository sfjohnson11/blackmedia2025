"use client"

import type React from "react"
import { useState, useEffect, useRef } from "react"
import { getCurrentProgram, getUpcomingPrograms, calculateProgramProgress } from "@/lib/supabase"
import type { Channel, Program } from "@/types"
import { Clock, Calendar, RefreshCw, Info, Play } from "lucide-react"
import { cleanChannelName } from "@/lib/utils"
import { Button } from "@/components/ui/button"

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
  const [showStandby, setShowStandby] = useState(true) // Start with standby visible
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
  const maxAttempts = 3 // Reduce number of attempts to avoid excessive retries

  const cleanedName = cleanChannelName(channel.name)

  // Standby video URL - using a reliable source
  const standbyVideoUrl =
    "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/standby_blacktruthtv-D7yZUERL2zhjE71Llxul69gbPLxGES.mp4"

  // Function to get video URL - try different formats
  const getVideoUrl = (mp4Url: string) => {
    // If we've already tried this URL format, try a different one
    const fileName = mp4Url.split("/").pop() || mp4Url

    // Generate URL formats based on attempt number - simplified to most likely formats
    const urlFormats = [
      // Format 1: Direct from mp4_url if it's a full URL
      mp4Url.startsWith("http") ? mp4Url : null,

      // Format 2: channel{id}/{filename}
      `https://msllqpnxwbugvkpnquwx.supabase.co/storage/v1/object/public/channel${channel.id}/${fileName}`,

      // Format 3: videos/channel{id}/{filename}
      `https://msllqpnxwbugvkpnquwx.supabase.co/storage/v1/object/public/videos/channel${channel.id}/${fileName}`,
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
    if (currentProgram && videoRef.current && loadAttemptRef.current < maxAttempts) {
      console.log(`Automatically trying next URL format (attempt ${loadAttemptRef.current})`)
      const nextUrl = getVideoUrl(currentProgram.mp4_url)
      videoRef.current.src = nextUrl
      videoRef.current.load()
    } else {
      // If no program or we've tried all formats, show standby
      console.log("All URL formats failed or no program, showing standby")
      setShowStandby(true)

      // Make sure standby video is playing
      if (standbyVideoRef.current) {
        standbyVideoRef.current.play().catch((e) => {
          console.error("Failed to play standby video:", e)
        })
      }
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
      setShowStandby(true)
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
        {/* Standby content */}
        <div className="absolute inset-0 bg-gradient-to-b from-gray-900 to-black flex flex-col items-center justify-center">
          <div className="text-center max-w-2xl px-4">
            <h2 className="text-3xl font-bold mb-4">
              Channel {channel.id}: {cleanedName}
            </h2>

            <div className="bg-black/40 p-6 rounded-lg mb-8">
              <div className="flex items-center justify-center mb-4">
                <div className="w-16 h-16 rounded-full bg-red-600 flex items-center justify-center">
                  <Play className="h-8 w-8 text-white" />
                </div>
              </div>

              <p className="text-xl mb-4">Content for this channel is currently unavailable.</p>

              <p className="text-gray-400 mb-6">
                We're working on adding videos for this channel. Please check back later or try another channel.
              </p>

              {currentProgram && (
                <div className="mb-6">
                  <h3 className="font-semibold mb-2">Scheduled Program:</h3>
                  <p className="text-white">{currentProgram.title}</p>
                  <p className="text-sm text-gray-400">
                    {new Date(currentProgram.start_time).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                      hour12: true,
                    })}
                  </p>
                </div>
              )}

              <div className="flex justify-center space-x-4">
                <Button onClick={retryPlayback} disabled={isRetrying} className="bg-red-600 hover:bg-red-700">
                  {isRetrying ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      Retrying...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Retry Playback
                    </>
                  )}
                </Button>

                <Button onClick={() => (window.location.href = "/channels")} variant="outline">
                  Browse Channels
                </Button>
              </div>
            </div>

            {upcomingPrograms.length > 0 && (
              <div className="mt-4">
                <h3 className="text-xl font-semibold mb-4">Coming Up Next:</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {upcomingPrograms.slice(0, 4).map((program, index) => (
                    <div key={index} className="bg-gray-800/50 p-3 rounded-lg">
                      <p className="font-medium">{program.title}</p>
                      <p className="text-sm text-gray-400">
                        {new Date(program.start_time).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                          hour12: true,
                        })}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Debug info button */}
        {showDebugInfo && (
          <div className="absolute bottom-4 left-4 right-4 bg-black/80 p-4 rounded-lg z-10 text-xs">
            <h4 className="font-bold mb-2">Debug Information:</h4>
            {errorDetails && (
              <div className="mb-2">
                <span className="text-red-400">Error: </span>
                <span>{errorDetails}</span>
              </div>
            )}

            <div className="mb-2">
              <span className="text-blue-400">Channel ID: </span>
              <span>{channel.id}</span>
            </div>

            {currentProgram && (
              <div className="mb-2">
                <span className="text-blue-400">Program: </span>
                <span>
                  {currentProgram.title} (ID: {currentProgram.id})
                </span>
              </div>
            )}

            {attemptedUrls.length > 0 && (
              <div>
                <span className="text-blue-400">Attempted URLs:</span>
                <ul className="ml-4 mt-1">
                  {attemptedUrls.map((url, index) => (
                    <li key={index} className="truncate">
                      {index + 1}. {url}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Channel name overlay - always visible */}
      <div className="absolute top-4 left-4 bg-black/70 px-3 py-1 rounded-md z-10">
        <span className="text-sm font-medium">{cleanedName}</span>
      </div>

      {/* Debug toggle button */}
      <button
        onClick={() => setShowDebugInfo(!showDebugInfo)}
        className="absolute top-4 right-4 bg-black/70 p-2 rounded-md z-10 text-gray-400 hover:text-white"
        aria-label="Toggle debug info"
      >
        <Info className="h-4 w-4" />
      </button>

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
