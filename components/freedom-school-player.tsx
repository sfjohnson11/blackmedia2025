"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"

interface FreedomSchoolPlayerProps {
  video: any
}

export function FreedomSchoolPlayer({ video }: FreedomSchoolPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()
  const [isPlaying, setIsPlaying] = useState(false)
  const [isMuted, setIsMuted] = useState(false)
  const [progress, setProgress] = useState(0)
  const [duration, setDuration] = useState(0)
  const [currentUrl, setCurrentUrl] = useState("")
  const [usedFallback, setUsedFallback] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [savedProgress, setSavedProgress] = useState<number | null>(null)
  const [fallbackVideoUrl, setFallbackVideoUrl] = useState("")

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

  useEffect(() => {
    if (!videoRef.current || !video?.mp4_url) return

    console.log("Freedom School: Loading video:", video.title)

    try {
      // Fix double slashes in the URL
      const fixedUrl = fixUrl(video.mp4_url)
      console.log("Freedom School: Fixed URL:", fixedUrl)

      // Clear any previous errors
      setError(null)
      setIsLoading(true)

      // Set the video source
      videoRef.current.src = fixedUrl

      // Force a reload of the video
      videoRef.current.load()

      // Play the video
      videoRef.current.play().catch((err) => {
        console.error("Freedom School: Error playing video:", err)
        setError(`Error playing video: ${err?.message || "Unknown error"}`)
        setIsLoading(false)
      })
    } catch (err) {
      console.error("Freedom School: Error setting up video:", err)
      setError(`Error setting up video: ${err instanceof Error ? err.message : "Unknown error"}`)
      setIsLoading(false)
    }
  }, [video])

  const handleCanPlay = () => {
    console.log("Freedom School: Video can play")
    setIsLoading(false)
    setError(null)
  }

  const handleError = () => {
    const videoElement = videoRef.current
    let errorMessage = "Unknown error"

    if (videoElement?.error) {
      switch (videoElement.error.code) {
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
          errorMessage = `Error code: ${videoElement.error.code}`
      }

      if (videoElement.error.message) {
        errorMessage += ` - ${videoElement.error.message}`
      }
    }

    console.error("Freedom School: Video error:", errorMessage)
    setError(`Video error: ${errorMessage}`)
    setIsLoading(false)
  }

  const retryPlayback = () => {
    if (!videoRef.current || !video?.mp4_url) return

    console.log("Freedom School: Retrying playback")

    try {
      // Fix double slashes in the URL
      const fixedUrl = fixUrl(video.mp4_url)

      // Clear any previous errors
      setError(null)
      setIsLoading(true)

      // Set the video source
      videoRef.current.src = fixedUrl

      // Force a reload of the video
      videoRef.current.load()

      // Play the video
      videoRef.current.play().catch((err) => {
        console.error("Freedom School: Error playing video on retry:", err)
        setError(`Error playing video: ${err?.message || "Unknown error"}`)
        setIsLoading(false)
      })
    } catch (err) {
      console.error("Freedom School: Error retrying playback:", err)
      setError(`Error retrying playback: ${err instanceof Error ? err.message : "Unknown error"}`)
      setIsLoading(false)
    }
  }

  // Set up video event listeners
  /*useEffect(() => {
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
*/
  return (
    <div className="relative w-full aspect-video bg-black rounded-lg overflow-hidden">
      {/* Loading state */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-10">
          <div className="flex flex-col items-center">
            <Loader2 className="h-12 w-12 text-red-600 animate-spin mb-2" />
            <p className="text-white">Loading video...</p>
          </div>
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-10">
          <div className="text-center p-4 max-w-md">
            <p className="text-red-500 mb-4">{error}</p>
            <button
              onClick={retryPlayback}
              className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 transition-colors"
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
        playsInline
        onCanPlay={handleCanPlay}
        onError={handleError}
      >
        Your browser does not support the video tag.
      </video>
    </div>
  )
}
