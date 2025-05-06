'use client'

import { useState, useRef } from 'react'
import { ChevronLeft } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { getFullUrl } from '@/utils/url-utils'
import { getCurrentProgram, getUpcomingPrograms } from '@/lib/supabase'

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
  const [videoUrl, setVideoUrl] = useState(cleanAndBuildUrl(initialProgram?.mp4_url))
  const [retryCount, setRetryCount] = useState(0)
  const [hasTriedFallback, setHasTriedFallback] = useState(false)
  const maxRetries = 2

  function cleanAndBuildUrl(raw: string): string {
    if (!raw) return ''
    try {
      let url = decodeURIComponent(raw.trim())
      if (url.includes('/api/cors-proxy')) {
        const match = url.match(/url=(https?.*)$/)
        if (match && match[1]) url = match[1]
      }
      if (!url.startsWith('http')) url = getFullUrl(url)
      return url
    } catch {
      return ''
    }
  }

  function getStandbyUrl(): string {
    const folder = currentProgram?.mp4_url?.match(/channel\d+/)?.[0] || channel.id || 'channel1'
    return `https://msllqpnxwbugvkpnquwx.supabase.co/storage/v1/object/public/${folder}/standby_blacktruthtv.mp4`
  }

  const loadVideo = (url: string) => {
    setVideoUrl(cleanAndBuildUrl(url))
  }

  const handleVideoError = () => {
    if (retryCount < maxRetries && currentProgram?.mp4_url) {
      setRetryCount(retryCount + 1)
      loadVideo(currentProgram.mp4_url)
    } else if (!hasTriedFallback) {
      setHasTriedFallback(true)
      loadVideo(getStandbyUrl())
    }
  }

  const handleEnded = () => {
    if (upcomingPrograms.length > 0) {
      const next = upcomingPrograms[0]
      setCurrentProgram(next)
      setUpcomingPrograms(upcomingPrograms.slice(1))
      setRetryCount(0)
      setHasTriedFallback(false)
      loadVideo(next.mp4_url)
    } else {
      loadVideo(getStandbyUrl())
    }
  }

  const handleBack = () => router.back()

  return (
    <div className="bg-black text-white relative">
      <button onClick={handleBack} className="absolute top-4 left-4 z-10 bg-black/50 p-2 rounded-full">
        <ChevronLeft className="h-6 w-6 text-white" />
      </button>

      <video
        key={retryCount + videoUrl}
        ref={videoRef}
        src={videoUrl}
        controls
        autoPlay
        onEnded={handleEnded}
        onError={handleVideoError}
        className="w-full aspect-video bg-black"
        type="video/mp4"
        playsInline
      />

      {currentProgram && (
        <div className="p-4">
          <h2 className="text-xl font-bold">{currentProgram.title}</h2>
          <p className="text-sm text-gray-400">Starts: {new Date(currentProgram.start_time).toLocaleTimeString()}</p>
          {upcomingPrograms.length > 0 && (
            <p className="text-sm text-gray-400 mt-1">
              Next: {upcomingPrograms[0].title} at {new Date(upcomingPrograms[0].start_time).toLocaleTimeString()}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
