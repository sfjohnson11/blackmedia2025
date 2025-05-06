'use client'

import { useState, useRef } from 'react'
import { ChevronLeft, AlertTriangle, Loader2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { getFullUrl } from '@/utils/url-utils'
import { getCurrentProgram, getUpcomingPrograms, forceRefreshAllData } from '@/lib/supabase'

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
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
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
    } catch (e) {
      console.error('URL cleanup failed:', raw, e)
      return ''
    }
  }

  function getStandbyUrl(): string {
    const channelFolder = currentProgram?.mp4_url?.match(/channel\d+/)?.[0] || channel.id || 'channel1'
    return `https://msllqpnxwbugvkpnquwx.supabase.co/storage/v1/object/public/${channelFolder}/standby_blacktruthtv.mp4`
  }

  const loadVideo = (url: string) => {
    setError(null)
    setIsLoading(true)
    setVideoUrl(cleanAndBuildUrl(url))
  }

  const handleVideoError = () => {
    console.error('❌ Video failed:', videoUrl)
    if (retryCount < maxRetries && currentProgram?.mp4_url) {
      setRetryCount(retryCount + 1)
      loadVideo(currentProgram.mp4_url)
    } else if (!hasTriedFallback) {
      console.warn('⚠️ Loading standby fallback...')
      setHasTriedFallback(true)
      loadVideo(getStandbyUrl())
    } else {
      setError('Video and fallback failed.')
      setIsLoading(false)
    }
  }

  const handleCanPlay = () => {
    setIsLoading(false)
    setError(null)
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
      console.warn('No upcoming program, switching to standby.')
      loadVideo(getStandbyUrl())
    }
  }

  const forceRefresh = async () => {
    setIsLoading(true)
    setError(null)
    try {
      await forceRefreshAllData()
      const { program } = await getCurrentProgram(channel.id)
      const { programs } = await getUpcomingPrograms(channel.id)
      if (program) {
        setCurrentProgram(program)
        setUpcomingPrograms(programs)
        setHasTriedFallback(false)
        loadVideo(program.mp4_url)
      } else {
        setError('No program available')
      }
    } catch {
      setError('Refresh failed')
    }
  }

  const handleBack = () => router.back()

  return (
    <div className="bg-black text-white relative">
      <button onClick={handleBack} className="absolute top-4 left-4 z-10 bg-black/50 p-2 rounded-full">
        <ChevronLeft className="h-6 w-6 text-white" />
      </button>

      {isLoading && (
        <div className="flex justify-center items-center h-96">
          <Loader2 className="animate-spin text-red-500 h-10 w-10" />
        </div>
      )}

      {error && (
        <div className="text-center p-6 text-red-400">
          <AlertTriangle className="mx-auto mb-2" />
          <p>{error}</p>
          <button onClick={forceRefresh} className="mt-4 px-4 py-2 bg-red-600 rounded">Force Refresh</button>
        </div>
      )}

      {!error && videoUrl && (
        <video
          key={retryCount + videoUrl}
          ref={videoRef}
          src={videoUrl}
          controls
          autoPlay
          onEnded={handleEnded}
          onCanPlay={handleCanPlay}
          onError={handleVideoError}
          className="w-full aspect-video bg-black"
          type="video/mp4"
          playsInline
        />
      )}

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

      {/* 🔧 Debug Panel - dev only */}
      {process.env.NODE_ENV === 'development' && (
        <div className="p-4 bg-gray-900 text-white text-sm border-t border-gray-700 mt-4">
          <h3 className="text-lg font-bold mb-2">🔧 Debug Info</h3>
          <ul className="space-y-1">
            <li><strong>Channel ID:</strong> {channel?.id}</li>
            <li><strong>Program Title:</strong> {currentProgram?.title || 'None'}</li>
            <li><strong>Program URL:</strong> {currentProgram?.mp4_url}</li>
            <li><strong>Video URL:</strong> {videoUrl}</li>
            <li><strong>Retry Count:</strong> {retryCount}/{maxRetries}</li>
            <li><strong>Loading:</strong> {isLoading ? 'Yes' : 'No'}</li>
            <li><strong>Error:</strong> {error || 'None'}</li>
            <li><strong>Now (Local):</strong> {new Date().toLocaleString()}</li>
            <li><strong>Start Time:</strong> {currentProgram?.start_time ? new Date(currentProgram.start_time).toLocaleString() : 'N/A'}</li>
          </ul>
        </div>
      )}
    </div>
  )
}
