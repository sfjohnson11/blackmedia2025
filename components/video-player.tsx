"use client"

import type React from "react"
import { useEffect, useRef, useState } from "react"
import { Loader2, AlertTriangle, RefreshCw } from "lucide-react"
import { getFullUrl } from "@/lib/supabase"
import { STANDBY_PLACEHOLDER_ID } from "@/lib/supabase" // Import the special ID
import type { Program } from "@/types"

interface VideoPlayerProps {
  initialProgram: Program | null
  onProgramEnd?: () => void
  onError?: (error: string) => void
}

export default function VideoPlayer({ initialProgram, onProgramEnd, onError }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [currentProgram, setCurrentProgram] = useState<Program | null>(initialProgram)
  const [videoSrc, setVideoSrc] = useState<string>("")
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Check if the current program is our virtual standby program
  const isStandbyVideo = currentProgram?.channel_id === STANDBY_PLACEHOLDER_ID

  useEffect(() => {
    setCurrentProgram(initialProgram)
  }, [initialProgram])

  useEffect(() => {
    setError(null)
    if (currentProgram && currentProgram.mp4_url) {
      const fullUrl = getFullUrl(currentProgram.mp4_url)
      if (fullUrl !== videoSrc) {
        setVideoSrc(fullUrl)
        setIsLoading(true)
        console.log(`Loading video: ${currentProgram.title} (${fullUrl}) - Standby: ${isStandbyVideo}`)
      } else {
        setIsLoading(false)
      }
    } else {
      setVideoSrc("")
      setIsLoading(false)
      if (initialProgram === null) {
        setError("No program is currently scheduled for this channel.")
      }
    }
  }, [currentProgram, videoSrc, initialProgram])

  useEffect(() => {
    const videoElement = videoRef.current
    if (videoElement && videoSrc) {
      if (videoElement.src !== videoSrc) {
        videoElement.load()
      }
      videoElement.play().catch((playError) => {
        console.error("Error attempting to play video:", playError)
        setError("Could not play video. Click to retry.")
        setIsLoading(false)
        if (onError) onError("Playback error")
      })
    }
  }, [videoSrc, onError])

  const handleCanPlay = () => {
    setIsLoading(false)
    setError(null)
    // ADDED: Set loop attribute when video can play
    if (videoRef.current && isStandbyVideo) {
      videoRef.current.loop = true
      console.log("Loop enabled for standby video")
    }
  }

  const handleVideoError = (e: React.SyntheticEvent<HTMLVideoElement, Event>) => {
    const videoElement = e.currentTarget
    let errorMsg = "An unknown error occurred."
    if (videoElement.error) {
      switch (videoElement.error.code) {
        case MediaError.MEDIA_ERR_NETWORK:
          errorMsg = "A network error caused the video to fail."
          break
        case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED:
          errorMsg = "The video format is not supported or the file could not be found."
          if (isStandbyVideo) {
            errorMsg += " (Is standby_blacktruthtv.mp4 in the correct channel bucket?)"
          }
          break
        default:
          errorMsg = `Video error code: ${videoElement.error.code}`
      }
    }
    console.error("Video error:", errorMsg, "Src:", videoSrc)
    setError(errorMsg)
    setIsLoading(false)
    if (onError) onError(errorMsg)
  }

  const handleEnded = () => {
    console.log(`Video ended. IsStandbyVideo: ${isStandbyVideo}, Loop: ${videoRef.current?.loop}`)
    if (!isStandbyVideo && onProgramEnd) {
      console.log("Program ended:", currentProgram?.title)
      onProgramEnd()
    }
    // For standby videos, the loop attribute should handle automatic replay
  }

  const retryLoad = () => {
    if (currentProgram && currentProgram.mp4_url) {
      setError(null)
      setIsLoading(true)
      const originalSrc = getFullUrl(currentProgram.mp4_url)
      setVideoSrc("")
      setTimeout(() => setVideoSrc(originalSrc), 50)
    }
  }

  if (isLoading && videoSrc) {
    return (
      <div className="w-full aspect-video bg-black flex items-center justify-center text-white">
        <Loader2 className="h-12 w-12 animate-spin text-red-600" />
        <p className="ml-4">Loading Video...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="w-full aspect-video bg-black flex flex-col items-center justify-center text-white p-4">
        <AlertTriangle className="h-12 w-12 text-yellow-400 mb-4" />
        <p className="text-center mb-2">Error: {error}</p>
        {videoSrc && (
          <button
            onClick={retryLoad}
            className="mt-2 px-4 py-2 bg-red-600 hover:bg-red-700 rounded text-white flex items-center"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </button>
        )}
      </div>
    )
  }

  if (!videoSrc && !isLoading) {
    return (
      <div className="w-full aspect-video bg-black flex items-center justify-center text-white">
        <Loader2 className="h-12 w-12 animate-spin text-red-600" />
        <p className="ml-4">Checking schedule...</p>
      </div>
    )
  }

  return (
    <div className="w-full aspect-video bg-black relative">
      <video
        ref={videoRef}
        key={videoSrc}
        className="w-full h-full"
        controls
        autoPlay
        playsInline
        loop={isStandbyVideo} // ADDED: Declarative loop attribute
        onCanPlay={handleCanPlay}
        onError={handleVideoError}
        onEnded={handleEnded}
        onLoadStart={() => setIsLoading(true)}
        poster={currentProgram?.poster_url ? getFullUrl(currentProgram.poster_url) : undefined}
      >
        <source src={videoSrc} type="video/mp4" />
        Your browser does not support the video tag.
      </video>
    </div>
  )
}
