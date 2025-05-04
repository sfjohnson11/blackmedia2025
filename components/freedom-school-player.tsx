"use client"

import type React from "react"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Play, Pause, Volume2, VolumeX, Maximize, RotateCcw, RefreshCw } from "lucide-react"
import { saveWatchProgress, getWatchProgress } from "@/lib/supabase"

interface FreedomSchoolPlayerProps {
  videoUrl: string
  title: string
  programId?: number
}

export function FreedomSchoolPlayer({ videoUrl, title, programId = 999 }: FreedomSchoolPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false)
  const [progress, setProgress] = useState(0)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(1)
  const [isMuted, setIsMuted] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isRetrying, setIsRetrying] = useState(false)

  const videoRef = useRef<HTMLVideoElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const progressSaveIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const progressUpdateIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const stableVideoUrlRef = useRef<string>(videoUrl)
  const lastSavedTimeRef = useRef<number>(0)
  const loadingRef = useRef<boolean>(true)
  const playbackCheckIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const lastPlaybackTimeRef = useRef<number>(0)
  const playbackStallCountRef = useRef<number>(0)

  // Fallback video URL in case the primary one fails
  const fallbackVideoUrl =
    "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/freedom_school_sample-D7yZUERL2zhjE71Llxul69gbPLxGES.mp4"

  // Initialize player and load saved progress
  useEffect(() => {
    // Store the video URL in a ref to ensure it doesn't change
    stableVideoUrlRef.current = videoUrl

    const loadSavedProgress = async () => {
      if (!videoRef.current) return

      try {
        loadingRef.current = true
        const savedProgress = await getWatchProgress(programId)

        if (savedProgress && savedProgress > 5) {
          console.log(`Restoring saved position for Freedom School video: ${savedProgress}s`)
          videoRef.current.currentTime = savedProgress
          lastSavedTimeRef.current = savedProgress
        }
      } catch (err) {
        console.error("Error loading saved progress:", err)
      } finally {
        loadingRef.current = false
      }
    }

    loadSavedProgress()

    // Set up continuous progress saving - save every 10 seconds
    progressSaveIntervalRef.current = setInterval(() => {
      if (videoRef.current && !videoRef.current.paused && videoRef.current.currentTime > 0) {
        // Only save if position has changed significantly (more than 3 seconds)
        if (Math.abs(videoRef.current.currentTime - lastSavedTimeRef.current) > 3) {
          console.log(`Saving Freedom School video progress: ${Math.round(videoRef.current.currentTime)}s`)
          saveWatchProgress(programId, videoRef.current.currentTime)
          lastSavedTimeRef.current = videoRef.current.currentTime
        }
      }
    }, 10000)

    // Set up continuous progress updating (UI) - update 4 times per second
    progressUpdateIntervalRef.current = setInterval(() => {
      if (videoRef.current) {
        setCurrentTime(videoRef.current.currentTime)
        setProgress((videoRef.current.currentTime / videoRef.current.duration) * 100)
      }
    }, 250)

    // Set up playback stall detection
    playbackCheckIntervalRef.current = setInterval(() => {
      if (videoRef.current && !videoRef.current.paused && videoRef.current.currentTime > 0) {
        // If playback time hasn't advanced in 5 seconds and we're not at the end
        if (
          videoRef.current.currentTime === lastPlaybackTimeRef.current &&
          videoRef.current.currentTime < videoRef.current.duration - 5
        ) {
          playbackStallCountRef.current += 1
          console.log(
            `Playback appears stalled (${playbackStallCountRef.current}), current time: ${videoRef.current.currentTime}s`,
          )

          // After 3 stall detections, try to nudge playback forward
          if (playbackStallCountRef.current >= 3) {
            console.log("Multiple stalls detected, attempting to resume playback")
            // Try to nudge playback forward
            const currentPos = videoRef.current.currentTime
            videoRef.current.currentTime += 0.5
            videoRef.current.play().catch((e) => {
              console.error("Failed to resume stalled playback:", e)
            })
            playbackStallCountRef.current = 0
          }
        } else {
          // Reset stall count if playback is advancing
          playbackStallCountRef.current = 0
          lastPlaybackTimeRef.current = videoRef.current.currentTime
        }
      }
    }, 5000)

    return () => {
      if (progressSaveIntervalRef.current) {
        clearInterval(progressSaveIntervalRef.current)
      }
      if (progressUpdateIntervalRef.current) {
        clearInterval(progressUpdateIntervalRef.current)
      }
      if (playbackCheckIntervalRef.current) {
        clearInterval(playbackCheckIntervalRef.current)
      }
    }
  }, [programId, videoUrl])

  // Handle metadata loaded
  const handleMetadataLoaded = () => {
    if (!videoRef.current) return

    setDuration(videoRef.current.duration)
    setIsLoading(false)
    console.log(`Freedom School video metadata loaded. Duration: ${videoRef.current.duration}s`)

    // Set video to high priority loading
    if ("priority" in videoRef.current) {
      try {
        // @ts-ignore - This is a non-standard but useful attribute
        videoRef.current.priority = true
      } catch (e) {
        // Ignore if not supported
      }
    }

    // Increase buffer size if possible
    try {
      // @ts-ignore - Non-standard but useful in some browsers
      if (videoRef.current.bufferSize) videoRef.current.bufferSize = 60
    } catch (e) {
      // Ignore if not supported
    }
  }

  // Handle play/pause
  const togglePlay = () => {
    if (!videoRef.current) return

    if (videoRef.current.paused) {
      videoRef.current
        .play()
        .then(() => {
          setIsPlaying(true)
          console.log("Freedom School video playback started")
        })
        .catch((err) => {
          console.error("Error playing video:", err)
          setError("Failed to play video. Please try again.")
        })
    } else {
      videoRef.current.pause()
      setIsPlaying(false)
      console.log("Freedom School video playback paused")
    }
  }

  // Handle mute toggle
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

  // Handle seeking
  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!videoRef.current) return

    const seekTime = (Number.parseFloat(e.target.value) / 100) * videoRef.current.duration
    videoRef.current.currentTime = seekTime
    setCurrentTime(seekTime)
    setProgress((seekTime / videoRef.current.duration) * 100)

    // Save position after seeking
    saveWatchProgress(programId, seekTime).catch((err) => console.error("Error saving watch progress after seek:", err))
  }

  // Handle fullscreen toggle
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

  // Update fullscreen state
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement)
    }

    document.addEventListener("fullscreenchange", handleFullscreenChange)
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange)
    }
  }, [])

  // Handle video errors with fallback
  const handleError = () => {
    if (!videoRef.current || !videoRef.current.error) return

    let errorMessage = "Unknown error"
    switch (videoRef.current.error.code) {
      case 1:
        errorMessage = "Video loading aborted"
        break
      case 2:
        errorMessage = "Network error while loading video"
        break
      case 3:
        errorMessage = "Video decoding failed - format may be unsupported"
        break
      case 4:
        errorMessage = "Video not found or access denied"
        break
    }

    console.error(`Freedom School video error: ${errorMessage}`, videoRef.current.error)

    // Only set error if we're not already retrying
    if (!isRetrying) {
      setError(`${errorMessage}. Trying alternative source...`)

      // Try the fallback URL if we're not already using it
      if (videoRef.current.src !== fallbackVideoUrl) {
        console.log("Switching to fallback video URL")
        setTimeout(() => {
          if (videoRef.current) {
            videoRef.current.src = fallbackVideoUrl
            videoRef.current.load()
            setIsRetrying(true)
          }
        }, 1000)
      } else {
        setError(`${errorMessage}. Please try again later.`)
      }
    }
  }

  // Handle video end
  const handleEnded = () => {
    setIsPlaying(false)
    // Save final position
    if (videoRef.current) {
      saveWatchProgress(programId, videoRef.current.duration)
    }
  }

  // Format time (MM:SS)
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs < 10 ? "0" : ""}${secs}`
  }

  // Restart video
  const restartVideo = () => {
    if (!videoRef.current) return

    setError(null)
    setIsRetrying(true)

    // Try the original URL first
    videoRef.current.src = stableVideoUrlRef.current
    videoRef.current.load()

    // Set up a timeout to try the fallback if the original fails
    setTimeout(() => {
      if (videoRef.current && videoRef.current.error) {
        console.log("Original URL failed, trying fallback")
        videoRef.current.src = fallbackVideoUrl
        videoRef.current.load()
      }

      // Attempt to play after loading
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current
            .play()
            .then(() => {
              setIsPlaying(true)
              setIsRetrying(false)
            })
            .catch((err) => {
              console.error("Error playing video after restart:", err)
              setError("Failed to restart video. Please try again.")
              setIsRetrying(false)
            })
        }
      }, 1000)
    }, 3000)
  }

  // Handle stalled playback
  const handleStalled = () => {
    console.log("Freedom School video playback stalled, attempting to resume...")

    if (!videoRef.current || loadingRef.current) return

    // Try to resume from the current position
    const currentPos = videoRef.current.currentTime

    setTimeout(() => {
      if (videoRef.current && videoRef.current.paused) {
        videoRef.current.currentTime = currentPos
        videoRef.current.play().catch((e) => {
          console.error("Failed to resume after stall:", e)
        })
      }
    }, 1000)
  }

  // Handle waiting event
  const handleWaiting = () => {
    console.log("Freedom School video is buffering...")
    setIsLoading(true)
  }

  // Handle playing event
  const handlePlaying = () => {
    setIsLoading(false)
    setIsPlaying(true)
    setError(null)
  }

  return (
    <div ref={containerRef} className="relative w-full aspect-video bg-black rounded-lg overflow-hidden">
      {/* Video element */}
      <video
        ref={videoRef}
        src={videoUrl}
        className="w-full h-full"
        onLoadedMetadata={handleMetadataLoaded}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onEnded={handleEnded}
        onError={handleError}
        onStalled={handleStalled}
        onWaiting={handleWaiting}
        onPlaying={handlePlaying}
        playsInline
        preload="auto"
        // Disable any browser features that might cause automatic reloading
        onSeeking={() => console.log("Video seeking...")}
        onSeeked={() => console.log("Video seeked")}
      />

      {/* Loading indicator */}
      {isLoading && !error && (
        <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
          <div className="flex flex-col items-center">
            <RefreshCw className="h-12 w-12 text-red-600 animate-spin mb-4" />
            <p className="text-white text-lg">Loading video...</p>
          </div>
        </div>
      )}

      {/* Error overlay */}
      {error && (
        <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center p-4 z-20">
          <p className="text-red-500 mb-4">{error}</p>
          <Button onClick={restartVideo} variant="destructive" disabled={isRetrying}>
            {isRetrying ? (
              <>
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                Retrying...
              </>
            ) : (
              <>
                <RotateCcw className="mr-2 h-4 w-4" />
                Restart Video
              </>
            )}
          </Button>
        </div>
      )}

      {/* Video controls */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4">
        {/* Title */}
        <h3 className="text-white font-medium mb-2 truncate">{title}</h3>

        {/* Progress bar */}
        <div className="flex items-center gap-2 mb-2">
          <span className="text-white text-xs">{formatTime(currentTime)}</span>
          <input
            type="range"
            min="0"
            max="100"
            value={progress}
            onChange={handleSeek}
            className="w-full h-1 bg-gray-700 rounded-full appearance-none cursor-pointer"
            style={{
              background: `linear-gradient(to right, #ef4444 0%, #ef4444 ${progress}%, #4b5563 ${progress}%, #4b5563 100%)`,
            }}
          />
          <span className="text-white text-xs">{formatTime(duration)}</span>
        </div>

        {/* Controls */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            {/* Play/Pause */}
            <button
              onClick={togglePlay}
              className="text-white hover:text-gray-300 focus:outline-none"
              aria-label={isPlaying ? "Pause" : "Play"}
            >
              {isPlaying ? <Pause className="h-6 w-6" /> : <Play className="h-6 w-6" />}
            </button>

            {/* Volume control */}
            <div className="flex items-center space-x-2">
              <button
                onClick={toggleMute}
                className="text-white hover:text-gray-300 focus:outline-none"
                aria-label={isMuted ? "Unmute" : "Mute"}
              >
                {isMuted || volume === 0 ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
              </button>
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={volume}
                onChange={handleVolumeChange}
                className="w-20 h-1 bg-gray-700 rounded-full appearance-none cursor-pointer md:block hidden"
              />
            </div>
          </div>

          {/* Fullscreen */}
          <button
            onClick={toggleFullscreen}
            className="text-white hover:text-gray-300 focus:outline-none"
            aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
          >
            <Maximize className="h-5 w-5" />
          </button>
        </div>
      </div>
    </div>
  )
}
