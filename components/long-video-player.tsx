"use client"

import type React from "react"

import { useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { saveWatchProgress, getWatchProgress } from "@/lib/supabase"
import { Play, Pause, Volume2, VolumeX, Maximize, RotateCcw } from "lucide-react"

interface LongVideoPlayerProps {
  src: string
  title: string
  programId: number
  poster?: string
}

export function LongVideoPlayer({ src, title, programId, poster }: LongVideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [progress, setProgress] = useState(0)
  const [duration, setDuration] = useState(0)
  const [currentTime, setCurrentTime] = useState(0)
  const [volume, setVolume] = useState(1)
  const [isMuted, setIsMuted] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const progressSaveIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const progressUpdateIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const lastSavedTimeRef = useRef<number>(0)
  const loadingRef = useRef<boolean>(false)

  // Initialize player and load saved progress
  useEffect(() => {
    const loadSavedProgress = async () => {
      if (!videoRef.current) return

      try {
        loadingRef.current = true
        const savedProgress = await getWatchProgress(programId)

        if (savedProgress && savedProgress > 5) {
          console.log(`Restoring saved position: ${savedProgress}s`)
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

    // Set up continuous progress saving
    progressSaveIntervalRef.current = setInterval(() => {
      if (videoRef.current && !videoRef.current.paused && videoRef.current.currentTime > 0) {
        // Only save if position has changed significantly (more than 3 seconds)
        if (Math.abs(videoRef.current.currentTime - lastSavedTimeRef.current) > 3) {
          saveWatchProgress(programId, videoRef.current.currentTime)
          lastSavedTimeRef.current = videoRef.current.currentTime
        }
      }
    }, 5000) // Save every 5 seconds if playing

    // Set up continuous progress updating (UI)
    progressUpdateIntervalRef.current = setInterval(() => {
      if (videoRef.current) {
        setCurrentTime(videoRef.current.currentTime)
        setProgress((videoRef.current.currentTime / videoRef.current.duration) * 100)
      }
    }, 250) // Update UI 4 times per second

    return () => {
      if (progressSaveIntervalRef.current) {
        clearInterval(progressSaveIntervalRef.current)
      }
      if (progressUpdateIntervalRef.current) {
        clearInterval(progressUpdateIntervalRef.current)
      }
    }
  }, [programId])

  // Handle metadata loaded
  const handleMetadataLoaded = () => {
    if (!videoRef.current) return
    setDuration(videoRef.current.duration)

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
      videoRef.current.play()
      setIsPlaying(true)
    } else {
      videoRef.current.pause()
      setIsPlaying(false)
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

  // Handle video errors
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

    setError(errorMessage)
    setIsPlaying(false)
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

    videoRef.current.currentTime = 0
    videoRef.current.play()
    setIsPlaying(true)
    setError(null)
  }

  // Handle stalled playback
  const handleStalled = () => {
    console.log("Video playback stalled, attempting to resume...")

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

  return (
    <div ref={containerRef} className="relative w-full aspect-video bg-black rounded-lg overflow-hidden">
      {/* Video element */}
      <video
        ref={videoRef}
        src={src}
        poster={poster}
        className="w-full h-full"
        onLoadedMetadata={handleMetadataLoaded}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onEnded={handleEnded}
        onError={handleError}
        onStalled={handleStalled}
        onWaiting={handleStalled}
        playsInline
        preload="auto"
      />

      {/* Error overlay */}
      {error && (
        <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center p-4 z-20">
          <p className="text-red-500 mb-4">{error}</p>
          <Button onClick={restartVideo} variant="destructive">
            <RotateCcw className="mr-2 h-4 w-4" />
            Restart Video
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
