"use client"

import type React from "react"
import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { Loader2, ChevronLeft, AlertTriangle, RefreshCw } from "lucide-react"
import { getCurrentProgram, getUpcomingPrograms, forceRefreshAllData, getFullUrl } from "@/lib/supabase"

interface VideoPlayerProps {
  channel: any
  initialProgram: any
  upcomingPrograms: any[]
}

export function VideoPlayer({ channel, initialProgram, upcomingPrograms: initialUpcoming }: VideoPlayerProps) {
  const router = useRouter()
  const videoRef = useRef<HTMLVideoElement>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [currentProgram, setCurrentProgram] = useState(initialProgram)
  const [upcomingPrograms, setUpcomingPrograms] = useState(initialUpcoming)
  const [videoUrl, setVideoUrl] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [retryCount, setRetryCount] = useState(0)
  const maxRetries = 2
  const loadingTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  const clearLoadingTimeout = () => {
    if (loadingTimeoutRef.current) clearTimeout(loadingTimeoutRef.current)
  }

  const loadVideo = (url: string, forceRetry = false) => {
    if (!url) {
      setError("No video URL available")
      setIsLoading(false)
      return
    }

    if (!forceRetry && videoUrl === url) return // Avoid unnecessary reloads

    setRetryCount(forceRetry ? retryCount + 1 : 0)
    setIsLoading(true)
    setError(null)

    const fullUrl = url.startsWith("http") ? url : getFullUrl(url)
    const cacheBustedUrl = retryCount > 0 ? `${fullUrl}?retry=${Date.now()}` : fullUrl

    setVideoUrl(cacheBustedUrl)

    clearLoadingTimeout()
    loadingTimeoutRef.current = setTimeout(() => {
      if (retryCount < maxRetries) {
        loadVideo(url, true)
      } else {
        setError("Video failed to load (timeout)")
        setIsLoading(false)
      }
    }, 15000)
  }

  const handleVideoError = () => {
    clearLoadingTimeout()
    if (retryCount < maxRetries && currentProgram?.mp4_url) {
      loadVideo(currentProgram.mp4_url, true)
    } else {
      setError("Video error: failed to load or unsupported")
      setIsLoading(false)
    }
  }

  const handleCanPlay = () => {
    clearLoadingTimeout()
    setIsLoading(false)
    setRetryCount(0)
  }

  const forceRefreshProgram = async () => {
    try {
      await forceRefreshAllData()
      const { program } = await getCurrentProgram(channel.id)
      const { programs } = await getUpcomingPrograms(channel.id)
      if (program?.mp4_url) {
        setCurrentProgram(program)
        setUpcomingPrograms(programs)
        loadVideo(program.mp4_url)
      } else {
        setError("No program or video found")
        setIsLoading(false)
      }
    } catch (err) {
      setError("Failed to refresh program")
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (initialProgram?.mp4_url) {
      loadVideo(initialProgram.mp4_url)
    } else {
      forceRefreshProgram()
    }
    return () => clearLoadingTimeout()
  }, [])

  return (
    <div className="relative bg-black">
      <button onClick={() => router.back()} className="absolute top-4 left-4 z-10 bg-black/50 p-2 rounded-full">
        <ChevronLeft className="h-6 w-6 text-white" />
      </button>

      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black z-20">
          <div className="flex flex-col items-center">
            <Loader2 className="h-12 w-12 text-red-600 animate-spin mb-2" />
            <p className="text-white">Loading video...</p>
          </div>
        </div>
      )}

      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-black z-20">
          <div className="text-center p-4">
            <AlertTriangle className="h-10 w-10 text-red-600 mb-2" />
            <p className="text-red-500 mb-4">{error}</p>
            <button onClick={() => currentProgram?.mp4_url && loadVideo(currentProgram.mp4_url, true)} className="bg-red-600 text-white px-4 py-2 rounded">
              Retry
            </button>
          </div>
        </div>
      )}

      <div className="w-full aspect-video bg-black">
        {videoUrl ? (
          <video
            ref={videoRef}
            key={`${videoUrl}-${retryCount}`}
            className="w-full h-full"
            controls
            playsInline
            autoPlay
            onCanPlay={handleCanPlay}
            onError={handleVideoError}
          >
            <source src={videoUrl} type="video/mp4" />
            Your browser does not support the video tag.
          </video>
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <p className="text-white">No video URL available</p>
          </div>
        )}
      </div>

      {currentProgram && (
        <div className="bg-black p-4 text-white">
          <h2 className="text-xl font-bold">{currentProgram.title}</h2>
        </div>
      )}

      <div className="bg-black p-4 flex justify-center">
        <button onClick={forceRefreshProgram} className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700">
          Force Refresh
        </button>
      </div>
    </div>
  )
}
