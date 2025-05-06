'use client'

import React, { useRef, useEffect } from 'react'

interface VideoPlayerProps {
  channel: any
  initialProgram: any
  upcomingPrograms: any[]
}

export function VideoPlayer({ channel, initialProgram, upcomingPrograms }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)

  const getVideoUrl = (mp4Path: string) => {
    if (!mp4Path) return ''
    return `https://${process.env.NEXT_PUBLIC_SUPABASE_PROJECT_ID}.supabase.co/storage/v1/object/public/${channel.bucket}/${mp4Path}`
  }

  const src = getVideoUrl(initialProgram?.video_url)

  useEffect(() => {
    const video = videoRef.current
    if (video) {
      video.volume = 1
      video.controls = true
    }
  }, [src])

  if (!src) {
    return (
      <div className="text-red-600 bg-black p-4 text-center">
        ⚠️ No video source found for this channel.
      </div>
    )
  }

  return (
    <div style={{ backgroundColor: 'black', width: '100%', height: 'auto', padding: '10px' }}>
      <video
        ref={videoRef}
        src={src}
        poster={initialProgram?.poster_url}
        controls
        playsInline
        className="w-full max-h-[90vh] object-contain"
      >
        Your browser does not support the video tag.
      </video>
    </div>
  )
}
