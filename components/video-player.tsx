"use client"

import { type SyntheticEvent, useRef, useEffect, useState } from "react"
import { AlertTriangle, Loader2 } from "lucide-react"

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
  const [videoKey, setVideoKey] = useState(0)

  useEffect(() => {
    if (src) {
      setPlayerState("loading")
      setVideoKey((prevKey) => prevKey + 1)
    } else {
      setPlayerState("idle")
    }
  }, [src])

  useEffect(() => {
    const video = videoRef.current
    if (!video || !src) return

    if (video.currentSrc !== src) {
      video.src = src
      video.load()
      video.play().catch((e) => console.warn(`Autoplay prevented for ${src}:`, e))
    }
  }, [videoKey, src])

  const handleVideoError = (e: SyntheticEvent<HTMLVideoElement, Event>) => {
    console.error(`Video error for "${programTitle}"`, e.currentTarget.error)
    setPlayerState("error")
  }

  const showLoadingIndicator = playerState === "loading" || playerState === "stalled"
  const showErrorOverlay = playerState === "error"

  return (
    <div className="w-full aspect-video bg-black relative">
      <video
        key={videoKey}
        ref={videoRef}
        className="w-full h-full object-contain"
        controls
        autoPlay
        muted
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
