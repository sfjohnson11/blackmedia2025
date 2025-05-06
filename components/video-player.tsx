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
      video.controls = true
      video.volume = 1
    }
  }, [])

  return (
    <div style={{ backgroundColor: 'black', width: '100%', height: 'auto', padding: '10px' }}>
      <video
        ref={videoRef}
        src={src}
        poster={poster}
        controls
        playsInline
        className="w-full max-h-[90vh] object-contain"
      >
        Your browser does not support the video tag.
      </video>
    </div>
  )
}
