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
  const [showNextProgram, setShowNextProgram] = useState(false)

  const videoRef = useRef<HTMLVideoElement>(null)
  const standbyVideoRef = useRef<HTMLVideoElement>(null)
  const videoContainerRef = useRef<HTMLDivElement>(null)

  const cleanedName = cleanChannelName(channel.name)

  // Standby video URL
  const standbyVideoUrl =
    "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/standby_blacktruthtv-D7yZUERL2zhjE71Llxul69gbPLxGES.mp4"

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
    }
  }, [controlsTimeout])

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

  // Handle video error
  const handleVideoError = () => {
    console.error("Video error occurred")
    setLoadError("Error loading video. Please try again.")
    setIsLoading(false)
  }

  // Function to retry playing the current video
  const retryPlayback = async () => {
    if (!currentProgram || !videoRef.current) return

    setIsLoading(true)
    setLoadError(null)

    try {
      // Try to get a direct download URL
      const url = await getDirectDownloadUrl(currentProgram.mp4_url, channel.id)

      if (url) {
        console.log(`Retrying with direct URL: ${url}`)
        videoRef.current.src = url
        videoRef.current.load()
        setVideoUrl(url)
        setShowStandby(false)
      } else {
        console.error("Could not find a working URL")
        setLoadError("Could not find a working URL for this video")
        setShowStandby(true)
        if (standbyVideoRef.current) {
          standbyVideoRef.current.play().catch((e) => {
            console.error("Failed to play standby video:", e)
          })
        }
      }
    } catch (err) {
      console.error("Error in retry:", err)
      setLoadError(`Retry failed: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setIsLoading(false)
    }
  }

  // Refresh current program
  const refreshCurrentProgram = async (forceRefresh = false) => {
    setIsLoading(true)
    setError(null)

    try {
      const { program } = await getCurrentProgram(channel.id)
      const { programs } = await getUpcomingPrograms(channel.id)

      // Only update the current program if it's different or this is a forced refresh
      if (forceRefresh || program?.id !== currentProgram?.id) {
        console.log(`Program change: ${currentProgram?.title} -> ${program?.title}`)
        setCurrentProgram(program)
      }

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

      // For regular channels, try to get a direct download URL
      if (program && videoRef.current) {
        try {
          // Get a direct URL
          const url = await getDirectDownloadUrl(program.mp4_url, channel.id)

          if (url) {
            console.log(`Found direct URL: ${url}`)
            videoRef.current.src = url
            videoRef.current.load()
            setShowStandby(false)
            setVideoUrl(url)
          } else {
            // If we couldn't get a direct URL, try using the raw mp4_url as a fallback
            console.log(`No direct URL found, trying raw mp4_url as fallback: ${program.mp4_url}`)

            // Check if mp4_url is a valid URL or path
            if (program.mp4_url && (program.mp4_url.startsWith("http") || program.mp4_url.includes("/"))) {
              videoRef.current.src = program.mp4_url
              videoRef.current.load()
              setShowStandby(false)
              setVideoUrl(program.mp4_url)
            } else {
              console.error("Could not find a working URL and mp4_url is not usable")
              setLoadError("Could not find a working URL for this video")
              setShowStandby(true)
              if (standbyVideoRef.current) {
                standbyVideoRef.current.play().catch((e) => {
                  console.error("Failed to play standby video:", e)
                })
              }
            }
          }
        } catch (err) {
          console.error("Error getting direct URL:", err)
          setLoadError("Error loading video. Please try again.")
          setShowStandby(true)
        }
      }
    } catch (e) {
      console.error(`Error refreshing program for channel ${channel.id}:`, e)
      setError(`Failed to refresh program: ${e}`)
    } finally {
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

  // Handle video end event - show upcoming program info
  const handleVideoEnded = () => {
    console.log("Video ended, showing upcoming program info")
    setIsPlaying(false)

    // Show the next program info if available
    if (upcomingPrograms.length > 0) {
      setShowNextProgram(true)
    } else {
      // If no upcoming programs, refresh to check for new content
      refreshCurrentProgram(true)
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
    // If we have an initial program, try to load it
    if (currentProgram && videoRef.current) {
      const loadInitialProgram = async () => {
        setIsLoading(true)

        try {
          // Get a direct URL
          const url = await getDirectDownloadUrl(currentProgram.mp4_url, channel.id)

          if (url) {
            console.log(`Found direct URL for initial program: ${url}`)
            videoRef.current.src = url
            videoRef.current.load()
            setVideoUrl(url)

            // Try to restore previous watch position
            const savedProgress = await getWatchProgress(currentProgram.id)
            if (savedProgress && savedProgress > 10) {
              videoRef.current.currentTime = savedProgress
              console.log(`Restored watch progress: ${savedProgress}s`)
            }
          } else {
            console.log(`No direct URL found, trying raw mp4_url: ${currentProgram.mp4_url}`)
            videoRef.current.src = currentProgram.mp4_url
            videoRef.current.load()
            setVideoUrl(currentProgram.mp4_url)
          }
        } catch (err) {
          console.error("Error loading initial program:", err)
          setLoadError("Error loading video. Please try again.")
        } finally {
          setIsLoading(false)
        }
      }

      loadInitialProgram()
    } else {
      // No initial program, refresh to get one
      refreshCurrentProgram(true)
    }

    // Set up standby video
    if (standbyVideoRef.current) {
      standbyVideoRef.current.src = standbyVideoUrl
      standbyVideoRef.current.load()
    }

    // Check for program updates every 5 minutes
    const refreshTimer = setInterval(() => {
      refreshCurrentProgram(false)
    }, 300000) // 5 minutes

    return () => {
      clearInterval(refreshTimer)
    }
  }, [channel.id, currentProgram])

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
                  refreshCurrentProgram(true)
                }}
                className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 transition-colors"
              >
                Try Again
              </button>
            </div>
          </div>
        )}

        {/* Next program info overlay */}
        {showNextProgram && upcomingPrograms.length > 0 && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-20">
            <div className="text-center p-6 bg-gray-900 rounded-lg max-w-md">
              <h3 className="text-xl font-bold mb-2">Coming Up Next</h3>
              <p className="text-lg mb-4">{upcomingPrograms[0].title}</p>
              <p className="text-sm mb-6 text-gray-400">This program will start at the top of the next hour</p>
              <div className="flex justify-center space-x-4">
                <button
                  onClick={() => {
                    setShowNextProgram(false)
                    refreshCurrentProgram(true)
                  }}
                  className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 transition-colors"
                >
                  Check for New Content
                </button>
                <button
                  onClick={() => setShowNextProgram(false)}
                  className="bg-gray-700 text-white px-4 py-2 rounded hover:bg-gray-600 transition-colors"
                >
                  Close
                </button>
              </div>
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
            onCanPlay={() => setIsLoading(false)}
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
                <button
                  className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded flex items-center mx-auto"
                  onClick={retryPlayback}
                >
                  <RefreshCw className="h-4 w-4 mr-2" /> Try Again
                </button>
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
