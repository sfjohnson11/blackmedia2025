'use client'

import React, { useRef, useEffect, useState } from 'react'

interface VideoPlayerProps {
  src: string
  poster?: string
}

export default function VideoPlayer({ src, poster }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [showStandby, setShowStandby] = useState(false)

  useEffect(() => {
    const video = videoRef.current
    if (video) {
      video.volume = 1
      video.controls = true
    }
  }, [])

  const handleEnded = () => {
    setShowStandby(true)
  }

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
        onEnded={handleEnded}
        className="w-full max-h-[90vh] object-contain"
        style={{
          zIndex: 10,
          position: 'relative',
          backgroundColor: 'black',
        }}
      >
        Your browser does not support the video tag.
      </video>

      {showStandby && (
        <div className="absolute inset-0 bg-black bg-opacity-90 flex items-center justify-center z-20">
          <div className="text-center text-yellow-400">
            <h2 className="text-2xl font-bold">Please Standby</h2>
            <p className="mt-2 text-white">The next program will begin shortly.</p>
          </div>
        </div>
      )}
    </div>
  )
}
