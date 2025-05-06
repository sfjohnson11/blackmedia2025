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
      video.volume = 1 // make sure it's not muted
    }
  }, [])

  return (
    <div className="w-full bg-black p-4 flex justify-center items-center">
      <div className="max-w-[1280px] w-full">
        <video
          ref={videoRef}
          src={src}
          poster={poster}
          controls
          playsInline
          className="w-full h-auto object-contain bg-black rounded-md"
        />
      </div>
    </div>
  )
}
