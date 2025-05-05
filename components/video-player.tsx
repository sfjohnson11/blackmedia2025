"use client"

import type React from "react"
import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { Loader2, Play, Pause, Volume2, VolumeX, Maximize, ChevronLeft, AlertTriangle, RefreshCw } from "lucide-react"
import { getCurrentProgram, getUpcomingPrograms } from "@/lib/supabase"
import type { Channel, Program } from "@/types"
import { cleanChannelName } from "@/lib/utils"

interface VideoPlayerProps {
  channel: Channel
  initialProgram: Program | null
  upcomingPrograms: Program[]
}

export function VideoPlayer({ channel, initialProgram, upcomingPrograms: initialUpcoming }: VideoPlayerProps) {
  const router = useRouter()
  const [isPlaying, setIsPlaying] = useState(false)
  const [isMuted, setIsMuted] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [currentProgram, setCurrentProgram] = useState<Program | null>(initialProgram)
  const [upcomingPrograms, setUpcomingPrograms] = useState<Program[]>(initialUpcoming)
  const [videoUrl, setVideoUrl] = useState<string | null>(null)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [showStandby, setShowStandby] = useState(false)
  const [volume, setVolume] = useState(1)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [showControls, setShowControls] = useState(true)
  const [controlsTimeout, setControlsTimeout] = useState<NodeJS.Timeout | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [errorDetails, setErrorDetails] = useState<string | null>(null)
  const [retryCount, setRetryCount] = useState(0)
  const [programCheckInterval, setProgramCheckInterval] = useState<NodeJS.Timeout | null>(null)
  const [lastProgramCheck, setLastProgramCheck] = useState<number>(Date.now())
  const [currentTime, setCurrentTime] = useState<Date>(new Date())
  const [urlsAttempted, setUrlsAttempted] = useState<string[]>([])
  const maxRetries = 5

  const videoRef = useRef<HTMLVideoElement>(null)
  const standbyVideoRef = useRef<HTMLVideoElement>(null)
  const videoContainerRef = useRef<HTMLDivElement>(null)
  const programSwitchInProgressRef = useRef(false)

  const cleanedName = cleanChannelName(channel.name)

  // Standby video URL - reliable fallback
  const standbyVideoUrl = "https://storage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4"

  // Update current time every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date())
    }, 1000)

    return () => clearInterval(timer)
  }, [])

  // Format current time for display
  const formattedTime = currentTime.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })

  // Prevent context menu on video (right-click)
  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault()
    return false
  }

  // Handle mouse movement to show/hide controls
  const handleMouseMove = () => {
    setShowControls(true)

    // Clear any existing timeout
    if (controlsTimeout) {
      clearTimeout(controlsTimeout)
    }

    // Set a new timeout to hide controls after 3 seconds of inactivity
    const timeout = setTimeout(() => {
      if (isPlaying) {
        setShowControls(false)
      }
    }, 3000)

    setControlsTimeout(timeout)
  }

  // Clean up the timeout when component unmounts
  useEffect(() => {
    return () => {
      if (controlsTimeout) {
        clearTimeout(controlsTimeout)
      }
      if (programCheckInterval) {
        clearInterval(programCheckInterval)
      }
    }
  }, [controlsTimeout, programCheckInterval])

  // Toggle play/pause
  const togglePlay = () => {
    if (!videoRef.current) return

    if (videoRef.current.paused) {
      videoRef.current.play().catch((err) => {
        console.error("Error playing video:", err)
        setLoadError(`Error playing video: ${err.message || "Unknown error"}`)
      })
      setIsPlaying(true)
    } else {
      videoRef.current.pause()
      setIsPlaying(false)
    }
  }

  // Toggle mute
  const toggleMute = () => {
    if (!videoRef.current) return

    const newMutedState = !videoRef.current.muted
    videoRef.current.muted = newMutedState
    setIsMuted(newMutedState)
  }

  // Handle volume change
  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!videoRef.current) return

    const newVolume = Number.parseFloat(e.target.value)
    videoRef.current.volume = newVolume
    setVolume(newVolume)

    if (newVolume === 0) {
      videoRef.current.muted = true
      setIsMuted(true)
    } else if (isMuted) {
      videoRef.current.muted = false
      setIsMuted(false)
    }
  }

  // Toggle fullscreen
  const toggleFullscreen = () => {
    if (!videoContainerRef.current) return

    if (!document.fullscreenElement) {
      videoContainerRef.current.requestFullscreen().catch((err) => {
        console.error(`Error attempting to enable fullscreen: ${err.message}`)
      })
    } else {
      document.exitFullscreen()
    }
  }

  // Update fullscreen state when it changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement)
    }

    document.addEventListener("fullscreenchange", handleFullscreenChange)
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange)
    }
  }, [])

  // Handle seeking
  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!videoRef.current) return

    const seekTime = (Number.parseFloat(e.target.value) / 100) * videoRef.current.duration
    videoRef.current.currentTime = seekTime
  }

  // Try fallback video if all else fails
  const tryFallbackVideo = () => {
    if (!videoRef.current) return

    console.log("Using fallback video")

    // Use the standby video as fallback
    videoRef.current.crossOrigin = "anonymous"
    videoRef.current.src = standbyVideoUrl
    videoRef.current.load()
    setVideoUrl(standbyVideoUrl)
    setShowStandby(false)
    setLoadError(`Using fallback video while we try to fix the issue. (Attempt ${retryCount + 1})`)
    setRetryCount((prev) => prev + 1)

    // Add to attempted URLs
    setUrlsAttempted((prev) => [...prev, standbyVideoUrl])

    // Try to play the fallback video
    videoRef.current.play().catch((err) => {
      console.error("Error playing fallback video:", err)

      // If fallback also fails, show standby
      setShowStandby(true)
      if (standbyVideoRef.current) {
        standbyVideoRef.current.play().catch((e) => {
          console.error("Failed to play standby video:", e)
        })
      }
    })
  }

  // Handle video error with improved error reporting
  const handleVideoError = (e: React.SyntheticEvent<HTMLVideoElement, Event>) => {
    const target = e.target as HTMLVideoElement
    let errorMessage = "Unknown error"

    console.log(`Video error for channel ${channel.id}, currentProgram:`, currentProgram)
    console.log("Video source that failed:", target.src)

    if (target.error) {
      switch (target.error.code) {
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
          errorMessage = `Error code: ${target.error.code}`
      }

      if (target.error.message) {
        errorMessage += ` - ${target.error.message}`
      }
    }

    console.error("Error loading video:", errorMessage)
    if (target.src) {
      console.error("Failed URL:", target.src)
    }

    setErrorDetails(errorMessage)
    setLoadError(`Error loading video: ${errorMessage}`)
    setIsLoading(false)

    // Add to attempted URLs
    if (target.src) {
      setUrlsAttempted((prev) => [...prev, target.src])
    }

    // Try alternative URL formats
    tryAlternativeUrlFormats()
  }

  // Properly add cache-busting parameter to URL
  const addCacheBuster = (url: string): string => {
    const cacheBuster = `t=${Date.now()}`

    // Check if URL already has query parameters
    if (url.includes("?")) {
      // Make sure we don't add a second question mark
      return `${url}&${cacheBuster}`
    } else {
      return `${url}?${cacheBuster}`
    }
  }

  // Try alternative URL formats for the video
  const tryAlternativeUrlFormats = async () => {
    if (!currentProgram || !videoRef.current) return

    console.log("Trying alternative URL formats")
    setIsLoading(true)

    try {
      // Extract filename from mp4_url
      const urlParts = currentProgram.mp4_url.split("/")
      const fileName = urlParts[urlParts.length - 1]

      // Get base URL without the filename
      const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ""

      // Try different URL formats
      const urlFormats = [
        // Original URL
        currentProgram.mp4_url,

        // Try with channel ID in path
        `${baseUrl}/storage/v1/object/public/channel${channel.id}/${fileName}`,

        // Try with double slash (common pattern)
        `${baseUrl}/storage/v1/object/public/channel${channel.id}//${fileName}`,

        // Try with "ch" prefix
        `${baseUrl}/storage/v1/object/public/ch${channel.id}/${fileName}`,

        // Try with videos folder
        `${baseUrl}/storage/v1/object/public/videos/channel${channel.id}/${fileName}`,

        // Try with videos folder and channel name
        `${baseUrl}/storage/v1/object/public/videos/${cleanedName}/${fileName}`,

        // Try with just the filename in root bucket
        `${baseUrl}/storage/v1/object/public/${fileName}`,
      ]

      // Filter out URLs we've already tried
      const untried = urlFormats.filter((url) => !urlsAttempted.includes(url))

      if (untried.length === 0) {
        console.log("All URL formats have been tried")
        tryFallbackVideo()
        return
      }

      // Try the next untried URL
      const nextUrl = untried[0]
      console.log(`Trying alternative URL format: ${nextUrl}`)

      // Add to attempted URLs
      setUrlsAttempted((prev) => [...prev, nextUrl])

      // Add cache buster to URL
      const urlWithCacheBuster = addCacheBuster(nextUrl)

      // Try the URL
      videoRef.current.src = urlWithCacheBuster
      videoRef.current.load()
      setVideoUrl(urlWithCacheBuster)

      // Try to play
      try {
        await videoRef.current.play()
        setIsPlaying(true)
        setIsLoading(false)
      } catch (err) {
        console.error("Error playing with alternative URL:", err)
        setRetryCount((prev) => prev + 1)

        // Try next format
        if (retryCount < maxRetries) {
          tryAlternativeUrlFormats()
        } else {
          tryFallbackVideo()
        }
      }
    } catch (err) {
      console.error("Error trying alternative URL formats:", err)
      setIsLoading(false)
      tryFallbackVideo()
    }
  }

  // Function to retry playing the current video
  const retryPlayback = async () => {
    if (!currentProgram || !videoRef.current) return

    setIsLoading(true)
    setLoadError(null)
    setErrorDetails(null)
    setRetryCount(0)
    setUrlsAttempted([])

    try {
      // Try the direct mp4_url first
      if (currentProgram.mp4_url) {
        console.log(`Trying direct mp4_url: ${currentProgram.mp4_url}`)

        // Add cache buster to URL
        const urlWithCacheBuster = addCacheBuster(currentProgram.mp4_url)

        // Add to attempted URLs
        setUrlsAttempted((prev) => [...prev, urlWithCacheBuster])

        videoRef.current.src = urlWithCacheBuster
        videoRef.current.load()
        setVideoUrl(urlWithCacheBuster)

        try {
          await videoRef.current.play()
          setIsPlaying(true)
          setIsLoading(false)
          return
        } catch (err) {
          console.error("Error playing with direct URL:", err)
          // Continue to try alternative formats
        }
      }

      // If direct URL didn't work, try alternative formats
      tryAlternativeUrlFormats()
    } catch (err) {
      console.error("Error in retry:", err)
      setLoadError(`Retry failed: ${err instanceof Error ? err.message : String(err)}`)
      setIsLoading(false)
      tryAlternativeUrlFormats()
    }
  }

  // Check for program updates
  const checkForProgramUpdates = async () => {
    // Don't check if we're already in the process of switching programs
    if (programSwitchInProgressRef.current) {
      return
    }

    const now = Date.now()
    const timeSinceLastCheck = now - lastProgramCheck

    // Only check every 30 seconds to avoid too many API calls
    if (timeSinceLastCheck < 30000) {
      return
    }

    setLastProgramCheck(now)
    console.log("Checking for program updates...")

    try {
      // Set flag to prevent multiple simultaneous program switches
      programSwitchInProgressRef.current = true

      const { program } = await getCurrentProgram(channel.id)
      const { programs } = await getUpcomingPrograms(channel.id)

      // If we have a new program, switch to it
      if (program && (!currentProgram || program.id !== currentProgram.id)) {
        console.log(`New program detected: ${program.title} (ID: ${program.id})`)
        console.log(`Previous program: ${currentProgram?.title || "None"} (ID: ${currentProgram?.id || "None"})`)

        // Reset URL attempts for the new program
        setUrlsAttempted([])
        setRetryCount(0)

        // Switch to the new program
        await loadProgram(program)
        setUpcomingPrograms(programs)
      } else {
        // Just update the upcoming programs list
        setUpcomingPrograms(programs)
      }
    } catch (err) {
      console.error("Error checking for program updates:", err)
    } finally {
      // Clear the flag
      programSwitchInProgressRef.current = false
    }
  }

  // Load a specific program
  const loadProgram = async (program: Program) => {
    console.log(`Loading program: ${program.title} (ID: ${program.id})`)

    setIsLoading(true)
    setCurrentProgram(program)
    setRetryCount(0)
    setLoadError(null)
    setErrorDetails(null)
    setUrlsAttempted([])

    if (!videoRef.current) {
      setIsLoading(false)
      return
    }

    try {
      // Try the direct mp4_url first
      if (program.mp4_url) {
        console.log(`Trying direct mp4_url: ${program.mp4_url}`)

        // Add cache buster to URL
        const urlWithCacheBuster = addCacheBuster(program.mp4_url)

        // Add to attempted URLs
        setUrlsAttempted((prev) => [...prev, urlWithCacheBuster])

        videoRef.current.src = urlWithCacheBuster
        videoRef.current.load()
        setVideoUrl(urlWithCacheBuster)

        try {
          await videoRef.current.play()
          setIsPlaying(true)
          setIsLoading(false)
          return
        } catch (err) {
          console.error("Error playing with direct URL:", err)
          // Continue to try alternative formats
        }
      }

      // If direct URL didn't work, try alternative formats
      tryAlternativeUrlFormats()
    } catch (err) {
      console.error("Error loading program:", err)
      setLoadError(`Error loading video: ${err instanceof Error ? err.message : String(err)}`)
      setIsLoading(false)
      tryAlternativeUrlFormats()
    }
  }

  // Refresh current program
  const refreshCurrentProgram = async () => {
    // Don't refresh if we're already in the process of switching programs
    if (programSwitchInProgressRef.current) {
      return
    }

    setIsLoading(true)
    setError(null)
    setRetryCount(0)
    setUrlsAttempted([])

    try {
      // Set flag to prevent multiple simultaneous program switches
      programSwitchInProgressRef.current = true

      const { program } = await getCurrentProgram(channel.id)
      const { programs } = await getUpcomingPrograms(channel.id)

      // Update upcoming programs list
      setUpcomingPrograms(programs)

      // If no program exists, show standby
      if (!program) {
        console.log(`No program found for channel ${channel.id}, showing standby video`)
        setShowStandby(true)
        if (standbyVideoRef.current) {
          standbyVideoRef.current.play().catch((e) => {
            console.error("Failed to play standby video:", e)
          })
        }
        setIsLoading(false)
        return
      }

      // If we have a new program, load it
      if (!currentProgram || program.id !== currentProgram.id) {
        console.log(`New program detected during refresh: ${program.title} (ID: ${program.id})`)

        // Reset URL attempts for the new program
        setUrlsAttempted([])
        setRetryCount(0)

        await loadProgram(program)
      } else {
        // Just refresh the current program
        await loadProgram(program)
      }
    } catch (e) {
      console.error(`Error refreshing program for channel ${channel.id}:`, e)
      setError(`Failed to refresh program: ${e}`)
      setIsLoading(false)
    } finally {
      // Clear the flag
      programSwitchInProgressRef.current = false
    }
  }

  const handleVideoStarted = () => {
    console.log("Video started playback")
    setIsPlaying(true)
  }

  const handleVideoPaused = () => {
    setIsPlaying(false)
    setShowControls(true) // Always show controls when paused
  }

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      const currentTime = videoRef.current.currentTime
      const duration = videoRef.current.duration

      // Update progress percentage for the progress bar
      if (duration) {
        const newProgress = (currentTime / duration) * 100
        setProgress(newProgress)
      }
    }
  }

  // Handle video end event - automatically switch to next program
  const handleVideoEnded = async () => {
    console.log("Video ended, checking for next program")

    // Check for a new program
    try {
      // Set flag to prevent multiple simultaneous program switches
      programSwitchInProgressRef.current = true

      const { program } = await getCurrentProgram(channel.id)
      const { programs } = await getUpcomingPrograms(channel.id)

      // Update upcoming programs list
      setUpcomingPrograms(programs)

      // If we have a new program, load it
      if (program && (!currentProgram || program.id !== currentProgram.id)) {
        console.log(`Loading next program: ${program.title} (ID: ${program.id})`)

        // Reset URL attempts for the new program
        setUrlsAttempted([])
        setRetryCount(0)

        await loadProgram(program)
      } else if (programs.length > 0) {
        // If no new current program but we have upcoming programs, load the first one
        console.log(`Loading first upcoming program: ${programs[0].title} (ID: ${programs[0].id})`)

        // Reset URL attempts for the new program
        setUrlsAttempted([])
        setRetryCount(0)

        await loadProgram(programs[0])
      } else {
        // No new programs available, refresh to check again
        console.log("No next program available, refreshing...")
        refreshCurrentProgram()
      }
    } catch (err) {
      console.error("Error handling video end:", err)
      setLoadError(`Error loading next program: ${err instanceof Error ? err.message : String(err)}`)
      refreshCurrentProgram()
    } finally {
      // Clear the flag
      programSwitchInProgressRef.current = false
    }
  }

  // Format time for display (MM:SS)
  const formatTime = (timeInSeconds: number): string => {
    const minutes = Math.floor(timeInSeconds / 60)
    const seconds = Math.floor(timeInSeconds % 60)
    return `${minutes}:${seconds < 10 ? "0" : ""}${seconds}`
  }

  const handleBack = () => {
    router.back()
  }

  // Initial setup
  useEffect(() => {
    console.log("Initial setup for channel:", channel.id)
    console.log("Initial program:", initialProgram)

    // If we have an initial program, try to load it
    if (initialProgram) {
      loadProgram(initialProgram)
    } else {
      // No initial program, refreshing to get one
      console.log("No initial program, refreshing...")
      refreshCurrentProgram()
    }

    // Set up standby video
    if (standbyVideoRef.current) {
      standbyVideoRef.current.src = standbyVideoUrl
      standbyVideoRef.current.load()
    }

    // Set up program check interval - check every minute
    const checkInterval = setInterval(() => {
      checkForProgramUpdates()
    }, 60000) // 1 minute

    setProgramCheckInterval(checkInterval)

    return () => {
      if (checkInterval) {
        clearInterval(checkInterval)
      }
    }
  }, [channel.id, initialProgram])

  // Render
  return (
    <div className="relative bg-black" ref={videoContainerRef}>
      {/* Video container */}
      <div className="relative w-full aspect-video">
        {/* Back button */}
        <button
          onClick={handleBack}
          className="absolute top-4 left-4 z-10 bg-black/50 p-2 rounded-full hover:bg-black/70 transition-colors"
        >
          <ChevronLeft className="h-6 w-6" />
        </button>

        {/* Loading state */}
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black">
            <div className="flex flex-col items-center">
              <Loader2 className="h-12 w-12 text-red-600 animate-spin mb-2" />
              <p className="text-white">Loading video...</p>
            </div>
          </div>
        )}

        {/* Error state */}
        {error && (
          <div className="absolute inset-0 flex items-center justify-center bg-black">
            <div className="text-center p-4">
              <p className="text-red-500 mb-4">{error}</p>
              <button
                onClick={() => {
                  setError(null)
                  refreshCurrentProgram()
                }}
                className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 transition-colors"
              >
                Try Again
              </button>
            </div>
          </div>
        )}

        {/* Video element */}
        <div className="relative w-full aspect-video bg-black" onMouseMove={handleMouseMove} onClick={togglePlay}>
          <video
            ref={videoRef}
            className="w-full h-full"
            autoPlay
            playsInline
            crossOrigin="anonymous"
            onContextMenu={handleContextMenu}
            onLoadStart={() => setIsLoading(true)}
            onCanPlay={() => {
              console.log("Video can play now")
              setIsLoading(false)
              setLoadError(null)
            }}
            onError={handleVideoError}
            onTimeUpdate={handleTimeUpdate}
            onPlay={handleVideoStarted}
            onPause={handleVideoPaused}
            onEnded={handleVideoEnded}
          >
            {videoUrl && <source src={videoUrl} type="video/mp4" />}
            Your browser does not support the video tag.
          </video>

          {/* Standby video (hidden until needed) */}
          <video
            ref={standbyVideoRef}
            className={`w-full h-full absolute inset-0 ${showStandby ? "block" : "hidden"}`}
            autoPlay
            loop
            muted
            playsInline
          >
            <source src={standbyVideoUrl} type="video/mp4" />
          </video>

          {loadError && !isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-70">
              <div className="bg-gray-900 p-4 rounded-lg max-w-md text-center">
                <AlertTriangle className="h-8 w-8 text-yellow-500 mx-auto mb-2" />
                <p className="text-white mb-4">{loadError}</p>
                {errorDetails && (
                  <p className="text-gray-400 text-sm mb-4 max-w-xs mx-auto overflow-auto">Details: {errorDetails}</p>
                )}
                <div className="flex flex-wrap justify-center gap-3">
                  <button
                    className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded flex items-center"
                    onClick={retryPlayback}
                  >
                    <RefreshCw className="h-4 w-4 mr-2" /> Try Again
                  </button>
                  <button
                    className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded"
                    onClick={tryFallbackVideo}
                  >
                    Try Fallback Video
                  </button>
                  <button
                    className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded"
                    onClick={refreshCurrentProgram}
                  >
                    Refresh Program
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Video controls overlay */}
        <div
          className={`absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4 transition-opacity duration-300 ${
            showControls ? "opacity-100" : "opacity-0"
          }`}
          style={{ zIndex: 10 }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Progress bar */}
          {videoRef.current && videoRef.current.duration && (
            <div className="mb-4">
              <input
                type="range"
                min="0"
                max="100"
                value={progress}
                onChange={handleSeek}
                className="w-full h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer"
                style={{
                  background: `linear-gradient(to right, #ef4444 0%, #ef4444 ${progress}%, #4b5563 ${progress}%, #4b5563 100%)`,
                }}
              />
              <div className="flex justify-between text-xs text-gray-300 mt-1">
                <span>{formatTime(videoRef.current.currentTime || 0)}</span>
                <span>{formatTime(videoRef.current.duration || 0)}</span>
              </div>
            </div>
          )}

          {/* Control buttons */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button
                onClick={togglePlay}
                className="hover:text-red-500 transition-colors bg-black/30 p-2 rounded-full"
              >
                {isPlaying ? <Pause className="h-6 w-6" /> : <Play className="h-6 w-6" />}
              </button>
              <button
                onClick={toggleMute}
                className="hover:text-red-500 transition-colors bg-black/30 p-2 rounded-full"
              >
                {isMuted ? <VolumeX className="h-6 w-6" /> : <Volume2 className="h-6 w-6" />}
              </button>

              {/* Volume slider */}
              <div className="hidden md:flex items-center">
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={volume}
                  onChange={handleVolumeChange}
                  className="w-20 h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer"
                />
              </div>
            </div>

            <button
              onClick={toggleFullscreen}
              className="hover:text-red-500 transition-colors bg-black/30 p-2 rounded-full"
            >
              <Maximize className="h-6 w-6" />
            </button>
          </div>
        </div>
      </div>

      {/* Current program info */}
      {currentProgram && (
        <div className="bg-black p-4">
          <h2 className="text-xl font-bold">{currentProgram.title}</h2>
          {upcomingPrograms.length > 0 && (
            <p className="text-gray-400 text-sm mt-1">Next: {upcomingPrograms[0].title}</p>
          )}
        </div>
      )}
    </div>
  )
}
