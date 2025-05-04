"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { Loader2, Play, Pause, Volume2, VolumeX, Maximize, ChevronLeft, AlertTriangle } from "lucide-react"
import { Progress } from "@/components/ui/progress"
import { saveWatchProgress, getWatchProgress } from "@/lib/supabase"

interface FreedomSchoolPlayerProps {
  videoId: number
  videoUrl: string
  title: string
  fallbackUrl?: string
}

async function checkUrlExists(url: string): Promise<boolean> {
  try {
    const response = await fetch(url, { method: "HEAD", mode: "cors" })
    return response.ok
  } catch (error) {
    console.error("Freedom School: Error checking URL:", error)
    return false
  }
}

export function FreedomSchoolPlayer({ videoId, videoUrl, title, fallbackUrl }: FreedomSchoolPlayerProps) {
  const router = useRouter()
  const [isPlaying, setIsPlaying] = useState(false)
  const [isMuted, setIsMuted] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [progress, setProgress] = useState(0)
  const [duration, setDuration] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [currentUrl, setCurrentUrl] = useState(videoUrl)
  const [usedFallback, setUsedFallback] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [savedProgress, setSavedProgress] = useState<number | null>(null)
  const [fallbackVideoUrl, setFallbackVideoUrl] = useState(fallbackUrl)

  const videoRef = useRef<HTMLVideoElement>(null)
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const lastPlaybackTimeRef = useRef<number>(0)
  const stallDetectionRef = useRef<NodeJS.Timeout | null>(null)
  const retryCountRef = useRef<number>(0)
  const maxRetries = 3

  // Track if component is mounted to prevent state updates after unmount
  const isMountedRef = useRef(true)

  // Track the last time we saved progress
  const lastProgressSaveRef = useRef<number>(0)

  // Track if we're currently in a retry loop
  const isRetryingRef = useRef(false)

  // Function to clean up all intervals and timers
  const cleanupTimers = () => {
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current)
      progressIntervalRef.current = null
    }

    if (stallDetectionRef.current) {
      clearInterval(stallDetectionRef.current)
      stallDetectionRef.current = null
    }
  }

  // Set up video event listeners
  useEffect(() => {
    const videoElement = videoRef.current
    if (!videoElement) return

    console.log(`Setting up Freedom School video player for ID: ${videoId}, URL: ${currentUrl}`)

    const handleCanPlay = () => {
      if (isMountedRef.current) {
        setIsLoading(false)
        setError(null)

        // Update duration when video can play
        if (videoElement.duration && !isNaN(videoElement.duration)) {
          setDuration(videoElement.duration)
        }
      }

      // Restore playback position
      restorePlaybackPosition()
    }

    const handleLoadedMetadata = () => {
      if (videoElement.duration && !isNaN(videoElement.duration)) {
        setDuration(videoElement.duration)
      }
    }

    const handleError = async (e: Event) => {
      console.error("Freedom School video error:", e)

      if (!isMountedRef.current || isRetryingRef.current) return

      // Try fallback URL if available and not already using it
      if (fallbackUrl && !usedFallback) {
        console.log("Switching to fallback URL:", fallbackUrl)
        setCurrentUrl(fallbackUrl)
        setUsedFallback(true)
        return
      }

      // Only retry a limited number of times
      if (retryCountRef.current < maxRetries) {
        isRetryingRef.current = true
        retryCountRef.current++

        console.log(`Video error occurred. Retrying (${retryCountRef.current}/${maxRetries})...`)

        // Wait a moment before retrying
        setTimeout(() => {
          if (isMountedRef.current && videoElement) {
            // Try reloading the video
            videoElement.load()
            videoElement.play().catch((err) => {
              console.error("Error during retry play:", err)
            })
            isRetryingRef.current = false
          }
        }, 2000)
      } else {
        if (isMountedRef.current) {
          setError("Unable to play this video. Please try again later.")
          setIsLoading(false)
        }
      }
    }

    const handlePlay = () => {
      if (isMountedRef.current) {
        setIsPlaying(true)
        setError(null)
      }

      // Start stall detection when playing
      startStallDetection()
    }

    const handlePause = () => {
      if (isMountedRef.current) {
        setIsPlaying(false)
      }

      // Stop stall detection when paused
      if (stallDetectionRef.current) {
        clearInterval(stallDetectionRef.current)
        stallDetectionRef.current = null
      }

      // Save progress when paused
      if (videoElement.currentTime > 0) {
        saveWatchProgress(videoId, videoElement.currentTime)
      }
    }

    const handleTimeUpdate = () => {
      if (!videoElement) return

      const currentTime = videoElement.currentTime

      // Update progress state
      if (duration > 0) {
        setProgress((currentTime / duration) * 100)
      }

      // Save progress periodically (every 10 seconds)
      const now = Date.now()
      if (now - lastProgressSaveRef.current > 10000 && currentTime > 0) {
        console.log(`Saving Freedom School progress: ${Math.round(currentTime)}s / ${Math.round(duration)}s`)
        saveWatchProgress(videoId, currentTime)
        lastProgressSaveRef.current = now
      }

      // Update last playback time for stall detection
      lastPlaybackTimeRef.current = currentTime
    }

    const handleEnded = () => {
      if (isMountedRef.current) {
        setIsPlaying(false)
      }

      // Save final position
      saveWatchProgress(videoId, videoElement.duration)
    }

    // Add event listeners
    videoElement.addEventListener("canplay", handleCanPlay)
    videoElement.addEventListener("loadedmetadata", handleLoadedMetadata)
    videoElement.addEventListener("error", handleError)
    videoElement.addEventListener("play", handlePlay)
    videoElement.addEventListener("pause", handlePause)
    videoElement.addEventListener("timeupdate", handleTimeUpdate)
    videoElement.addEventListener("ended", handleEnded)

    // Clean up event listeners
    return () => {
      videoElement.removeEventListener("canplay", handleCanPlay)
      videoElement.removeEventListener("loadedmetadata", handleLoadedMetadata)
      videoElement.removeEventListener("error", handleError)
      videoElement.removeEventListener("play", handlePlay)
      videoElement.removeEventListener("pause", handlePause)
      videoElement.removeEventListener("timeupdate", handleTimeUpdate)
      videoElement.removeEventListener("ended", handleEnded)
    }
  }, [videoId, currentUrl, duration, fallbackUrl, usedFallback])

  useEffect(() => {
    let isMounted = true

    async function loadVideo() {
      if (!videoUrl) {
        console.log("Freedom School: No video URL available")
        setIsLoading(false)
        return
      }

      setIsLoading(true)
      console.log(`Freedom School: Loading video: ${videoUrl}`)

      try {
        // Check if the URL exists
        const exists = await checkUrlExists(videoUrl)
        console.log(`Freedom School: URL check result: ${exists ? "exists" : "does not exist"}`)

        if (!isMounted) return

        if (exists) {
          setLoadError(null)
        } else {
          console.log(`Freedom School: Primary URL failed, trying fallback URL`)
          // Try fallback URL if available
          if (fallbackVideoUrl && fallbackVideoUrl !== videoUrl) {
            setCurrentUrl(fallbackVideoUrl)
            setUsedFallback(true)
          } else {
            setLoadError("Video source not found. Please try again later.")
          }
        }
      } catch (error) {
        console.error("Freedom School: Error checking video URL:", error)
        // Even if there's an error checking, we'll still try to play the video
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    loadVideo()

    // Set a timeout to prevent infinite loading
    const timeout = setTimeout(() => {
      if (isLoading && isMounted) {
        console.log("Freedom School: Video load timed out")
        setIsLoading(false)
        setLoadError("Video is taking too long to load. Please try again or check your connection.")
      }
    }, 15000) // 15 seconds timeout

    return () => {
      isMounted = false
      clearTimeout(timeout)
    }
  }, [videoUrl, fallbackVideoUrl, videoId])

  // Start stall detection
  const startStallDetection = () => {
    // Clear any existing stall detection
    if (stallDetectionRef.current) {
      clearInterval(stallDetectionRef.current)
    }

    // Set up stall detection - check every 5 seconds if playback is advancing
    stallDetectionRef.current = setInterval(() => {
      const videoElement = videoRef.current
      if (!videoElement || !isPlaying || videoElement.paused || videoElement.ended) return

      const currentTime = videoElement.currentTime

      // If playback hasn't advanced in 5 seconds and we're not at the end, we might be stalled
      if (
        currentTime === lastPlaybackTimeRef.current &&
        currentTime < videoElement.duration - 1 &&
        !videoElement.paused
      ) {
        console.log("Freedom School playback appears to be stalled. Attempting recovery...")

        // Try to recover by seeking slightly forward
        try {
          videoElement.currentTime = currentTime + 0.1
          videoElement.play().catch((err) => {
            console.error("Error during stall recovery:", err)
          })
        } catch (err) {
          console.error("Error during stall recovery:", err)
        }
      }

      lastPlaybackTimeRef.current = currentTime
    }, 5000)
  }

  // Restore playback position
  const restorePlaybackPosition = async () => {
    if (!videoRef.current) return

    try {
      const savedProgressValue = await getWatchProgress(videoId)
      if (savedProgressValue && savedProgressValue > 0) {
        console.log(`Restoring Freedom School playback position to ${savedProgressValue} seconds`)
        setSavedProgress(savedProgressValue)
        videoRef.current.currentTime = savedProgressValue
      }
    } catch (err) {
      console.error("Error restoring playback position:", err)
    }
  }

  // Clean up on unmount
  useEffect(() => {
    return () => {
      isMountedRef.current = false
      cleanupTimers()

      // Save final playback position before unmounting
      if (videoRef.current && videoRef.current.currentTime > 0) {
        saveWatchProgress(videoId, videoRef.current.currentTime)
      }
    }
  }, [videoId])

  // Handle play/pause
  const togglePlayPause = () => {
    if (!videoRef.current) return

    if (isPlaying) {
      videoRef.current.pause()
    } else {
      videoRef.current.play().catch((err) => {
        console.error("Error playing video:", err)
        setError("Could not play video. Please try again.")
      })
    }
  }

  // Handle mute/unmute
  const toggleMute = () => {
    if (!videoRef.current) return

    videoRef.current.muted = !isMuted
    setIsMuted(!isMuted)
  }

  // Handle fullscreen
  const toggleFullscreen = () => {
    if (!videoRef.current) return

    if (document.fullscreenElement) {
      document.exitFullscreen().catch((err) => {
        console.error("Error exiting fullscreen:", err)
      })
    } else {
      videoRef.current.requestFullscreen().catch((err) => {
        console.error("Error entering fullscreen:", err)
      })
    }
  }

  // Go back to freedom school page
  const handleBack = () => {
    // Save current position before navigating away
    if (videoRef.current && videoRef.current.currentTime > 0) {
      saveWatchProgress(videoId, videoRef.current.currentTime)
    }

    router.push("/freedom-school")
  }

  return (
    <div className="relative bg-black">
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
              <Loader2 className="h-12 w-12 text-red-600 animate-spin mb-4" />
              <p className="text-sm text-gray-400">{usedFallback ? "Loading fallback video..." : "Loading video..."}</p>
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
                  setIsLoading(true)

                  // Try fallback URL if available and not already using it
                  if (fallbackUrl && !usedFallback) {
                    console.log("Switching to fallback URL:", fallbackUrl)
                    setCurrentUrl(fallbackUrl)
                    setUsedFallback(true)
                    return
                  }

                  // Try reloading the video
                  if (videoRef.current) {
                    videoRef.current.load()
                    videoRef.current.play().catch((err) => {
                      console.error("Error during retry:", err)
                      setError("Unable to play this video. Please try again later.")
                      setIsLoading(false)
                    })
                  }
                }}
                className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 transition-colors"
              >
                Try Again
              </button>
            </div>
          </div>
        )}

        {loadError && !isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-70">
            <div className="bg-gray-900 p-4 rounded-lg max-w-md text-center">
              <AlertTriangle className="h-8 w-8 text-yellow-500 mx-auto mb-2" />
              <p className="text-white mb-4">{loadError}</p>
              <button
                className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded"
                onClick={() => {
                  if (videoRef.current) {
                    setIsLoading(true)
                    setLoadError(null)
                    videoRef.current.load()
                  }
                }}
              >
                Try Again
              </button>
            </div>
          </div>
        )}

        {/* Video element */}
        <video
          ref={videoRef}
          className="w-full h-full"
          controls
          autoPlay
          playsInline
          onLoadStart={() => {
            console.log("Freedom School: Video load started")
            setIsLoading(true)
          }}
          onCanPlay={() => {
            console.log("Freedom School: Video can play now")
            setIsLoading(false)
            setLoadError(null)

            // If we have saved progress, seek to it
            if (savedProgress && videoRef.current) {
              console.log(`Freedom School: Seeking to saved position: ${savedProgress}s`)
              videoRef.current.currentTime = savedProgress
            }
          }}
          onError={(e) => {
            const error = e.currentTarget.error
            console.error("Freedom School: Video error:", error?.message || "Unknown error", error?.code)

            // Try fallback URL if available and not already using it
            if (fallbackVideoUrl && currentUrl !== fallbackVideoUrl) {
              console.log("Freedom School: Trying fallback URL")
              setCurrentUrl(fallbackVideoUrl)
              setUsedFallback(true)
            } else {
              setLoadError(`Error loading video: ${error?.message || "Unknown error"}`)
            }
          }}
          onTimeUpdate={() => {
            if (!videoRef.current) return

            const currentTime = videoRef.current.currentTime

            // Update progress state
            if (duration > 0) {
              setProgress((currentTime / duration) * 100)
            }

            // Save progress periodically (every 10 seconds)
            const now = Date.now()
            if (now - lastProgressSaveRef.current > 10000 && currentTime > 0) {
              console.log(`Saving Freedom School progress: ${Math.round(currentTime)}s / ${Math.round(duration)}s`)
              saveWatchProgress(videoId, currentTime)
              lastProgressSaveRef.current = now
            }

            // Update last playback time for stall detection
            lastPlaybackTimeRef.current = currentTime
          }}
          onWaiting={() => {
            console.log("Freedom School: Video is waiting/buffering")
          }}
          onStalled={() => {
            console.log("Freedom School: Video playback has stalled")
          }}
        >
          <source
            src={currentUrl}
            type={currentUrl?.includes(".m3u8") ? "application/vnd.apple.mpegurl" : "video/mp4"}
          />
          Your browser does not support the video tag.
        </video>

        {/* Video controls overlay */}
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4">
          {/* Progress bar */}
          <div className="mb-4">
            <Progress value={progress} className="h-1" />
          </div>

          {/* Control buttons */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button onClick={togglePlayPause} className="hover:text-red-500 transition-colors">
                {isPlaying ? <Pause className="h-6 w-6" /> : <Play className="h-6 w-6" />}
              </button>
              <button onClick={toggleMute} className="hover:text-red-500 transition-colors">
                {isMuted ? <VolumeX className="h-6 w-6" /> : <Volume2 className="h-6 w-6" />}
              </button>
            </div>
            <button onClick={toggleFullscreen} className="hover:text-red-500 transition-colors">
              <Maximize className="h-6 w-6" />
            </button>
          </div>
        </div>
      </div>

      {/* Video title */}
      <div className="bg-black p-4">
        <h2 className="text-xl font-bold">{title}</h2>
      </div>
    </div>
  )
}
