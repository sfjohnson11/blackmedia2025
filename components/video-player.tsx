"use client"

import type React from "react"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { Loader2, Play, Pause, Volume2, VolumeX, Maximize, ChevronLeft, RefreshCw, AlertTriangle } from "lucide-react"
import { getCurrentProgram, getUpcomingPrograms } from "@/lib/supabase"

interface VideoPlayerProps {
  channel: any
  initialProgram: any
  upcomingPrograms: any[]
}

export function VideoPlayer({ channel, initialProgram, upcomingPrograms: initialUpcoming }: VideoPlayerProps) {
  const router = useRouter()
  const videoRef = useRef<HTMLVideoElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const [isPlaying, setIsPlaying] = useState(false)
  const [isMuted, setIsMuted] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [currentProgram, setCurrentProgram] = useState(initialProgram)
  const [upcomingPrograms, setUpcomingPrograms] = useState(initialUpcoming)
  const [progress, setProgress] = useState(0)
  const [volume, setVolume] = useState(1)
  const [currentVideoUrl, setCurrentVideoUrl] = useState<string | null>(null)
  const [attemptedUrls, setAttemptedUrls] = useState<string[]>([])
  const [debugInfo, setDebugInfo] = useState<string>("")

  // Reliable fallback video
  const fallbackVideoUrl = "https://storage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4"

  // Fix double slashes in URLs (but preserve http://)
  const fixUrl = (url: string): string => {
    if (!url) return ""
    // First, normalize the URL by replacing multiple slashes with a single slash
    // But preserve the http:// or https:// part
    return url.replace(/(https?:\/\/)|(\/\/+)/g, (match, protocol) => {
      return protocol || "/"
    })
  }

  // Add cache buster to URL
  const addCacheBuster = (url: string): string => {
    const cacheBuster = `t=${Date.now()}`
    return url.includes("?") ? `${url}&${cacheBuster}` : `${url}?${cacheBuster}`
  }

  // Extract filename from URL
  const extractFilename = (url: string): string => {
    if (!url) return ""
    const parts = url.split("/")
    return parts[parts.length - 1].split("?")[0] // Remove query parameters
  }

  // Generate alternative URLs for a given program
  const generateAlternativeUrls = (program: any): string[] => {
    if (!program || !program.mp4_url) return []

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ""

    // Extract filename from mp4_url
    const fileName = extractFilename(program.mp4_url)

    // Generate different URL patterns - UNIVERSAL for ALL channels
    const urls = [
      // Original URL (fixed)
      fixUrl(program.mp4_url),

      // Try with channel ID in path (various formats)
      `${supabaseUrl}/storage/v1/object/public/channel${channel.id}/${fileName}`,
      `${supabaseUrl}/storage/v1/object/public/ch${channel.id}/${fileName}`,
      `${supabaseUrl}/storage/v1/object/public/videos/channel${channel.id}/${fileName}`,
      `${supabaseUrl}/storage/v1/object/public/videos/ch${channel.id}/${fileName}`,

      // Try with just the filename in various buckets
      `${supabaseUrl}/storage/v1/object/public/videos/${fileName}`,
      `${supabaseUrl}/storage/v1/object/public/${fileName}`,

      // Try with channel ID as a folder name
      `${supabaseUrl}/storage/v1/object/public/${channel.id}/${fileName}`,

      // Try direct URL if it looks like a full URL
      fileName.includes("http") ? fileName : null,

      // Try with the original URL but different domain
      program.mp4_url.replace(/^https?:\/\/[^/]+/, supabaseUrl),
    ]

    // Filter out duplicates, nulls, and empty URLs
    return [...new Set(urls.filter(Boolean))].map(fixUrl)
  }

  // Try to load video with a specific URL
  const tryVideoUrl = async (url: string): Promise<boolean> => {
    if (!videoRef.current) return false

    try {
      setDebugInfo(`Trying URL: ${url}`)
      console.log(`Trying URL: ${url}`)

      // Add to attempted URLs
      setAttemptedUrls((prev) => [...prev, url])

      // Add cache buster
      const urlWithCacheBuster = addCacheBuster(url)

      // Set the video source
      videoRef.current.src = urlWithCacheBuster
      setCurrentVideoUrl(urlWithCacheBuster)

      // Load the video
      videoRef.current.load()

      // Return a promise that resolves when the video can play
      return new Promise((resolve) => {
        const onCanPlay = () => {
          videoRef.current?.removeEventListener("canplay", onCanPlay)
          videoRef.current?.removeEventListener("error", onError)
          resolve(true)
        }

        const onError = () => {
          videoRef.current?.removeEventListener("canplay", onCanPlay)
          videoRef.current?.removeEventListener("error", onError)
          resolve(false)
        }

        videoRef.current?.addEventListener("canplay", onCanPlay)
        videoRef.current?.addEventListener("error", onError)

        // Set a timeout in case the events don't fire
        setTimeout(() => resolve(false), 5000)
      })
    } catch (err) {
      console.error(`Error trying URL ${url}:`, err)
      return false
    }
  }

  // Try all alternative URLs
  const tryAllUrls = async (program: any) => {
    if (!program) {
      setError("No program available")
      setIsLoading(false)
      return false
    }

    const urls = generateAlternativeUrls(program)
    console.log("Generated URLs:", urls)

    // Filter out URLs we've already tried
    const untried = urls.filter((url) => !attemptedUrls.includes(url))

    if (untried.length === 0) {
      console.log("All URLs have been tried")
      return false
    }

    // Try each URL
    for (const url of untried) {
      const success = await tryVideoUrl(url)

      if (success) {
        console.log(`Successfully loaded URL: ${url}`)
        setDebugInfo(`Successfully loaded: ${url}`)

        // Try to play
        try {
          await videoRef.current?.play()
          setIsPlaying(true)
          setIsLoading(false)
          setError(null)
          return true
        } catch (err) {
          console.error("Error playing video:", err)
          // Continue to next URL
        }
      }
    }

    return false
  }

  // Load a program
  const loadProgram = async (program: any) => {
    console.log(`Loading program: ${program.title} (ID: ${program.id})`)
    setIsLoading(true)
    setError(null)
    setCurrentProgram(program)
    setDebugInfo(`Loading program: ${program.title} (ID: ${program.id})`)

    if (!videoRef.current) return

    try {
      // Reset video attributes
      videoRef.current.crossOrigin = "anonymous"

      // Try all URLs
      const success = await tryAllUrls(program)

      if (!success) {
        // If all URLs fail, try the fallback
        setDebugInfo("All URLs failed, trying fallback")
        tryFallbackVideo()
      }
    } catch (err) {
      console.error("Error loading program:", err)
      setError(`Error loading program: ${err instanceof Error ? err.message : String(err)}`)
      setIsLoading(false)
      tryFallbackVideo()
    }
  }

  // Refresh current program
  const refreshProgram = async () => {
    setIsLoading(true)
    setError(null)
    setAttemptedUrls([])
    setDebugInfo("Refreshing program...")

    try {
      const { program } = await getCurrentProgram(channel.id)
      const { programs } = await getUpcomingPrograms(channel.id)

      if (program) {
        await loadProgram(program)
        setUpcomingPrograms(programs)
      } else {
        setError("No program found for this channel")
        setIsLoading(false)
        tryFallbackVideo()
      }
    } catch (err) {
      console.error("Error refreshing program:", err)
      setError(`Error refreshing program: ${err instanceof Error ? err.message : String(err)}`)
      setIsLoading(false)
      tryFallbackVideo()
    }
  }

  // Try fallback video
  const tryFallbackVideo = () => {
    if (!videoRef.current) return

    setIsLoading(true)
    setError(null)
    setDebugInfo("Trying fallback video")

    try {
      videoRef.current.src = fallbackVideoUrl
      videoRef.current.load()
      setCurrentVideoUrl(fallbackVideoUrl)

      videoRef.current
        .play()
        .then(() => {
          setIsPlaying(true)
          setIsLoading(false)
          setError("Using fallback video. The requested program could not be loaded.")
        })
        .catch((err) => {
          console.error("Error playing fallback video:", err)
          setError(`Error playing fallback video: ${err.message}`)
          setIsLoading(false)
        })
    } catch (err) {
      console.error("Error loading fallback video:", err)
      setError(`Error loading fallback video: ${err instanceof Error ? err.message : String(err)}`)
      setIsLoading(false)
    }
  }

  // Toggle play/pause
  const togglePlay = () => {
    if (!videoRef.current) return

    if (videoRef.current.paused) {
      videoRef.current
        .play()
        .then(() => setIsPlaying(true))
        .catch((err) => {
          console.error("Error playing video:", err)
          setError(`Error playing video: ${err.message}`)
        })
    } else {
      videoRef.current.pause()
      setIsPlaying(false)
    }
  }

  // Toggle mute
  const toggleMute = () => {
    if (!videoRef.current) return

    videoRef.current.muted = !videoRef.current.muted
    setIsMuted(videoRef.current.muted)
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

  // Handle time update
  const handleTimeUpdate = () => {
    if (!videoRef.current) return

    const currentTime = videoRef.current.currentTime
    const duration = videoRef.current.duration

    if (duration) {
      setProgress((currentTime / duration) * 100)
    }
  }

  // Handle seeking
  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!videoRef.current) return

    const seekTime = (Number.parseFloat(e.target.value) / 100) * videoRef.current.duration
    videoRef.current.currentTime = seekTime
  }

  // Toggle fullscreen
  const toggleFullscreen = () => {
    if (!containerRef.current) return

    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch((err) => {
        console.error(`Error attempting to enable fullscreen: ${err.message}`)
      })
    } else {
      document.exitFullscreen()
    }
  }

  // Handle video end
  const handleVideoEnd = async () => {
    console.log("Video ended")
    setDebugInfo("Video ended, checking for next program")

    try {
      const { program } = await getCurrentProgram(channel.id)
      const { programs } = await getUpcomingPrograms(channel.id)

      setUpcomingPrograms(programs)

      if (program && (!currentProgram || program.id !== currentProgram.id)) {
        setAttemptedUrls([]) // Reset attempted URLs for new program
        await loadProgram(program)
      } else if (programs.length > 0) {
        setAttemptedUrls([]) // Reset attempted URLs for new program
        await loadProgram(programs[0])
      } else {
        refreshProgram()
      }
    } catch (err) {
      console.error("Error handling video end:", err)
      refreshProgram()
    }
  }

  // Format time for display (MM:SS)
  const formatTime = (timeInSeconds: number): string => {
    const minutes = Math.floor(timeInSeconds / 60)
    const seconds = Math.floor(timeInSeconds % 60)
    return `${minutes}:${seconds < 10 ? "0" : ""}${seconds}`
  }

  // Go back
  const handleBack = () => {
    router.back()
  }

  // Handle video error
  const handleVideoError = (e: React.SyntheticEvent<HTMLVideoElement, Event>) => {
    const videoElement = e.currentTarget
    let errorMessage = "Unknown error"

    if (videoElement.error) {
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

    console.error("Video error:", errorMessage)
    setDebugInfo(`Video error: ${errorMessage}`)

    // Try next URL if available
    if (currentProgram) {
      tryAllUrls(currentProgram).then((success) => {
        if (!success) {
          setError(`Error loading video: ${errorMessage}`)
          setIsLoading(false)
        }
      })
    } else {
      setError(`Error loading video: ${errorMessage}`)
      setIsLoading(false)
    }
  }

  // Initial setup
  useEffect(() => {
    console.log("Initial setup for channel:", channel.id)
    setDebugInfo(`Initial setup for channel: ${channel.id}`)

    if (initialProgram) {
      loadProgram(initialProgram)
    } else {
      refreshProgram()
    }

    // Check for program updates every minute
    const interval = setInterval(() => {
      getCurrentProgram(channel.id).then(({ program }) => {
        if (program && (!currentProgram || program.id !== currentProgram.id)) {
          setAttemptedUrls([]) // Reset attempted URLs for new program
          loadProgram(program)
          getUpcomingPrograms(channel.id).then(({ programs }) => {
            setUpcomingPrograms(programs)
          })
        }
      })
    }, 60000)

    return () => clearInterval(interval)
  }, [channel.id, initialProgram])

  return (
    <div className="relative bg-black" ref={containerRef}>
      {/* Video container */}
      <div className="relative w-full aspect-video">
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
              <p className="text-gray-400 text-sm mt-2">{debugInfo}</p>
            </div>
          </div>
        )}

        {/* Error state */}
        {error && (
          <div className="absolute inset-0 flex items-center justify-center bg-black z-20">
            <div className="text-center p-4 max-w-md">
              <AlertTriangle className="h-8 w-8 text-yellow-500 mx-auto mb-2" />
              <p className="text-red-500 mb-4">{error}</p>
              <div className="flex justify-center space-x-4">
                <button
                  onClick={() => {
                    setAttemptedUrls([])
                    refreshProgram()
                  }}
                  className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 transition-colors flex items-center"
                >
                  <RefreshCw className="h-4 w-4 mr-2" /> Try Again
                </button>
                <button
                  onClick={tryFallbackVideo}
                  className="bg-gray-700 text-white px-4 py-2 rounded hover:bg-gray-600 transition-colors"
                >
                  Try Fallback Video
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Video element */}
        <video
          ref={videoRef}
          className="w-full h-full"
          onClick={togglePlay}
          onTimeUpdate={handleTimeUpdate}
          onEnded={handleVideoEnd}
          onCanPlay={() => {
            setIsLoading(false)
            setDebugInfo("Video can play")
          }}
          onError={handleVideoError}
          playsInline
          crossOrigin="anonymous"
          preload="auto"
        >
          {currentVideoUrl && <source src={currentVideoUrl} type="video/mp4" />}
          Your browser does not support the video tag.
        </video>

        {/* Video controls */}
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4">
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
              <button onClick={togglePlay} className="text-white hover:text-red-500 transition-colors">
                {isPlaying ? <Pause className="h-6 w-6" /> : <Play className="h-6 w-6" />}
              </button>
              <button onClick={toggleMute} className="text-white hover:text-red-500 transition-colors">
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

            <button onClick={toggleFullscreen} className="text-white hover:text-red-500 transition-colors">
              <Maximize className="h-6 w-6" />
            </button>
          </div>
        </div>
      </div>

      {/* Current program info */}
      {currentProgram && (
        <div className="bg-black p-4">
          <h2 className="text-xl font-bold text-white">{currentProgram.title}</h2>
          {upcomingPrograms.length > 0 && (
            <p className="text-gray-400 text-sm mt-1">Next: {upcomingPrograms[0].title}</p>
          )}
        </div>
      )}

      {/* Debug info */}
      <div className="bg-black p-2 text-xs text-gray-500">
        <p>Channel ID: {channel.id}</p>
        <p>Current URL: {currentVideoUrl ? currentVideoUrl.substring(0, 50) + "..." : "None"}</p>
        <p>Status: {debugInfo}</p>
        <button
          onClick={() => {
            setAttemptedUrls([])
            refreshProgram()
          }}
          className="bg-gray-800 text-gray-300 px-2 py-1 rounded text-xs mt-1 hover:bg-gray-700"
        >
          Refresh Video
        </button>
      </div>
    </div>
  )
}
