"use client"

import type React from "react"
import { useEffect, useRef, useState, useCallback } from "react"
import { Loader2, AlertTriangle, RefreshCw, VolumeX } from "lucide-react" // Added VolumeX, Volume2
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
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showUnmuteOverlay, setShowUnmuteOverlay] = useState(false)

  const isStandbyVideo = currentProgram?.channel_id === STANDBY_PLACEHOLDER_ID

  useEffect(() => {
    setCurrentProgram(initialProgram)
    // When program changes, reset unmute overlay visibility until we know status
    setShowUnmuteOverlay(false)
  }, [initialProgram])

  const updateMutedOverlayStatus = useCallback(() => {
    if (videoRef.current) {
      // Show overlay if video is trying to play (not paused) but is muted
      if (!videoRef.current.paused && videoRef.current.muted) {
        setShowUnmuteOverlay(true)
      } else {
        setShowUnmuteOverlay(false)
      }
    }
  }, [])

  useEffect(() => {
    setError(null)
    if (currentProgram && currentProgram.mp4_url) {
      const fullUrl = getFullUrl(currentProgram.mp4_url)
      if (fullUrl !== videoSrc) {
        setVideoSrc(fullUrl)
        setIsLoading(true)
        console.log(`VideoPlayer: Loading video: ${currentProgram.title} (${fullUrl}) - Standby: ${isStandbyVideo}`)
      } else {
        setIsLoading(false)
      }
    } else {
      setVideoSrc("")
      setIsLoading(false)
      console.log("VideoPlayer: No current program or mp4_url.")
    }
  }, [currentProgram, videoSrc])

  useEffect(() => {
    const videoElement = videoRef.current
    if (!videoElement) return

    const handlePlayAttempt = () => {
      videoElement
        .play()
        .then(() => {
          console.log(`VideoPlayer: Play initiated. Muted: ${videoElement.muted}, Volume: ${videoElement.volume}`)
          updateMutedOverlayStatus()
        })
        .catch((playError) => {
          console.error("VideoPlayer: Error attempting to play video:", playError)
          if (playError.name === "NotAllowedError") {
            setError("Autoplay may be blocked. Use controls or click to play/unmute.")
            // Even if play is blocked, it might be because it's trying to play with sound.
            // If it's muted, still show the unmute overlay.
            if (videoElement.muted) setShowUnmuteOverlay(true)
          } else {
            setError("Could not play video. Click to retry.")
          }
          setIsLoading(false)
          if (onError) onError(`Playback error: ${playError.name} - ${playError.message}`)
        })
    }

    if (videoSrc) {
      console.log(
        `VideoPlayer: Effect for videoSrc change. Current src: ${videoElement.currentSrc}, new videoSrc: ${videoSrc}`,
      )
      if (videoElement.currentSrc !== videoSrc) {
        console.log("VideoPlayer: Setting new src and loading.")
        videoElement.src = videoSrc
        videoElement.load() // Important to load new src
      }
      // Autoplay is on the video tag, but we can also call play here.
      // Browsers often require a user gesture for unmuted autoplay.
      // We'll attempt to play, and then check muted status.
      handlePlayAttempt()
    } else {
      console.log("VideoPlayer: videoSrc is empty, pausing and removing src.")
      videoElement.pause()
      videoElement.removeAttribute("src")
      videoElement.load()
      setShowUnmuteOverlay(false) // No video, no unmute overlay
    }
  }, [videoSrc, onError, updateMutedOverlayStatus]) // videoRef.current is not a reactive dependency

  const handleCanPlay = useCallback(() => {
    setIsLoading(false)
    setError(null)
    if (videoRef.current) {
      console.log(
        `VideoPlayer: Event CanPlay. Muted: ${videoRef.current.muted}, Loop: ${videoRef.current.loop}, Volume: ${videoRef.current.volume}`,
      )
      if (isStandbyVideo) {
        videoRef.current.loop = true
        console.log("VideoPlayer: Loop enabled for standby video.")
      }
      // Video might start playing automatically due to `autoPlay` attribute
      // or we might have called play(). Check muted status.
      updateMutedOverlayStatus()
      // Attempt to play again if it's paused and should be playing
      if (videoRef.current.paused) {
        videoRef.current
          .play()
          .then(updateMutedOverlayStatus)
          .catch((e) => console.warn("CanPlay play attempt failed", e))
      }
    }
  }, [isStandbyVideo, updateMutedOverlayStatus])

  const handleVolumeChange = useCallback(() => {
    if (videoRef.current) {
      console.log(
        `VideoPlayer: Event VolumeChange. Muted: ${videoRef.current.muted}, Volume: ${videoRef.current.volume}`,
      )
      updateMutedOverlayStatus() // Hide overlay if user unmutes via native controls
    }
  }, [updateMutedOverlayStatus])

  const handlePlayEvent = useCallback(() => {
    // Fired when playback actually begins or resumes
    console.log("VideoPlayer: Event Play. Video is playing.")
    setIsLoading(false) // Ensure loading is false when play starts
    updateMutedOverlayStatus()
  }, [updateMutedOverlayStatus])

  const handlePauseEvent = useCallback(() => {
    console.log("VideoPlayer: Event Pause. Video is paused.")
    // Don't show unmute overlay if intentionally paused
    // setShowUnmuteOverlay(false); // Or only if videoRef.current.muted is false
    if (videoRef.current && !videoRef.current.muted) {
      setShowUnmuteOverlay(false)
    }
  }, [])

  const handleVideoError = (e: React.SyntheticEvent<HTMLVideoElement, Event>) => {
    // ... (error handling code remains the same as previous version)
    const videoElement = e.currentTarget
    let errorMsg = "An unknown video error occurred."
    if (videoElement.error) {
      switch (videoElement.error.code) {
        case MediaError.MEDIA_ERR_ABORTED:
          errorMsg = "Video playback aborted."
          break
        case MediaError.MEDIA_ERR_NETWORK:
          errorMsg = "A network error caused the video to fail."
          break
        case MediaError.MEDIA_ERR_DECODE:
          errorMsg = "Video playback aborted due to a decoding error."
          break
        case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED:
          errorMsg = "The video format is not supported or the file could not be found."
          if (isStandbyVideo) errorMsg += " (Check standby_blacktruthtv.mp4)"
          break
        default:
          errorMsg = `Video error code: ${videoElement.error.code}`
      }
    }
    console.error("VideoPlayer: Event VideoError:", errorMsg, "Src:", videoSrc, "Raw Error:", videoElement.error)
    setError(errorMsg)
    setIsLoading(false)
    setShowUnmuteOverlay(false)
    if (onError) onError(errorMsg)
  }

  const handleEnded = () => {
    // ... (ended handling code remains the same)
    if (videoRef.current) {
      console.log(`VideoPlayer: Event Ended. IsStandbyVideo: ${isStandbyVideo}, Loop: ${videoRef.current.loop}`)
    }
    if (!isStandbyVideo && onProgramEnd) {
      console.log("VideoPlayer: Program ended:", currentProgram?.title)
      onProgramEnd()
    }
  }

  const retryLoad = () => {
    // ... (retry load code remains the same)
    if (currentProgram && currentProgram.mp4_url) {
      setError(null)
      setIsLoading(true)
      setShowUnmuteOverlay(false)
      const originalSrc = getFullUrl(currentProgram.mp4_url)
      setVideoSrc("")
      setTimeout(() => setVideoSrc(originalSrc), 50)
    }
  }

  const handleUnmuteClick = () => {
    if (videoRef.current) {
      videoRef.current.muted = false
      // Attempt to play again in case it was paused due to mute restrictions
      videoRef.current.play().catch((e) => console.warn("Error playing after manual unmute", e))
      setShowUnmuteOverlay(false)
    }
  }

  return (
    <div className="w-full aspect-video bg-black relative">
      <video
        ref={videoRef}
        key={videoSrc || "no-video-yet"}
        className="w-full h-full"
        controls
        autoPlay
        playsInline
        loop={isStandbyVideo}
        muted // Start muted, try to unmute programmatically or let user do it.
        // Or set to false and let browser handle it, then show overlay. Let's try starting muted.
        onCanPlay={handleCanPlay}
        onError={handleVideoError}
        onEnded={handleEnded}
        onVolumeChange={handleVolumeChange}
        onPlay={handlePlayEvent}
        onPause={handlePauseEvent}
        onLoadStart={() => {
          console.log("VideoPlayer: Event LoadStart.")
          setIsLoading(true)
          setError(null)
          setShowUnmuteOverlay(false)
        }}
        poster={currentProgram?.poster_url ? getFullUrl(currentProgram.poster_url) : undefined}
      >
        Your browser does not support the video tag.
      </video>

      {/* Unmute Overlay */}
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

      {/* Loading State Overlay (only if not showing unmute overlay) */}
      {isLoading && videoSrc && !showUnmuteOverlay && (
        <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center text-white z-10">
          <Loader2 className="h-12 w-12 animate-spin text-red-600" />
          <p className="ml-4">Loading Video...</p>
        </div>
      )}

      {/* Error State Overlay (only if not showing unmute overlay) */}
      {error && !showUnmuteOverlay && (
        <div className="absolute inset-0 bg-black bg-opacity-80 flex flex-col items-center justify-center text-white p-4 z-10">
          <AlertTriangle className="h-12 w-12 text-yellow-400 mb-4" />
          <p className="text-center mb-2">Error: {error}</p>
          {currentProgram && currentProgram.mp4_url && (
            <button
              onClick={retryLoad}
              className="mt-2 px-4 py-2 bg-red-600 hover:bg-red-700 rounded text-white flex items-center"
            >
              <RefreshCw className="h-4 w-4 mr-2" /> Retry
            </button>
          )}
        </div>
      )}

      {/* No Video Source State (but not an error, e.g. waiting for program) (only if not showing unmute overlay) */}
      {!videoSrc && !isLoading && !error && !showUnmuteOverlay && (
        <div className="absolute inset-0 bg-black flex items-center justify-center text-white z-10">
          <Loader2 className="h-12 w-12 animate-spin text-gray-500" />
          <p className="ml-4">{initialProgram === null ? "No program scheduled." : "Checking schedule..."}</p>
        </div>
      )}
    </div>
  )
}
