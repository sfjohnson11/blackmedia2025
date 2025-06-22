"use client"

import { type SyntheticEvent, useRef, useEffect, useState } from "react"
import { AlertTriangle, Loader2, VolumeX } from "lucide-react" // Added VolumeX and Volume2

interface VideoPlayerProps {
  src: string | undefined
  poster?: string
  isStandby: boolean
  programTitle?: string
  onVideoEnded?: () => void
}

type PlayerState = "idle" | "loading" | "playing" | "stalled" | "error"

export default function VideoPlayer({ src, poster, isStandby, programTitle, onVideoEnded }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [playerState, setPlayerState] = useState<PlayerState>("idle")
  const [isUserMuted, setIsUserMuted] = useState(true) // Video starts muted by user state
  const [videoKey, setVideoKey] = useState(0)

  // Effect to handle src changes
  useEffect(() => {
    if (src) {
      setPlayerState("loading")
      // setIsUserMuted(true); // Reset to muted for new videos if desired, or let it persist user's choice
      setVideoKey((prevKey) => prevKey + 1)
    } else {
      setPlayerState("idle")
    }
  }, [src])

  // Effect to manage video element based on src and videoKey
  useEffect(() => {
    const video = videoRef.current
    if (!video || !src) return

    if (video.currentSrc !== src) {
      video.src = src
      video.load()
      // Autoplay will be attempted; browser policy dictates if it needs to be muted
      video.play().catch((e) => console.warn(`Autoplay initially prevented for ${src}:`, e))
    }
  }, [videoKey, src])

  // Effect to control video's muted state from React state
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.muted = isUserMuted
    }
  }, [isUserMuted])

  // Effect to sync isUserMuted state with video element's muted property (e.g., if user uses native controls)
  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    const handleVolumeChange = () => {
      if (video.muted !== isUserMuted) {
        setIsUserMuted(video.muted)
      }
    }
    video.addEventListener("volumechange", handleVolumeChange)
    return () => {
      video.removeEventListener("volumechange", handleVolumeChange)
    }
  }, [videoKey, isUserMuted]) // Re-attach if videoKey changes

  const handleVideoTap = () => {
    if (isUserMuted && videoRef.current) {
      setIsUserMuted(false) // This will trigger the useEffect to set videoRef.current.muted
      videoRef.current.play().catch((e) => console.warn("Play after tap-to-unmute failed:", e))
      console.log("VideoPlayer: User tapped, unmuting video.")
    }
  }

  const handleVideoError = (e: SyntheticEvent<HTMLVideoElement, Event>) => {
    console.error(`Video error for "${programTitle}"`, e.currentTarget.error)
    setPlayerState("error")
  }

  const showLoadingIndicator = playerState === "loading" || playerState === "stalled"
  const showErrorOverlay = playerState === "error"
  const showTapToUnmuteIndicator =
    isUserMuted &&
    (playerState === "playing" || playerState === "stalled") &&
    !showErrorOverlay &&
    !showLoadingIndicator

  return (
    <div className="w-full aspect-video bg-black relative" onClick={handleVideoTap}>
      <video
        key={videoKey}
        ref={videoRef}
        className="w-full h-full object-contain"
        controls
        autoPlay
        muted={isUserMuted} // Controlled by isUserMuted state
        playsInline
        loop={isStandby}
        poster={poster}
        crossOrigin="anonymous"
        onWaiting={() => setPlayerState("stalled")}
        onPlaying={() => setPlayerState("playing")}
        onCanPlay={() => {
          if (playerState === "loading" || playerState === "stalled") {
            setPlayerState("playing")
          }
        }}
        onError={handleVideoError}
        onEnded={onVideoEnded}
      >
        Your browser does not support the video tag.
      </video>

      {showTapToUnmuteIndicator && (
        <div className="absolute top-4 left-4 bg-black bg-opacity-70 text-white p-2 px-3 rounded-lg flex items-center pointer-events-none text-sm">
          <VolumeX className="h-5 w-5 mr-2" />
          <span>Tap for sound</span>
        </div>
      )}

      {showLoadingIndicator && (
        <div className="absolute inset-0 bg-black bg-opacity-50 flex flex-col items-center justify-center text-white z-10 pointer-events-none">
          <Loader2 className="h-12 w-12 animate-spin mb-4" />
          <p className="text-lg font-semibold">{playerState === "stalled" ? "Buffering..." : "Video is loading..."}</p>
        </div>
      )}

      {showErrorOverlay && (
        <div className="absolute inset-0 bg-black bg-opacity-75 flex flex-col items-center justify-center text-white p-4 z-20">
          <AlertTriangle className="h-10 w-10 text-yellow-400 mb-3" />
          <p className="text-center text-sm font-semibold">A video playback error occurred.</p>
        </div>
      )}
    </div>
  )
}
