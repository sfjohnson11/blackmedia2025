"use client"

import type React from "react"
import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { Loader2, Play, Pause, Volume2, VolumeX, Maximize, ChevronLeft, AlertTriangle, RefreshCw } from "lucide-react"
import {
  getDirectDownloadUrl,
  saveWatchProgress,
  getWatchProgress,
  getCurrentProgram,
  getUpcomingPrograms,
} from "@/lib/supabase"
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
  const maxRetries = 3

  const videoRef = useRef<HTMLVideoElement>(null)
  const standbyVideoRef = useRef<HTMLVideoElement>(null)
  const videoContainerRef = useRef<HTMLDivElement>(null)

  const cleanedName = cleanChannelName(channel.name)

  // Standby video URL
  const standbyVideoUrl =
    "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/standby_blacktruthtv-D7yZUERL2zhjE71Llxul69gbPLxGES.mp4"

  // Fallback video URLs - MP4 only
  const fallbackVideoUrls = [
    "https://storage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
    "https://storage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4",
    "https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
  ]

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

  // Try fallback videos if all else fails
  const tryFallbackVideo = () => {
    if (!videoRef.current) return

    console.log("Using fallback video")
    const fallbackIndex = retryCount % fallbackVideoUrls.length
    const fallbackUrl = fallbackVideoUrls[fallbackIndex]

    console.log(`Using fallback video #${fallbackIndex + 1}: ${fallbackUrl}`)

    videoRef.current.src = fallbackUrl
    videoRef.current.load()
    setVideoUrl(fallbackUrl)
    setShowStandby(false)
    setLoadError(`Using fallback video while we try to fix the issue. (Attempt ${retryCount + 1})`)
    setRetryCount((prev) => prev + 1)
  }

  // Handle video error with improved error reporting
  const handleVideoError = (e: React.SyntheticEvent<HTMLVideoElement, Event>) => {
    const target = e.target as HTMLVideoElement
    let errorMessage = "Unknown error"

    console.log(`Video error for channel ${channel.id}, currentProgram:`, currentProgram)

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

    // If we've tried a few times with the original video, use a fallback
    if (retryCount >= maxRetries) {
      tryFallbackVideo()
    } else {
      setRetryCount((prev) => prev + 1)
    }
  }

  // Function to retry playing the current video
  const retryPlayback = async () => {
    if (!currentProgram || !videoRef.current) return

    setIsLoading(true)
    setLoadError(null)
    setErrorDetails(null)

    try {
      // Try to get a direct download URL
      const url = await getDirectDownloadUrl(currentProgram.mp4_url, channel.id)

      if (url) {
        console.log(`Retrying with direct URL: ${url}`)

        // Add cache-busting parameter
        const cacheBustedUrl = `${url}?t=${Date.now()}`

        videoRef.current.src = cacheBustedUrl
        videoRef.current.load()
        setVideoUrl(cacheBustedUrl)
        setShowStandby(false)
      } else {
        console.error("Could not find a working URL")
        setLoadError("Could not find a working URL for this video")

        // Try the raw mp4_url as a fallback
        if (currentProgram.mp4_url) {
          console.log(`Trying raw mp4_url: ${currentProgram.mp4_url}`)
          videoRef.current.src = currentProgram.mp4_url
          videoRef.current.load()
          setVideoUrl(currentProgram.mp4_url)
        } else {
          setShowStandby(true)
          if (standbyVideoRef.current) {
            standbyVideoRef.current.play().catch((e) => {
              console.error("Failed to play standby video:", e)
            })
          }
        }
      }
    } catch (err) {
      console.error("Error in retry:", err)
      setLoadError(`Retry failed: ${err instanceof Error ? err.message : String(err)}`)

      // If retry fails, try fallback video
      if (retryCount >= maxRetries) {
        tryFallbackVideo()
      } else {
        setRetryCount((prev) => prev + 1)
      }
    } finally {
      setIsLoading(false)
    }
  }

  // Check for program updates
  const checkForProgramUpdates = async () => {
    const now = Date.now()
    const timeSinceLastCheck = now - lastProgramCheck

    // Only check every 30 seconds to avoid too many API calls
    if (timeSinceLastCheck < 30000) {
      return
    }

    setLastProgramCheck(now)
    console.log("Checking for program updates...")

    try {
      const { program } = await getCurrentProgram(channel.id)
      const { programs } = await getUpcomingPrograms(channel.id)

      // If we have a new program, switch to it
      if (program && (!currentProgram || program.id !== currentProgram.id)) {
        console.log(`New program detected: ${program.title} (ID: ${program.id})`)

        // Save current progress before switching
        if (currentProgram && videoRef.current) {
          await saveWatchProgress(currentProgram.id, videoRef.current.currentTime)
        }

        // Switch to the new program
        await loadProgram(program)
        setUpcomingPrograms(programs)
      } else {
        // Just update the upcoming programs list
        setUpcomingPrograms(programs)
      }
    } catch (err) {
      console.error("Error checking for program updates:", err)
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

    if (!videoRef.current) {
      setIsLoading(false)
      return
    }

    try {
      // Get a direct URL
      const url = await getDirectDownloadUrl(program.mp4_url, channel.id)

      if (url) {
        console.log(`Found direct URL: ${url}`)

        // Add cache-busting parameter
        const cacheBustedUrl = `${url}?t=${Date.now()}`

        videoRef.current.src = cacheBustedUrl
        videoRef.current.load()
        setVideoUrl(cacheBustedUrl)
        setShowStandby(false)

        // Try to restore previous watch position
        const savedProgress = await getWatchProgress(program.id)
        if (savedProgress && savedProgress > 10) {
          videoRef.current.currentTime = savedProgress
          console.log(`Restored watch progress: ${savedProgress}s`)
        }

        // Auto-play the new program
        try {
          await videoRef.current.play()
          setIsPlaying(true)
        } catch (playError) {
          console.error("Error auto-playing new program:", playError)
        }
      } else {
        // Try the raw mp4_url as a fallback
        console.log(`No direct URL found, trying raw mp4_url: ${program.mp4_url}`)

        if (program.mp4_url) {
          videoRef.current.src = program.mp4_url
          videoRef.current.load()
          setVideoUrl(program.mp4_url)
          setShowStandby(false)

          // Auto-play the new program
          try {
            await videoRef.current.play()
            setIsPlaying(true)
          } catch (playError) {
            console.error("Error auto-playing new program:", playError)
          }
        } else {
          console.error("No mp4_url available for this program")
          setLoadError("No video URL available for this program")
          setShowStandby(true)
        }
      }
    } catch (err) {
      console.error("Error loading program:", err)
      setLoadError(`Error loading video: ${err instanceof Error ? err.message : String(err)}`)

      if (retryCount >= maxRetries) {
        tryFallbackVideo()
      } else {
        setRetryCount((prev) => prev + 1)
      }
    } finally {
      setIsLoading(false)
    }
  }

  // Refresh current program
  const refreshCurrentProgram = async () => {
    setIsLoading(true)
    setError(null)
    setRetryCount(0)

    try {
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
        await loadProgram(program)
      } else {
        // Just refresh the current program
        await loadProgram(program)
      }
    } catch (e) {
      console.error(`Error refreshing program for channel ${channel.id}:`, e)
      setError(`Failed to refresh program: ${e}`)
      setIsLoading(false)
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

      // Save watch progress every 10 seconds
      if (currentProgram && currentTime % 10 < 0.5) {
        saveWatchProgress(currentProgram.id, currentTime).catch((err) =>
          console.error("Error saving watch progress:", err),
        )
      }
    }
  }

  // Handle video end event - automatically switch to next program
  const handleVideoEnded = async () => {
    console.log("Video ended, checking for next program")

    // Save final watch progress
    if (currentProgram && videoRef.current) {
      await saveWatchProgress(currentProgram.id, videoRef.current.duration || 0)
    }

    // Check for a new program
    try {
      const { program } = await getCurrentProgram(channel.id)
      const { programs } = await getUpcomingPrograms(channel.id)

      // Update upcoming programs list
      setUpcomingPrograms(programs)

      // If we have a new program, load it
      if (program && (!currentProgram || program.id !== currentProgram.id)) {
        console.log(`Loading next program: ${program.title} (ID: ${program.id})`)
        await loadProgram(program)
      } else if (programs.length > 0) {
        // If no new current program but we have upcoming programs, load the first one
        console.log(`Loading first upcoming program: ${programs[0].title} (ID: ${programs[0].id})`)
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
      // No initial program, refresh to get one
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
  }, [channel.id])

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
            onWaiting={() => console.log("Video is waiting/buffering")}
            onStalled={() => console.log("Video playback has stalled")}
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
