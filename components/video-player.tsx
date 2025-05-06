'use client'

import { useState, useRef } from 'react'
import { ChevronLeft } from 'lucide-react'
import { useRouter } from 'next/navigation'

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
    if (!mp4Path) return ''
    const base = 'https://msllqpnxwbugvkpnquwx.supabase.co/storage/v1/object/public'
    const clean = mp4Path.replace(/^\/+/, '').replace(/\/{2,}/g, '/')
    return `${base}/${clean}`
  }

  const getFallbackUrl = () => {
    const bucket = currentProgram?.mp4_url?.match(/channel\d+/)?.[0] || `channel${channel.id}`
    return `https://msllqpnxwbugvkpnquwx.supabase.co/storage/v1/object/public/${bucket}/standby_blacktruthtv.mp4`
  }

  const videoUrl = hasTriedFallback
    ? getFallbackUrl()
    : getVideoUrl(currentProgram?.mp4_url)

  const loadNextProgram = () => {
    if (upcomingPrograms.length > 0) {
      const next = upcomingPrograms[0]
      setUpcomingPrograms(upcomingPrograms.slice(1))
      setCurrentProgram(next)
      setRetryCount(0)
      setHasTriedFallback(false)
    } else {
      setHasTriedFallback(true)
    }
  }

  const handleVideoError = () => {
    if (retryCount < 2) {
      setRetryCount((prev) => prev + 1)
    } else {
      setHasTriedFallback(true)
    }
  }

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
        muted
        playsInline
        onEnded={loadNextProgram}
        onError={handleVideoError}
        style={{ zIndex: 20, position: 'relative' }}
        className="w-full aspect-video bg-black"
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
