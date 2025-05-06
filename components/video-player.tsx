'use client'

import React, { useRef, useEffect } from 'react'

export function VideoPlayer() {
  const videoRef = useRef<HTMLVideoElement>(null)

  // 🔒 Replace this with any known-good video path from your Supabase bucket
  const src = 'https://msllqpnxwbugvkpnquwx.supabase.co/storage/v1/object/public/channel21/thetruthaboutpower.mp4'

  useEffect(() => {
    const video = videoRef.current
    if (video) {
      video.volume = 1
      video.controls = true
    }
  }, [src])

  return (
    <div style={{ backgroundColor: 'black', width: '100%', height: 'auto', padding: '10px' }}>
      <video
        ref={videoRef}
        src={src}
        controls
        playsInline
        className="w-full max-h-[90vh] object-contain"
      >
        Your browser does not support the video tag.
      </video>
    </div>
  )
}
