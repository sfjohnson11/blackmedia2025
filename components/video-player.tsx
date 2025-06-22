"use client"

import type React from "react"
import { useEffect, useRef, useState, useCallback } from "react"
import { Loader2, AlertTriangle, RefreshCw, VolumeX } from "lucide-react"
import { getFullUrl, STANDBY_PLACEHOLDER_ID } from "@/lib/supabase"
import type { Program } from "@/types"

interface VideoPlayerProps {
  initialProgram: Program | null
  onProgramEnd?: () => void
  onError?: (error: string) => void
}

export default function VideoPlayer({ initialProgram, onProgramEnd, onError }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [currentProgram, setCurrentProgram] = useState<Program | null>(initialProgram)
  const [videoSrc, setVideoSrc] = useState<string>("")
  const [isLoading, setIsLoading] = useState(true) // Start true if we expect a program
  const [error, setError] = useState<string | null>(null)
  const [showUnmuteOverlay, setShowUnmuteOverlay] = useState(false)

  const isStandbyVideo = currentProgram?.channel_id === STANDBY_PLACEHOLDER_ID

  // Effect 1: Update currentProgram and videoSrc when initialProgram changes
  useEffect(() => {
    console.log("VideoPlayer Effect 1: initialProgram changed", initialProgram)
    setCurrentProgram(initialProgram)
    setShowUnmuteOverlay(false) // Reset overlay
    setError(null) // Reset error

    if (initialProgram && initialProgram.mp4_url) {
      const newSrc = getFullUrl(initialProgram.mp4_url)
      console.log(
        `VideoPlayer Effect 1: New video source will be: ${newSrc} (Standby: ${initialProgram?.channel_id === STANDBY_PLACEHOLDER_ID})`,
      )
      setVideoSrc(newSrc)
      setIsLoading(true) // Set loading true when src changes
    } else {
      console.log("VideoPlayer Effect 1: No initialProgram or mp4_url, clearing videoSrc.")
      setVideoSrc("")
      setIsLoading(false) // No src, not loading
    }
  }, [initialProgram])

  // Effect 2: Manage video element when videoSrc changes (key for re-mount)
  // We are relying more on the `key` prop on the video element to handle re-initialization
  // when videoSrc changes. Programmatic `load()` and `play()` are mainly in event handlers now.

  const updateMutedOverlayStatus = useCallback(() => {
    if (videoRef.current) {
      const isActuallyPlaying = videoRef.current.currentTime > 0 && !videoRef.current.paused && !videoRef.current.ended
      if (isActuallyPlaying && videoRef.current.muted) {
        setShowUnmuteOverlay(true)
        console.log("VideoPlayer: updateMutedOverlayStatus - Showing unmute overlay.")
      } else {
        setShowUnmuteOverlay(false)
        console.log("VideoPlayer: updateMutedOverlayStatus - Hiding unmute overlay.")
      }
    }
  }, [])

  const handleCanPlay = useCallback(() => {
    setIsLoading(false)
    setError(null)
    if (videoRef.current) {
      console.log(
        `VideoPlayer: Event CanPlay. Muted: ${videoRef.current.muted}, Loop: ${videoRef.current.loop}, Volume: ${videoRef.current.volume}, Autoplay: ${videoRef.current.autoplay}, ReadyState: ${videoRef.current.readyState}`,
      )
      // Attempt to play if autoplay didn't kick in or was blocked
      // Browsers are more likely to allow play() in an event handler like onCanPlay
      videoRef.current
        .play()
        .then(() => {
          console.log("VideoPlayer: Play initiated successfully from onCanPlay.")
          updateMutedOverlayStatus()
        })
        .catch((err) => {
          console.warn(
            "VideoPlayer: Play attempt from onCanPlay failed. This might be due to autoplay restrictions.",
            err,
          )
          // If play fails and it's muted, it's a strong candidate for the unmute overlay
          if (videoRef.current?.muted) {
            setShowUnmuteOverlay(true)
          }
          // If error is NotAllowedError, it's likely an autoplay policy issue
          if (err.name === "NotAllowedError") {
            setError("Autoplay was blocked. Click the video or unmute button to play.")
          }
        })
    }
  }, [updateMutedOverlayStatus])

  const handlePlayEvent = useCallback(() => {
    console.log("VideoPlayer: Event Play. Video is playing.")
    setIsLoading(false) // Video is playing, so not loading
    updateMutedOverlayStatus()
  }, [updateMutedOverlayStatus])

  const handlePauseEvent = useCallback(() => {
    console.log("VideoPlayer: Event Pause. Video is paused.")
    // Don't show unmute overlay if user manually paused it, unless it's also muted
    if (videoRef.current && !videoRef.current.muted) {
      setShowUnmuteOverlay(false)
    }
  }, [])

  const handleVolumeChange = useCallback(() => {
    if (videoRef.current) {
      console.log(
        `VideoPlayer: Event VolumeChange. Muted: ${videoRef.current.muted}, Volume: ${videoRef.current.volume}`,
      )
      updateMutedOverlayStatus()
    }
  }, [updateMutedOverlayStatus])

  const handleVideoError = (e: React.SyntheticEvent<HTMLVideoElement, Event>) => {
    const videoElement = e.currentTarget
    let errorMsg = "An unknown video error occurred."
    if (videoElement.error) {
      switch (videoElement.error.code) {
        case MediaError.MEDIA_ERR_ABORTED:
          errorMsg = "Video playback aborted by user or script."
          break
        case MediaError.MEDIA_ERR_NETWORK:
          errorMsg = "A network error caused video download to fail."
          break
        case MediaError.MEDIA_ERR_DECODE:
          errorMsg = "Video playback aborted due to a decoding error."
          break
        case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED:
          errorMsg = "Video format not supported or source unavailable."
          break
        default:
          errorMsg = `Video error code: ${videoElement.error.code}.`
      }
    }
    console.error("VideoPlayer: Event VideoError:", errorMsg, "Src:", videoSrc, "Raw Error:", videoElement.error)
    setError(errorMsg)
    setIsLoading(false)
    setShowUnmuteOverlay(false)
    if (onError) onError(errorMsg)
  }

  const handleEnded = () => {
    if (videoRef.current) {
      console.log(
        `VideoPlayer: Event Ended. IsStandbyVideo: ${isStandbyVideo}, Current Loop on element: ${videoRef.current.loop}`,
      )
      if (!isStandbyVideo && onProgramEnd) {
        console.log("VideoPlayer: Program ended (non-standby):", currentProgram?.title)
        onProgramEnd()
      } else if (isStandbyVideo) {
        console.log("VideoPlayer: Standby video ended. Native loop should handle restart.")
        // If native loop fails, a manual play() here can be a fallback,
        // but it's better if the `loop` attribute works.
        // videoRef.current.play().catch(e => console.warn("Standby ended, manual play attempt:", e));
      }
    }
  }

  const retryLoad = () => {
    if (initialProgram) {
      // Check initialProgram instead of currentProgram for retry
      console.log("VideoPlayer: RetryLoad called.")
      // Trigger re-evaluation of Effect 1 by "changing" initialProgram (or its key if it were an object from parent)
      // Forcing a re-render or re-evaluation of initialProgram related logic.
      // The simplest way is to re-set the videoSrc which will trigger video re-mount due to key change.
      setError(null)
      setIsLoading(true)
      setShowUnmuteOverlay(false)
      // Effectively re-triggers the first useEffect
      const newSrc = getFullUrl(initialProgram.mp4_url!) // Assume mp4_url exists if retrying
      setVideoSrc("") // Clear src briefly to ensure key change is effective
      setTimeout(() => setVideoSrc(newSrc), 50)
    }
  }

  const handleUnmuteClick = () => {
    if (videoRef.current) {
      videoRef.current.muted = false
      videoRef.current
        .play()
        .then(() => {
          console.log("VideoPlayer: Play initiated successfully after manual unmute.")
          setShowUnmuteOverlay(false)
        })
        .catch((err) => {
          console.warn("VideoPlayer: Play attempt after manual unmute failed.", err)
          setError("Could not play video even after unmute. Please try refreshing.")
        })
    }
  }

  // Render logic
  const videoKey = videoSrc || "no-src" // Changing the key will force React to re-mount the video element
  console.log(
    `VideoPlayer: Rendering. videoKey: ${videoKey}, isLoading: ${isLoading}, error: ${error}, showUnmuteOverlay: ${showUnmuteOverlay}, videoSrc: ${videoSrc}`,
  )

  if (!videoSrc && !isLoading && !error) {
    // This state is when there's genuinely no program to play
    return (
      <div className="w-full aspect-video bg-black flex items-center justify-center text-white">
        <p>{initialProgram === null ? "No program is currently scheduled." : "Preparing video..."}</p>
      </div>
    )
  }

  return (
    <div className="w-full aspect-video bg-black relative">
      {videoSrc && (
        <video
          ref={videoRef}
          key={videoKey} // CRITICAL: Re-mounts the video element when src changes
          className="w-full h-full"
          controls
          autoPlay
          playsInline
          loop={isStandbyVideo} // Rely on the HTML5 loop attribute
          muted // Start muted; user interaction or successful autoplay un-mutes
          onCanPlay={handleCanPlay}
          onError={handleVideoError}
          onEnded={handleEnded}
          onVolumeChange={handleVolumeChange}
          onPlay={handlePlayEvent}
          onPause={handlePauseEvent}
          onLoadStart={() => {
            console.log(`VideoPlayer: Event LoadStart for src: ${videoSrc}`)
            setIsLoading(true)
            setError(null) // Clear previous errors on new load
            setShowUnmuteOverlay(false)
          }}
          onLoadedData={() => {
            // This event is a good indicator that some data has loaded
            console.log(`VideoPlayer: Event LoadedData. ReadyState: ${videoRef.current?.readyState}`)
            // setIsLoading(false); // Can set loading false here or in onCanPlay
          }}
          poster={currentProgram?.poster_url ? getFullUrl(currentProgram.poster_url) : undefined}
        >
          Your browser does not support the video tag.
        </video>
      )}

      {showUnmuteOverlay && (
        <button
          onClick={handleUnmuteClick}
          className="absolute inset-0 flex flex-col items-center justify-center bg-black bg-opacity-75 z-20 text-white cursor-pointer"
          aria-label="Tap to unmute video"
        >
          <VolumeX className="w-16 h-16 sm:w-20 sm:h-20 mb-2 sm:mb-4 text-gray-300" />
          <span className="text-xl sm:text-2xl font-semibold">Tap to Unmute</span>
        </button>
      )}

      {isLoading && videoSrc && !showUnmuteOverlay && (
        <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center text-white z-10">
          <Loader2 className="h-12 w-12 animate-spin text-red-600" />
          <p className="ml-4">Loading Video...</p>
        </div>
      )}

      {error && !showUnmuteOverlay && (
        <div className="absolute inset-0 bg-black bg-opacity-80 flex flex-col items-center justify-center text-white p-4 z-10">
          <AlertTriangle className="h-12 w-12 text-yellow-400 mb-4" />
          <p className="text-center mb-2">Error: {error}</p>
          {initialProgram && initialProgram.mp4_url && (
            <button
              onClick={retryLoad}
              className="mt-2 px-4 py-2 bg-red-600 hover:bg-red-700 rounded text-white flex items-center"
            >
              <RefreshCw className="h-4 w-4 mr-2" /> Retry
            </button>
          )}
        </div>
      )}

      {/* Fallback for when videoSrc is empty but we are not explicitly in an error or loading state for it */}
      {!videoSrc && isLoading && !error && !showUnmuteOverlay && (
        <div className="absolute inset-0 bg-black flex items-center justify-center text-white z-10">
          <Loader2 className="h-12 w-12 animate-spin text-gray-500" />
          <p className="ml-4">Checking schedule...</p>
        </div>
      )}
    </div>
  )
}
