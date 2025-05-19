"use client"

import React, { useRef, useEffect, useState } from "react"

interface VideoPlayerProps {
  src: string
  poster?: string
}

export default function VideoPlayer({ src, poster }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [videoSource, setVideoSource] = useState(src)

  // Automatically detect if it's a standby video based on filename
  const isStandby = videoSource.toLowerCase().includes("standby")

  useEffect(() => {
    if (src !== videoSource) {
      setVideoSource(src)
    }
  }, [src])

  useEffect(() => {
    const video = videoRef.current
    if (video) {
      video.load()
      video.volume = 1
      video.controls = true
      video.loop = isStandby // ✅ Enable loop for standby videos
      video.play().catch(() => {})
    }
  }, [videoSource, isStandby])

  if (!videoSource) {
    return (
      <div className="text-red-600 bg-black p-4 text-center">
        ⚠️ No video source found.
      </div>
    )
  }

  return (
    <div
      style={{
        backgroundColor: "black",
        width: "100%",
        height: "auto",
        padding: "10px",
        position: "relative",
        zIndex: 0,
      }}
    >
      <video
        ref={videoRef}
        src={videoSource}
        poster={poster}
        controls
        playsInline
        autoPlay
        className="w-full max-h-[90vh] object-contain"
      >
        Your browser does not support the video tag.
      </video>
    </div>
  )
}
