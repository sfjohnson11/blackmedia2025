"use client"

import { useEffect, useRef } from "react"

interface SimpleTestPlayerProps {
  videoUrl: string
  shouldLoop: boolean
}

export default function SimpleTestPlayer({ videoUrl, shouldLoop }: SimpleTestPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    const video = videoRef.current
    if (video && videoUrl) {
      console.log(`SimpleTestPlayer: Loading ${videoUrl}, Loop: ${shouldLoop}`)
      video.src = videoUrl
      video.loop = shouldLoop
      video.load()
      video.play().catch((e) => console.error("Play failed:", e))
    }
  }, [videoUrl, shouldLoop])

  return (
    <div className="w-full aspect-video bg-black">
      <video
        ref={videoRef}
        className="w-full h-full"
        controls
        autoPlay
        playsInline
        onLoadStart={() => console.log("SimpleTestPlayer: Load start")}
        onCanPlay={() => console.log("SimpleTestPlayer: Can play")}
        onPlaying={() => console.log("SimpleTestPlayer: Playing")}
        onEnded={() => console.log("SimpleTestPlayer: Ended")}
        onError={(e) => console.error("SimpleTestPlayer: Error", e)}
      >
        Your browser does not support the video tag.
      </video>
    </div>
  )
}
