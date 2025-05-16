"use client"

import React, { useEffect, useRef } from "react"
import { getProgressFor } from "@/lib/continue"

interface VideoPlayerProps {
  src: string
  poster?: string
}

export default function VideoPlayer({ src, poster }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    video.volume = 1
    video.controls = true

    const progress = getProgressFor(src)
    const resumeTime = progress?.time

    if (resumeTime && typeof resumeTime === "number" && !isNaN(resumeTime)) {
      video.currentTime = resumeTime
    }

    video.play().catch(() => {})

    const saveProgress = () => {
      if (video && !video.paused) {
        localStorage.setItem(
          `video_progress_${src}`,
          JSON.stringify({ time: video.currentTime })
        )
      }
    }

    video.addEventListener("timeupdate", saveProgress)

    return () => {
      video.removeEventListener("timeupdate", saveProgress)
    }
  }, [src])

  if (!src) {
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
        src={src}
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
