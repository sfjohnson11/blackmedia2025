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

    // Optional: apply a CSS fix directly
    const style = document.createElement('style')
    style.innerHTML = `
      video::-webkit-media-controls {
        display: block !important;
        opacity: 1 !important;
        z-index: 1000 !important;
      }
    `
    document.head.appendChild(style)

    return () => {
      document.head.removeChild(style)
    }
  }, [])

  if (!src) {
    return (
      <div className="text-red-600 bg-black p-4 text-center">
        ⚠️ No video source found.
      </div>
    )
  }

  const isHLS = src.endsWith('.m3u8')

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
        crossOrigin="anonymous"
        style={{
          zIndex: 10,
          position: 'relative',
          backgroundColor: 'black',
          color: 'white',
          outline: 'none',
        }}
        className="w-full max-h-[90vh] object-contain"
      >
        <source src={src} type={isHLS ? 'application/vnd.apple.mpegurl' : 'video/mp4'} />
        Your browser does not support the video tag.
      </video>
    </div>
  )
}
