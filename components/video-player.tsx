'use client'

import { useState, useRef } from 'react'
import { ChevronLeft } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { getFullUrl } from '@/utils/url-utils'

interface VideoPlayerProps {
  channel: any
  initialProgram: any
  upcomingPrograms: any[]
}

export function VideoPlayer({ channel, initialProgram, upcomingPrograms: initialUpcoming }: VideoPlayerProps) {
  const router = useRouter()
  const videoRef = useRef<HTMLVideoElement>(null)
  const [currentProgram, setCurrentProgram] = useState(initialProgram)
  const [upcomingPrograms, setUpcomingPrograms] = useState(initialUpcoming)
  const [retryCount, setRetryCount] = useState(0)
  const [hasTriedFallback, setHasTriedFallback] = useState(false)

  const getVideoUrl = (mp4Path: string) => {
    return getFullUrl(mp4Path)
  }

  const getStandbyUrl = () => {
    const bucket = currentProgram?.mp4_url?.match(/channel\d+/)?.[0] || `channel${channel.id}`
    return `https://msllqpnxwbugvkpnquwx.supabase.co/storage/v1/object/public/${bucket}/standby_blacktruthtv.mp4`
  }

  const loadProgram = (program: any) => {
    setCurrentProgram(program)
    setRetryCount(0)
    setHasTriedFallback(false)
  }

  const handleVideoError = () => {
    if (retryCount < 2 && currentProgram?.mp4_url) {
      setRetryCount((prev) => prev + 1)
    } else if (!hasTriedFallback) {
      setHasTriedFallback(true)
    }
  }

  const handleEnded = () => {
    if (upcomingPrograms.length > 0) {
      const next = upcomingPrograms[0]
      setUpcomingPrograms((prev) => prev.slice(1))
      loadProgram(next)
    } else {
      setHasTriedFallback(true)
    }
  }

  const videoUrl = hasTriedFallback
    ? getStandbyUrl()
    : getVideoUrl(currentProgram?.mp4_url)

  return (
    <div className="bg-black text-white relative">
      <button
        onClick={() => router.back()}
        className="absolute top-4 left-4 z-10 bg-black/50 p-2 rounded-full"
      >
        <ChevronLeft className="h-6 w-6 text-white" />
      </button>

      <video
        key={videoUrl + retryCount}
        ref={videoRef}
        src={videoUrl}
        controls
        autoPlay
        onError={handleVideoError}
        onEnded={handleEnded}
        className="w-full aspect-video bg-black"
        playsInline
      />

      {currentProgram && (
        <div className="p-4">
          <h2 className="text-xl font-bold">{currentProgram.title}</h2>
          <p className="text-sm text-gray-400">
            Starts: {new Date(currentProgram.start_time).toLocaleTimeString()}
          </p>
          {upcomingPrograms.length > 0 && (
            <p className="text-sm text-gray-400 mt-1">
              Next: {upcomingPrograms[0].title} at{' '}
              {new Date(upcomingPrograms[0].start_time).toLocaleTimeString()}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
