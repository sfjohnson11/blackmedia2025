'use client'

import React, { useRef, useEffect, useState } from 'react'

interface VideoPlayerProps {
  src: string
  poster?: string
  loop?: boolean // ✅ Accept loop prop
}

export default function VideoPlayer({ src, poster, loop = false }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [videoSource, setVideoSource] = useState(src)
  const [currentTime, setCurrentTime] = useState(new Date())

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date())
    }, 30000) // Check every 30 seconds

    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    if (src !== videoSource) {
      setVideoSource(src)
    }
  }, [src])

  useEffect(() => {
    const video = videoRef.current
    if (video) {
      video.volume = 1
      video.controls = true
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
        src={videoSource}
        poster={poster}
        controls
        playsInline
        autoPlay
        loop={loop} // ✅ Apply loop dynamically
        className="w-full max-h-[90vh] object-contain"
      >
        Your browser does not support the video tag.
      </video>
    </div>
  )
}
