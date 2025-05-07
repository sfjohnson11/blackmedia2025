'use client'

import React, { useRef, useState, useEffect } from 'react'

interface VideoPlayerProps {
  src: string
  poster?: string
}

export default function VideoPlayer({ src, poster }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [volume, setVolume] = useState(1)
  const [muted, setMuted] = useState(false)

  const togglePlay = () => {
    const video = videoRef.current
    if (!video) return
    if (video.paused) {
      video.play()
      setIsPlaying(true)
    } else {
      video.pause()
      setIsPlaying(false)
    }
  }

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const video = videoRef.current
    const newVolume = parseFloat(e.target.value)
    if (video) {
      video.volume = newVolume
      setVolume(newVolume)
    }
  }

  const toggleMute = () => {
    const video = videoRef.current
    if (!video) return
    video.muted = !video.muted
    setMuted(video.muted)
  }

  useEffect(() => {
    const video = videoRef.current
    if (video) {
      video.volume = volume
      video.controls = false // hide native controls
    }
  }, [volume])

  if (!src) {
    return (
      <div className="text-red-600 bg-black p-4 text-center">
        ⚠️ No video source found.
      </div>
    )
  }

  return (
    <div className="relative bg-black w-full max-w-screen-lg mx-auto p-4">
      <video
        ref={videoRef}
        src={src}
        poster={poster}
        playsInline
        className="w-full max-h-[90vh] object-contain"
      >
        Your browser does not support the video tag.
      </video>

      {/* Custom Controls */}
      <div className="mt-4 flex items-center justify-center gap-4 bg-gray-800 p-3 rounded-lg">
        <button
          onClick={togglePlay}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          {isPlaying ? 'Pause' : 'Play'}
        </button>

        <button
          onClick={toggleMute}
          className="px-4 py-2 bg-yellow-500 text-white rounded hover:bg-yellow-600"
        >
          {muted ? 'Unmute' : 'Mute'}
        </button>

        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={volume}
          onChange={handleVolumeChange}
          className="w-32"
        />
      </div>
    </div>
  )
}
