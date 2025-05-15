"use client"

import React, { useRef, useEffect, useState } from "react"

interface VideoPlayerProps {
  src: string
  poster?: string
}

const getStorageKey = (src: string) => `video_progress_${src}`

export default function VideoPlayer({ src, poster }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [videoSource, setVideoSource] = useState(src)

  useEffect(() => {
    if (src !== videoSource) {
      setVideoSource(src)
    }
  }, [src])

  useEffect(() => {
    const video = videoRef.current
    const key = getStorageKey(videoSource)

    if (video) {
      // Restore position if saved
      const saved = localStorage.getItem(key)
      if (saved) {
        const { progress, timestamp } = JSON.parse(saved)
        const recent = Date.now() - timestamp < 24 * 60 * 60 * 1000 // less than 24 hours
        if (recent) {
          video.currentTime = progress
        }
      }

      video.load()
      video.volume = 1
      video.controls = true
      video.play().catch(() => {})

      // Save progress every 10 seconds
      const handleTimeUpdate = () => {
        localStorage.setItem(
          key,
          JSON.stringify({
            progress: video.currentTime,
            timestamp: Date.now(),
          })
        )
      }

      video.addEventListener("timeupdate", handleTimeUpdate)

      return () => {
        video.removeEventListener("timeupdate", handleTimeUpdate)
      }
    }
  }, [videoSource])

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
