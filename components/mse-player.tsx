"use client"

import { useEffect, useRef } from "react"

interface MsePlayerProps {
  src: string
  poster?: string
}

export default function MsePlayer({ src, poster }: MsePlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    const video = videoRef.current
    if (!video) {
      console.warn("MsePlayer (Direct): No video element found.")
      return
    }

    if (!src) {
      console.warn("MsePlayer (Direct): No src provided. Clearing video src.")
      video.removeAttribute("src") // Clear src if it's empty
      video.load() // Important to call load after changing src or removing it
      return
    }

    console.log("MsePlayer (Direct): Setting video src directly to:", src)
    video.src = src
    video.load() // Call load after setting new src
    video
      .play()
      .then(() => {
        console.log("MsePlayer (Direct): Playback started for:", src)
      })
      .catch((error) => {
        console.error("MsePlayer (Direct): Error attempting to play video:", error, "Src:", src)
      })

    // It's good practice to clean up the src when the component unmounts or src changes
    // to prevent the video from continuing to load/play in the background if the
    // component is quickly re-rendered with a different src or unmounted.
    return () => {
      if (video) {
        console.log("MsePlayer (Direct): Cleanup - pausing video and removing src:", video.src)
        video.pause()
        video.removeAttribute("src")
        video.load() // This helps ensure resources are released
      }
    }
  }, [src]) // Re-run when src changes

  return (
    <div className="w-full aspect-video bg-black">
      <video
        ref={videoRef}
        poster={poster}
        controls
        autoPlay
        playsInline
        muted // Muting is highly recommended for autoplay success
        className="w-full h-full object-contain"
        onLoadedMetadata={() =>
          console.log("MsePlayer (Direct): Video onLoadedMetadata event. Src:", videoRef.current?.currentSrc)
        }
        onCanPlay={() => console.log("MsePlayer (Direct): Video onCanPlay event. Src:", videoRef.current?.currentSrc)}
        onPlaying={() => console.log("MsePlayer (Direct): Video onPlaying event. Src:", videoRef.current?.currentSrc)}
        onWaiting={() => console.log("MsePlayer (Direct): Video onWaiting event. Src:", videoRef.current?.currentSrc)}
        onStalled={() => console.log("MsePlayer (Direct): Video onStalled event. Src:", videoRef.current?.currentSrc)}
        onError={(e) => {
          const videoElement = e.target as HTMLVideoElement
          let errorDetails = "Unknown error"
          if (videoElement.error) {
            switch (videoElement.error.code) {
              case videoElement.error.MEDIA_ERR_ABORTED:
                errorDetails = "MEDIA_ERR_ABORTED"
                break
              case videoElement.error.MEDIA_ERR_NETWORK:
                errorDetails = "MEDIA_ERR_NETWORK"
                break
              case videoElement.error.MEDIA_ERR_DECODE:
                errorDetails = "MEDIA_ERR_DECODE"
                break
              case videoElement.error.MEDIA_ERR_SRC_NOT_SUPPORTED:
                errorDetails = "MEDIA_ERR_SRC_NOT_SUPPORTED (Format error or source not supported)"
                break
              default:
                errorDetails = `Unknown error code: ${videoElement.error.code}`
            }
          }
          console.error(
            "MsePlayer (Direct): Video element reported an error. Details:",
            errorDetails,
            "Current src:",
            videoElement.currentSrc,
            "Error object:",
            videoElement.error,
          )
        }}
      >
        Your browser does not support the video tag.
      </video>
    </div>
  )
}
