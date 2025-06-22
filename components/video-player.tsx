"use client"

import { type SyntheticEvent, useRef, useEffect, useState } from "react"
import Hls from "hls.js"
import { AlertTriangle, Loader2, Tv2, VolumeX } from "lucide-react" // Added Tv2

interface VideoPlayerProps {
  src: string | undefined
  poster?: string
  isStandby: boolean // True if the video is a standby VOD that should loop
  programTitle?: string
  onVideoEnded?: () => void
  isPrimaryLiveStream?: boolean // Is this the main HLS feed for a channel like Ch21?
  onPrimaryLiveStreamError?: () => void // Callback if the primary HLS feed fails
  showNoLiveNotice?: boolean // New prop for Channel 21 notice
}

type PlayerState = "idle" | "loading" | "playing" | "stalled" | "error"

export default function VideoPlayer({
  src,
  poster,
  isStandby,
  programTitle,
  onVideoEnded,
  isPrimaryLiveStream,
  onPrimaryLiveStreamError,
  showNoLiveNotice, // Destructure new prop
}: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const hlsInstanceRef = useRef<Hls | null>(null)
  const [playerState, setPlayerState] = useState<PlayerState>("idle")
  const [isUserMuted, setIsUserMuted] = useState(true)

  useEffect(() => {
    if (src) {
      setPlayerState("loading")
    } else {
      setPlayerState("idle")
    }
  }, [src])

  useEffect(() => {
    const videoElement = videoRef.current
    if (!videoElement) return

    if (hlsInstanceRef.current) {
      hlsInstanceRef.current.destroy()
      hlsInstanceRef.current = null
    }

    if (!src) {
      videoElement.removeAttribute("src")
      setPlayerState("idle")
      return
    }

    if (src.endsWith(".m3u8")) {
      if (Hls.isSupported()) {
        const hls = new Hls({})
        hlsInstanceRef.current = hls
        hls.loadSource(src)
        hls.attachMedia(videoElement)
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          videoElement.play().catch((e) => console.warn(`HLS Autoplay for ${src} prevented:`, e))
        })
        hls.on(Hls.Events.ERROR, (event, data) => {
          console.error("VideoPlayer: HLS.js error:", data.type, data.details, data.fatal, "URL:", data.url || src)
          if (data.fatal) {
            if (isPrimaryLiveStream && onPrimaryLiveStreamError) {
              onPrimaryLiveStreamError()
            } else {
              setPlayerState("error")
            }
          }
        })
      } else if (videoElement.canPlayType("application/vnd.apple.mpegurl")) {
        videoElement.src = src
      } else {
        console.error("VideoPlayer: HLS is not supported in this browser.")
        if (isPrimaryLiveStream && onPrimaryLiveStreamError) {
          onPrimaryLiveStreamError()
        } else {
          setPlayerState("error")
        }
      }
    } else {
      videoElement.src = src
    }

    return () => {
      if (hlsInstanceRef.current) {
        hlsInstanceRef.current.destroy()
        hlsInstanceRef.current = null
      }
    }
  }, [src, isPrimaryLiveStream, onPrimaryLiveStreamError])

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.muted = isUserMuted
    }
  }, [isUserMuted])

  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    const handleVolumeChange = () => {
      if (video.muted !== isUserMuted) setIsUserMuted(video.muted)
    }
    video.addEventListener("volumechange", handleVolumeChange)
    return () => video.removeEventListener("volumechange", handleVolumeChange)
  }, [isUserMuted])

  const handleVideoTap = () => {
    if (isUserMuted && videoRef.current) {
      setIsUserMuted(false)
      videoRef.current.play().catch((e) => console.warn("Play after tap-to-unmute failed:", e))
    }
  }

  const handleNativeVideoError = (e: SyntheticEvent<HTMLVideoElement, Event>) => {
    console.error(`VideoPlayer: Native video element error for "${programTitle}"`, e.currentTarget.error)
    if (!(isPrimaryLiveStream && hlsInstanceRef.current)) {
      setPlayerState("error")
    }
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
        ref={videoRef}
        className="w-full h-full object-contain"
        controls
        autoPlay
        muted={isUserMuted}
        playsInline
        loop={isStandby} // This should make standby videos loop
        poster={poster}
        crossOrigin="anonymous"
        onWaiting={() => setPlayerState("stalled")}
        onPlaying={() => setPlayerState("playing")}
        onCanPlay={() => {
          if (playerState === "loading" || playerState === "stalled") {
            setPlayerState("playing")
          }
        }}
        onError={handleNativeVideoError}
        onEnded={() => {
          // Only call onVideoEnded if it's NOT a standby video
          // and the handler exists. The 'loop' attribute handles standby.
          if (!isStandby && onVideoEnded) {
            onVideoEnded()
          }
        }}
      >
        Your browser does not support the video tag.
      </video>

      {showTapToUnmuteIndicator && (
        <div className="absolute top-4 left-4 bg-black bg-opacity-70 text-white p-2 px-3 rounded-lg flex items-center pointer-events-none text-sm z-10">
          <VolumeX className="h-5 w-5 mr-2" />
          <span>Tap for sound</span>
        </div>
      )}

      {showLoadingIndicator &&
        !showNoLiveNotice && ( // Don't show loading if no live notice is up
          <div className="absolute inset-0 bg-black bg-opacity-50 flex flex-col items-center justify-center text-white z-10 pointer-events-none">
            <Loader2 className="h-12 w-12 animate-spin mb-4" />
            <p className="text-lg font-semibold">
              {playerState === "stalled" ? "Buffering..." : "Video is loading..."}
            </p>
          </div>
        )}

      {showErrorOverlay &&
        !showNoLiveNotice && ( // Don't show error if no live notice is up (as no live is a specific state)
          <div className="absolute inset-0 bg-black bg-opacity-75 flex flex-col items-center justify-center text-white p-4 z-20">
            <AlertTriangle className="h-10 w-10 text-yellow-400 mb-3" />
            <p className="text-center text-sm font-semibold">A video playback error occurred.</p>
            <p className="text-xs mt-1">Please check the stream or try again later.</p>
          </div>
        )}

      {showNoLiveNotice && ( // New overlay for "No live programming"
        <div className="absolute inset-0 bg-black bg-opacity-60 flex flex-col items-center justify-center text-white p-4 z-10 pointer-events-none">
          <Tv2 className="h-12 w-12 mb-4 text-gray-400" />
          <p className="text-lg font-semibold">No live programming at the moment.</p>
          <p className="text-sm text-gray-300">Standby content is playing.</p>
        </div>
      )}
    </div>
  )
}
