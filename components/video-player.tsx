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
      video.volume = 1
      video.controls = true
    }
  }, [])

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
        backgroundColor: 'black',
        width: '100%',
        height: 'auto',
        padding: '10px',
        position: 'relative',
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
        style={{
          zIndex: 10,
          position: 'relative',
        }}
        className="w-full max-h-[90vh] object-contain"
      >
        Your browser does not support the video tag.
      </video>
    </div>
  )
}
