'use client'

import { useState, useEffect, useRef } from 'react'
import { ChevronLeft, RefreshCw, AlertTriangle, Loader2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { getCurrentProgram, getUpcomingPrograms, forceRefreshAllData } from '@/lib/supabase'

interface VideoPlayerProps {
  channel: any
  initialProgram: any
  upcomingPrograms: any[]
}

// ✅ Clean any proxied URL
const cleanUrl = (url: string) => {
  try {
    const decoded = decodeURIComponent(url)
    if (decoded.includes('/api/cors-proxy')) {
      const match = decoded.match(/url=(https?.*)$/)
      return match ? match[1] : url
    }
    return url
  } catch {
    return url
  }
}

export function VideoPlayer({ channel, initialProgram, upcomingPrograms: initialUpcoming }: VideoPlayerProps) {
  const router = useRouter()
  const videoRef = useRef<HTMLVideoElement>(null)
  const [currentProgram, setCurrentProgram] = useState(initialProgram)
  const [upcomingPrograms, setUpcomingPrograms] = useState(initialUpcoming)
  const [videoUrl, setVideoUrl] = useState(cleanUrl(initialProgram?.mp4_url || ''))
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [retryCount, setRetryCount] = useState(0)
  const maxRetries = 2

  const handleBack = () => router.back()

  const loadVideo = (url: string) => {
    const cleaned = cleanUrl(url)
    console.log('📺 Loading video URL:', cleaned)
    setError(null)
    setIsLoading(true)
    setVideoUrl(cleaned)
  }

  const handleVideoError = () => {
    console.error('❌ Video error triggered:', videoUrl)
    if (retryCount < maxRetries && currentProgram?.mp4_url) {
      setRetryCount(retryCount + 1)
      loadVideo(currentProgram.mp4_url)
    } else {
      setError('Video failed to load after retries.')
      setIsLoading(false)
    }
  }

  const handleCanPlay = () => {
    console.log('✅ Video ready to play:', videoUrl)
    setIsLoading(false)
    setError(null)
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
        loadVideo(program.mp4_url)
      } else {
        setError('No program available')
      }
    } catch (err) {
      setError('Refresh failed')
    }
  }

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
          key={retryCount}
          ref={videoRef}
          src={videoUrl}
          controls
          autoPlay
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
    </div>
  )
}
