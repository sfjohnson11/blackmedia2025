"use client"

import { type SyntheticEvent, useRef, useEffect, useState } from "react"
import Hls from "hls.js"
import { AlertTriangle, Loader2, VolumeX } from "lucide-react"

interface VideoPlayerProps {
  src: string | undefined
  poster?: string
  isStandby: boolean // True if the video is a standby VOD that should loop
  programTitle?: string
  onVideoEnded?: () => void
  isPrimaryLiveStream?: boolean // Is this the main HLS feed for a channel like Ch21?
  onPrimaryLiveStreamError?: () => void // Callback if the primary HLS feed fails
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
}: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const hlsInstanceRef = useRef<Hls | null>(null)
  const [playerState, setPlayerState] = useState<PlayerState>("idle")
  const [isUserMuted, setIsUserMuted] = useState(true) // Start muted for autoplay policies

  // Effect to manage player state based on src prop
  useEffect(() => {
    if (src) {
      setPlayerState("loading")
      // When src changes, we might want to reset mute state, or persist user's choice.
      // For now, let's assume if src changes, it's a new video, and we should respect initial mute.
      // setIsUserMuted(true); // Uncomment if new videos should always start muted by default
    } else {
      setPlayerState("idle")
    }
  }, [src])

  // Effect to setup video source (HLS or MP4)
  // This runs when `src` changes or the component mounts (due to parent key change)
  useEffect(() => {
    const videoElement = videoRef.current
    if (!videoElement) return

    // Always destroy previous HLS instance if it exists
    if (hlsInstanceRef.current) {
      hlsInstanceRef.current.destroy()
      hlsInstanceRef.current = null
    }

    if (!src) {
      videoElement.removeAttribute("src") // Clear src if no src is provided
      setPlayerState("idle")
      return
    }

    if (src.endsWith(".m3u8")) {
      if (Hls.isSupported()) {
        const hls = new Hls({
          // Optional: Add HLS.js configurations here if needed
          // Example: enableWorker: true, lowLatencyMode: true (for LL-HLS)
          // xhrSetup: (xhr, url) => {
          //   // console.log("HLS XHR Setup for URL:", url);
          //   // If you needed to add custom headers or withCredentials:
          //   // xhr.withCredentials = true;
          // }
        })
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
              onPrimaryLiveStreamError() // Notify parent that the primary HLS stream failed
            } else {
              setPlayerState("error") // Generic error for other HLS streams
            }
          }
        })
      } else if (videoElement.canPlayType("application/vnd.apple.mpegurl")) {
        videoElement.src = src
        // Autoplay is handled by the video element's autoplay attribute
      } else {
        console.error("VideoPlayer: HLS is not supported in this browser.")
        if (isPrimaryLiveStream && onPrimaryLiveStreamError) {
          onPrimaryLiveStreamError() // Treat lack of HLS support as a failure for primary stream
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
  }, [src, isPrimaryLiveStream, onPrimaryLiveStreamError]) // Re-run when src changes

  // Effect to control video's muted state from React state
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.muted = isUserMuted
    }
  }, [isUserMuted])

  // Effect to sync isUserMuted state with video element's muted property
  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    const handleVolumeChange = () => {
      if (video.muted !== isUserMuted) setIsUserMuted(video.muted)
    }
    video.addEventListener("volumechange", handleVolumeChange)
    return () => video.removeEventListener("volumechange", handleVolumeChange)
  }, [isUserMuted]) // Only depends on isUserMuted

  const handleVideoTap = () => {
    if (isUserMuted && videoRef.current) {
      setIsUserMuted(false) // This will trigger the useEffect to set videoRef.current.muted
      videoRef.current.play().catch((e) => console.warn("Play after tap-to-unmute failed:", e))
    }
  }

  const handleNativeVideoError = (e: SyntheticEvent<HTMLVideoElement, Event>) => {
    // This handles errors from the <video> element itself, not HLS.js specific errors
    console.error(`VideoPlayer: Native video element error for "${programTitle}"`, e.currentTarget.error)
    // Avoid double-triggering if HLS already called onPrimaryLiveStreamError
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
        // The `key` prop is managed by the parent component (`WatchPage`)
        // to force re-mounts when a full player reset is needed.
        ref={videoRef}
        className="w-full h-full object-contain"
        controls
        autoPlay
        muted={isUserMuted} // Controlled by isUserMuted state
        playsInline
        loop={isStandby} // Loop for standby VODs, not for HLS live streams
        poster={poster}
        crossOrigin="anonymous" // Important for HLS and other cross-origin media
        onWaiting={() => setPlayerState("stalled")}
        onPlaying={() => setPlayerState("playing")}
        onCanPlay={() => {
          if (playerState === "loading" || playerState === "stalled") {
            setPlayerState("playing")
          }
        }}
        onError={handleNativeVideoError} // Native video errors
        onEnded={onVideoEnded}
      >
        Your browser does not support the video tag.
      </video>

      {showTapToUnmuteIndicator && (
        <div className="absolute top-4 left-4 bg-black bg-opacity-70 text-white p-2 px-3 rounded-lg flex items-center pointer-events-none text-sm z-10">
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
          <p className="text-xs mt-1">Please check the stream or try again later.</p>
        </div>
      )}
    </div>
  )
}
