// CustomVideoPlayer.tsx
'use client'

import React, { useRef, useState, useEffect } from 'react'
import { Fullscreen, Pause, Play, Volume2, VolumeX, PictureInPicture } from 'lucide-react'

interface Props {
  src: string
  poster?: string
}

export default function CustomVideoPlayer({ src, poster }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isMuted, setIsMuted] = useState(false)
  const [volume, setVolume] = useState(1)
  const [progress, setProgress] = useState(0)

  const togglePlay = () => {
    const video = videoRef.current
    if (video) {
      if (video.paused) {
        video.play()
        setIsPlaying(true)
      } else {
        video.pause()
        setIsPlaying(false)
      }
    }
  }

  const toggleMute = () => {
    const video = videoRef.current
    if (video) {
      video.muted = !video.muted
      setIsMuted(video.muted)
    }
  }

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseFloat(e.target.value)
    setVolume(newVolume)
    if (videoRef.current) {
      videoRef.current.volume = newVolume
      videoRef.current.muted = newVolume === 0
      setIsMuted(newVolume === 0)
    }
  }

  const handleTimeUpdate = () => {
    const video = videoRef.current
    if (video) {
      setProgress((video.currentTime / video.duration) * 100)
    }
  }

  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const video = videoRef.current
    if (video) {
      const rect = (e.target as HTMLDivElement).getBoundingClientRect()
      const clickPosition = e.clientX - rect.left
      const newTime = (clickPosition / rect.width) * video.duration
      video.currentTime = newTime
    }
  }

  const enterPiP = () => {
    const video = videoRef.current
    if (video && (video as any).requestPictureInPicture) {
      (video as any).requestPictureInPicture()
    }
  }

  const enterFullscreen = () => {
    const video = videoRef.current
    if (video && video.requestFullscreen) {
      video.requestFullscreen()
    }
  }

  return (
    <div className="relative bg-black w-full max-w-5xl mx-auto">
      <video
        ref={videoRef}
        src={src}
        poster={poster}
        className="w-full h-auto"
        onTimeUpdate={handleTimeUpdate}
      />

      {/* Controls */}
      <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white flex flex-col px-4 py-2 space-y-2">
        {/* Progress Bar */}
        <div className="w-full h-1 bg-gray-700 cursor-pointer" onClick={handleProgressClick}>
          <div className="h-1 bg-red-500" style={{ width: `${progress}%` }}></div>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <button onClick={togglePlay}>
              {isPlaying ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6" />}
            </button>
            <button onClick={toggleMute}>
              {isMuted ? <VolumeX className="w-6 h-6" /> : <Volume2 className="w-6 h-6" />}
            </button>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={volume}
              onChange={handleVolumeChange}
              className="w-24"
            />
          </div>

          <div className="flex items-center space-x-4">
            <button onClick={enterPiP}>
              <PictureInPicture className="w-6 h-6" />
            </button>
            <button onClick={enterFullscreen}>
              <Fullscreen className="w-6 h-6" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
