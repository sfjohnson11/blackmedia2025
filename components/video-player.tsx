"use client"
import { useEffect, useState, useCallback, useRef } from "react"
import ReactPlayer from "react-player/lazy" // Using lazy load for better performance
import { Loader2, AlertTriangle, RefreshCw, VolumeX } from "lucide-react"
import { getFullUrl, STANDBY_PLACEHOLDER_ID } from "@/lib/supabase"
import type { Program } from "@/types"

interface VideoPlayerProps {
  initialProgram: Program | null
  onProgramEnd?: () => void
  onError?: (error: string) => void // ReactPlayer has its own onError
}

export default function VideoPlayer({ initialProgram, onProgramEnd, onError: onParentError }: VideoPlayerProps) {
  const [currentProgram, setCurrentProgram] = useState<Program | null>(initialProgram)
  const [videoUrl, setVideoUrl] = useState<string>("")
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showUnmutePrompt, setShowUnmutePrompt] = useState(false)
  const [isPlaying, setIsPlaying] = useState(true) // Attempt to autoplay

  const playerRef = useRef<ReactPlayer>(null)

  const isStandbyVideo = currentProgram?.channel_id === STANDBY_PLACEHOLDER_ID

  useEffect(() => {
    console.log("VideoPlayer (ReactPlayer): initialProgram changed", initialProgram)
    setCurrentProgram(initialProgram)
    setError(null)
    setShowUnmutePrompt(false) // Reset prompt

    if (initialProgram && initialProgram.mp4_url) {
      const newUrl = getFullUrl(initialProgram.mp4_url)
      console.log(`VideoPlayer (ReactPlayer): New video URL: ${newUrl} (Standby: ${isStandbyVideo})`)
      setVideoUrl(newUrl)
      setIsLoading(true) // Start loading for new URL
      setIsPlaying(true) // Attempt to autoplay new source
    } else {
      console.log("VideoPlayer (ReactPlayer): No initialProgram or mp4_url, clearing videoUrl.")
      setVideoUrl("")
      setIsLoading(false)
    }
  }, [initialProgram, isStandbyVideo])

  const handleReady = useCallback(() => {
    console.log("VideoPlayer (ReactPlayer): Player is ready.")
    setIsLoading(false)
    // Check if browser muted autoplay
    if (playerRef.current && playerRef.current.getInternalPlayer()?.muted) {
      // Some browsers might allow autoplay but start it muted.
      // ReactPlayer's `playing` prop tries to handle autoplay.
      // If it's muted by browser, we show prompt.
      console.log("VideoPlayer (ReactPlayer): Player started muted by browser.")
      setShowUnmutePrompt(true)
    }
  }, [])

  const handlePlay = useCallback(() => {
    console.log("VideoPlayer (ReactPlayer): Play event.")
    setIsLoading(false) // No longer loading if playing
    setShowUnmutePrompt(false) // Hide prompt if playing (implies sound or user interaction)
    setIsPlaying(true)
  }, [])

  const handleBuffer = useCallback(() => {
    console.log("VideoPlayer (ReactPlayer): Buffering...")
    setIsLoading(true)
  }, [])

  const handleBufferEnd = useCallback(() => {
    console.log("VideoPlayer (ReactPlayer): Buffering ended.")
    setIsLoading(false)
  }, [])

  const handleEnded = useCallback(() => {
    console.log(`VideoPlayer (ReactPlayer): Ended. IsStandbyVideo: ${isStandbyVideo}`)
    if (!isStandbyVideo && onProgramEnd) {
      console.log("VideoPlayer (ReactPlayer): Program ended (non-standby):", currentProgram?.title)
      onProgramEnd()
    }
    // For standby, ReactPlayer's `loop` prop should handle it.
    // If it's a standby video and loop is true, it should restart automatically.
  }, [isStandbyVideo, onProgramEnd, currentProgram])

  const handleError = useCallback(
    (e: any, data?: any, hlsInstance?: any, hlsGlobal?: any) => {
      const errorMsg = `ReactPlayer Error: ${e?.type || e?.message || "Unknown error"}`
      console.error("VideoPlayer (ReactPlayer): Error event.", errorMsg, "Data:", data)
      setError(errorMsg)
      setIsLoading(false)
      setShowUnmutePrompt(false)
      if (onParentError) onParentError(errorMsg)
    },
    [onParentError],
  )

  const handleUnmuteClick = () => {
    // ReactPlayer doesn't have a direct unmute method if controlled by browser.
    // The `muted` prop on ReactPlayer can be set, but for autoplay restrictions,
    // user interaction is key. Clicking this overlay IS the interaction.
    // We'll toggle `playing` state to try and re-initiate play with sound.
    // Or, if we can control volume/muted state directly:
    // playerRef.current?.getInternalPlayer()?.unMute(); // This might not always work
    console.log("VideoPlayer (ReactPlayer): Unmute prompt clicked.")
    setShowUnmutePrompt(false)
    setIsPlaying(true) // Ensure playing is true
    // For some players, setting volume might unmute
    if (playerRef.current) {
      const internalPlayer = playerRef.current.getInternalPlayer()
      if (internalPlayer && typeof internalPlayer.setVolume === "function") {
        internalPlayer.setVolume(0.5) // Set to a default volume
      }
      if (internalPlayer && typeof internalPlayer.unmute === "function") {
        internalPlayer.unmute()
      } else if (internalPlayer && "muted" in internalPlayer) {
        ;(internalPlayer as HTMLVideoElement).muted = false
      }
    }
  }

  const retryLoad = () => {
    if (initialProgram) {
      console.log("VideoPlayer (ReactPlayer): RetryLoad called.")
      setError(null)
      setIsLoading(true)
      setShowUnmutePrompt(false)
      // Re-trigger useEffect for initialProgram
      const newUrl = getFullUrl(initialProgram.mp4_url!)
      setVideoUrl("") // Clear briefly
      setTimeout(() => {
        setVideoUrl(newUrl)
        setIsPlaying(true) // Attempt to play on retry
      }, 50)
    }
  }

  // Fallback if no video URL is set yet but we are not in an error state
  if (!videoUrl && !isLoading && !error) {
    return (
      <div className="w-full aspect-video bg-black flex items-center justify-center text-white">
        <p>{initialProgram === null ? "No program is currently scheduled." : "Preparing video..."}</p>
      </div>
    )
  }

  return (
    <div className="w-full aspect-video bg-black relative">
      {videoUrl ? (
        <ReactPlayer
          ref={playerRef}
          key={videoUrl} // Re-mounts when URL changes
          url={videoUrl}
          playing={isPlaying} // Controls playback state
          loop={isStandbyVideo} // Enable looping for standby videos
          controls // Show native player controls
          muted={showUnmutePrompt} // Start muted if prompt is shown, otherwise let `playing` handle it.
          // Or always start muted: `muted={true}` and let user unmute.
          // Let's try `muted={showUnmutePrompt}`. If prompt isn't shown, it will try to play unmuted.
          width="100%"
          height="100%"
          playsinline // Important for iOS
          onReady={handleReady}
          onPlay={handlePlay}
          onPause={() => {
            console.log("ReactPlayer: Pause event")
            setIsPlaying(false)
          }}
          onBuffer={handleBuffer}
          onBufferEnd={handleBufferEnd}
          onEnded={handleEnded}
          onError={handleError}
          config={{
            file: {
              attributes: {
                crossOrigin: "anonymous", // If needed for CORS with some sources
                // poster: currentProgram?.poster_url ? getFullUrl(currentProgram.poster_url) : undefined, // Poster can be set here
              },
            },
          }}
        />
      ) : null}

      {showUnmutePrompt && (
        <button
          onClick={handleUnmuteClick}
          className="absolute inset-0 flex flex-col items-center justify-center bg-black bg-opacity-75 z-20 text-white cursor-pointer"
          aria-label="Tap to unmute video"
        >
          <VolumeX className="w-16 h-16 sm:w-20 sm:h-20 mb-2 sm:mb-4 text-gray-300" />
          <span className="text-xl sm:text-2xl font-semibold">Tap to Unmute</span>
        </button>
      )}

      {isLoading && !showUnmutePrompt && (
        <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center text-white z-10">
          <Loader2 className="h-12 w-12 animate-spin text-red-600" />
          <p className="ml-4">Loading Video...</p>
        </div>
      )}

      {error && !showUnmutePrompt && (
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
    </div>
  )
}
