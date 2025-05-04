"use client"

import { useState, useEffect } from "react"
import { FreedomSchoolPlayer } from "@/components/freedom-school-player"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { ArrowLeft, Loader2 } from "lucide-react"
import Link from "next/link"

interface FreedomSchoolVideo {
  id: number
  title: string
  description: string
  video_url: string
  thumbnail_url?: string
  created_at: string
}

export default function FreedomSchoolPage() {
  const [videos, setVideos] = useState<FreedomSchoolVideo[]>([])
  const [selectedVideo, setSelectedVideo] = useState<FreedomSchoolVideo | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchVideos() {
      try {
        setLoading(true)
        const { data, error } = await supabase
          .from("freedom_school_videos")
          .select("*")
          .order("created_at", { ascending: false })

        if (error) {
          throw error
        }

        if (data && data.length > 0) {
          setVideos(data as FreedomSchoolVideo[])
          setSelectedVideo(data[0] as FreedomSchoolVideo)
        } else {
          // If no videos in database, use a sample video
          const sampleVideo: FreedomSchoolVideo = {
            id: 1,
            title: "Introduction to Freedom School",
            description: "Learn about the purpose and vision of our Freedom School program.",
            video_url:
              "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/freedom_school_sample-D7yZUERL2zhjE71Llxul69gbPLxGES.mp4",
            created_at: new Date().toISOString(),
          }
          setVideos([sampleVideo])
          setSelectedVideo(sampleVideo)
        }
      } catch (err) {
        console.error("Error fetching Freedom School videos:", err)
        setError("Failed to load Freedom School videos. Please try again later.")

        // Use sample video as fallback
        const sampleVideo: FreedomSchoolVideo = {
          id: 1,
          title: "Introduction to Freedom School",
          description: "Learn about the purpose and vision of our Freedom School program.",
          video_url:
            "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/freedom_school_sample-D7yZUERL2zhjE71Llxul69gbPLxGES.mp4",
          created_at: new Date().toISOString(),
        }
        setVideos([sampleVideo])
        setSelectedVideo(sampleVideo)
      } finally {
        setLoading(false)
      }
    }

    fetchVideos()
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[80vh]">
        <div className="flex flex-col items-center">
          <Loader2 className="h-12 w-12 text-red-600 animate-spin mb-4" />
          <p className="text-xl">Loading Freedom School...</p>
        </div>
      </div>
    )
  }

  if (error && videos.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[80vh] p-4">
        <h2 className="text-2xl font-bold mb-4">Error</h2>
        <p className="text-red-500 mb-6">{error}</p>
        <Button asChild>
          <Link href="/">Return to Home</Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center mb-6">
        <Button variant="ghost" asChild className="mr-4">
          <Link href="/">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Home
          </Link>
        </Button>
        <h1 className="text-3xl font-bold">Freedom School</h1>
      </div>

      {selectedVideo && (
        <div className="mb-8">
          <FreedomSchoolPlayer
            videoUrl={selectedVideo.video_url}
            title={selectedVideo.title}
            programId={selectedVideo.id}
          />
          <div className="mt-4">
            <h2 className="text-2xl font-bold mb-2">{selectedVideo.title}</h2>
            <p className="text-gray-400">{selectedVideo.description}</p>
          </div>
        </div>
      )}

      <div className="mt-8">
        <h3 className="text-xl font-bold mb-4">All Videos</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {videos.map((video) => (
            <div
              key={video.id}
              className={`bg-gray-800 rounded-lg overflow-hidden cursor-pointer transition-all hover:ring-2 hover:ring-red-500 ${
                selectedVideo?.id === video.id ? "ring-2 ring-red-500" : ""
              }`}
              onClick={() => setSelectedVideo(video)}
            >
              <div className="aspect-video bg-gray-900 relative">
                {video.thumbnail_url ? (
                  <img
                    src={video.thumbnail_url || "/placeholder.svg"}
                    alt={video.title}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <span className="text-gray-500">No thumbnail</span>
                  </div>
                )}
              </div>
              <div className="p-4">
                <h4 className="font-bold mb-1 truncate">{video.title}</h4>
                <p className="text-sm text-gray-400 line-clamp-2">{video.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
