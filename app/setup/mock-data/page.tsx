"use client"

import { useState } from "react"
import { supabase, updateRLSPolicies } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { CheckCircle, XCircle, ArrowLeft } from "lucide-react"

// Sample data for quick setup
const sampleChannels = [
  {
    id: "1",
    name: "News 24/7",
    slug: "news-24-7",
    description: "Breaking news and current events",
    logo_url: "https://placehold.co/400x225?text=News+24/7",
  },
  {
    id: "2",
    name: "Sports Channel",
    slug: "sports-channel",
    description: "Live sports and commentary",
    logo_url: "https://placehold.co/400x225?text=Sports",
  },
  {
    id: "3",
    name: "Movie Classics",
    slug: "movie-classics",
    description: "Classic films from every era",
    logo_url: "https://placehold.co/400x225?text=Movies",
  },
  {
    id: "4",
    name: "Kids Zone",
    slug: "kids-zone",
    description: "Family-friendly entertainment",
    logo_url: "https://placehold.co/400x225?text=Kids",
  },
  {
    id: "5",
    name: "Documentary World",
    slug: "documentary-world",
    description: "Fascinating documentaries",
    logo_url: "https://placehold.co/400x225?text=Docs",
  },
]

const sampleVideos = [
  {
    title: "Sample News Report",
    description: "Breaking news coverage",
    url: "https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
    thumbnail_url: "https://placehold.co/640x360?text=News",
    duration: 120,
    channel_id: "1",
  },
  {
    title: "Sports Highlights",
    description: "Weekly sports roundup",
    url: "https://storage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
    thumbnail_url: "https://placehold.co/640x360?text=Sports",
    duration: 180,
    channel_id: "2",
  },
  {
    title: "Classic Movie",
    description: "A timeless classic film",
    url: "https://storage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4",
    thumbnail_url: "https://placehold.co/640x360?text=Movie",
    duration: 240,
    channel_id: "3",
  },
  {
    title: "Kids Cartoon",
    description: "Fun animation for children",
    url: "https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4",
    thumbnail_url: "https://placehold.co/640x360?text=Cartoon",
    duration: 150,
    channel_id: "4",
  },
  {
    title: "Nature Documentary",
    description: "Exploring wildlife",
    url: "https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4",
    thumbnail_url: "https://placehold.co/640x360?text=Nature",
    duration: 210,
    channel_id: "5",
  },
]

export default function MockDataPage() {
  const [isLoading, setIsLoading] = useState(false)
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null)

  const addMockData = async () => {
    setIsLoading(true)
    setResult(null)

    try {
      // First, update RLS policies to allow inserts
      const { success: policySuccess, error: policyError } = await updateRLSPolicies()

      if (!policySuccess) {
        throw new Error(`Error updating RLS policies: ${policyError}`)
      }

      // Clear existing data
      const { error: clearChannelsError } = await supabase.from("channels").delete().gt("id", "0")
      if (clearChannelsError) {
        console.warn("Error clearing channels:", clearChannelsError)
        // Continue anyway, might be first run
      }

      const { error: clearVideosError } = await supabase.from("videos").delete().gt("id", 0)
      if (clearVideosError) {
        console.warn("Error clearing videos:", clearVideosError)
        // Continue anyway, might be first run
      }

      // Insert channels
      const { data: channelsData, error: channelsError } = await supabase
        .from("channels")
        .insert(sampleChannels)
        .select()

      if (channelsError) {
        throw new Error(`Error adding channels: ${channelsError.message}`)
      }

      // Insert videos
      const { error: videosError } = await supabase.from("videos").insert(sampleVideos)

      if (videosError) {
        throw new Error(`Error adding videos: ${videosError.message}`)
      }

      setResult({
        success: true,
        message: "Sample data added successfully! Added 5 channels and 5 videos.",
      })
    } catch (error) {
      console.error("Error adding mock data:", error)
      setResult({
        success: false,
        message: error instanceof Error ? error.message : "An unknown error occurred",
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="pt-24 px-4 md:px-10 flex flex-col items-center justify-center min-h-[80vh]">
      <div className="bg-gray-800 p-6 rounded-lg max-w-2xl w-full">
        <div className="flex items-center mb-6">
          <Link href="/setup" className="mr-4">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
          </Link>
          <h1 className="text-2xl font-bold">Add Sample Data</h1>
        </div>

        <div className="mb-6">
          <p className="mb-4">
            Quickly populate your Black Truth TV app with sample data for testing. This will add 5 channels and 5 videos
            to your database.
          </p>

          <div className="bg-gray-900 p-4 rounded mb-6">
            <h3 className="font-semibold mb-2">Sample Channels:</h3>
            <ul className="list-disc pl-5 mb-4">
              {sampleChannels.map((channel, index) => (
                <li key={index}>{channel.name}</li>
              ))}
            </ul>

            <h3 className="font-semibold mb-2">Sample Videos:</h3>
            <ul className="list-disc pl-5">
              {sampleVideos.map((video, index) => (
                <li key={index}>{video.title}</li>
              ))}
            </ul>
          </div>

          <div className="flex justify-center">
            <Button onClick={addMockData} disabled={isLoading} className="bg-red-600 hover:bg-red-700 w-full max-w-xs">
              {isLoading ? "Adding Data..." : "Add Sample Data"}
            </Button>
          </div>

          {result && (
            <div
              className={`mt-6 p-4 rounded-md ${
                result.success ? "bg-green-900/30 text-green-400" : "bg-red-900/30 text-red-400"
              }`}
            >
              <div className="flex items-center gap-2">
                {result.success ? <CheckCircle className="h-5 w-5" /> : <XCircle className="h-5 w-5" />}
                <p>{result.message}</p>
              </div>
              {result.success && (
                <div className="mt-4 text-center">
                  <Link href="/">
                    <Button className="bg-green-600 hover:bg-green-700">Go to Home Page</Button>
                  </Link>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
