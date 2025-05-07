'use client'

import React, { useRef, useEffect } from 'react'

interface VideoPlayerProps {
  src: string
  poster?: string
}

export default function VideoPlayer({ src, poster }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    const video = videoRef.current
    if (video) {
      video.volume = 1.0
      video.controls = true
      video.autoplay = true
      video.playsInline = true
      video.muted = false

      const playPromise = video.play()
      if (playPromise !== undefined) {
        playPromise.catch((error) => {
          console.warn("Autoplay blocked until user interaction:", error)
        })
      }
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
      className="w-full bg-black flex justify-center items-center"
      style={{
        padding: '10px',
        overflow: 'hidden',
        maxHeight: '90vh',
      }}
    >
      <video
        ref={videoRef}
        src={src}
        poster={poster}
        controls
        className="w-full max-w-[100%] h-auto"
        style={{
          backgroundColor: 'black',
        }}
      >
        Your browser does not support the video tag.
      </video>
    </div>
  )
}
