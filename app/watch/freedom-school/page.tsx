"use client"

import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { FreedomSchoolPlayer } from "@/components/freedom-school-player"
import { Loader2, ArrowLeft } from "lucide-react"
import Link from "next/link"

export default function FreedomSchoolVideoPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const videoId = searchParams.get("id")

  const [video, setVideo] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchVideo() {
      if (!videoId) {
        setError("No video ID provided")
        setLoading(false)
        return
      }

      try {
        const { data, error } = await supabase.from("freedom_school_videos").select("*").eq("id", videoId).single()

        if (error) {
          throw error
        }

        if (!data) {
          setError("Video not found")
          setLoading(false)
          return
        }

        console.log("Loaded Freedom School video:", data)
        setVideo(data)
      } catch (err) {
        console.error("Error fetching video:", err)
        setError("Failed to load video")
      } finally {
        setLoading(false)
      }
    }

    fetchVideo()
  }, [videoId])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[80vh]">
        <div className="flex flex-col items-center">
          <Loader2 className="h-12 w-12 text-red-600 animate-spin mb-4" />
          <p className="text-xl">Loading video...</p>
        </div>
      </div>
    )
  }

  if (error || !video) {
    return (
      <div className="p-4 md:p-8">
        <div className="bg-gray-800 p-6 rounded-lg max-w-md mx-auto text-center">
          <h2 className="text-xl font-semibold mb-4">Error</h2>
          <p className="mb-4">{error || "Failed to load video"}</p>
          <Link href="/freedom-school" className="text-red-500 hover:underline">
            Return to Freedom School
          </Link>
        </div>
      </div>
    )
  }

  // Use a reliable fallback URL for all Freedom School videos
  const fallbackUrl = "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8"

  return (
    <div>
      <FreedomSchoolPlayer
        videoId={Number.parseInt(videoId)}
        videoUrl={video.video_url}
        title={video.title}
        fallbackUrl={fallbackUrl}
      />

      <div className="p-4 md:p-8">
        <Link href="/freedom-school" className="flex items-center text-red-500 hover:underline mb-6">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Freedom School
        </Link>

        <div className="bg-gray-800 p-6 rounded-lg">
          <h1 className="text-2xl font-bold mb-4">{video.title}</h1>

          {video.description && (
            <div className="mt-4 text-gray-300">
              <h2 className="text-lg font-semibold mb-2">Description</h2>
              <p>{video.description}</p>
            </div>
          )}

          {video.instructor && (
            <div className="mt-4 text-gray-300">
              <h2 className="text-lg font-semibold mb-2">Instructor</h2>
              <p>{video.instructor}</p>
            </div>
          )}

          {video.duration && (
            <div className="mt-4 text-gray-300">
              <h2 className="text-lg font-semibold mb-2">Duration</h2>
              <p>{Math.floor(video.duration / 60)} minutes</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
