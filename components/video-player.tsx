'use client'

import { useRouter } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'

interface VideoPlayerProps {
  channel: any
  initialProgram: any
  upcomingPrograms: any[]
}

export function VideoPlayer({ channel, initialProgram, upcomingPrograms }: VideoPlayerProps) {
  const router = useRouter()

  const getVideoUrl = (mp4Path: string) => {
    if (!mp4Path) return ''
    const base = 'https://msllqpnxwbugvkpnquwx.supabase.co/storage/v1/object/public'
    const clean = mp4Path.replace(/^\/+/, '').replace(/\/{2,}/g, '/')
    return `${base}/${clean}`
  }

  const videoUrl = getVideoUrl(initialProgram?.mp4_url)

  return (
    <div className="bg-black text-white relative">
      {/* Back Button */}
      <button
        onClick={() => router.back()}
        className="absolute top-4 left-4 z-10 bg-black/50 p-2 rounded-full"
      >
        <ChevronLeft className="h-6 w-6 text-white" />
      </button>

      {/* Video Player */}
      {videoUrl ? (
  <div style={{ zIndex: 99, position: 'relative' }}>
    <video
      key={videoUrl}
      id="main-video"
      src={videoUrl}
      controls
      playsInline
      muted={false}
      autoPlay={false}
      style={{
        width: '100%',
        height: 'auto',
        backgroundColor: 'black',
        zIndex: 99,
        position: 'relative',
      }}
    />
  </div>
) : (
  <div className="p-6 text-center text-red-400">
    No video URL found.
  </div>
)}


      {/* Program Info */}
      {initialProgram && (
        <div className="p-4">
          <h2 className="text-xl font-bold">{initialProgram.title}</h2>
          <p className="text-sm text-gray-400">
            Starts: {new Date(initialProgram.start_time).toLocaleTimeString()}
          </p>
          {upcomingPrograms?.[0] && (
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
