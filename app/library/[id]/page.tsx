"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { ArrowLeft, Download, Share, FileText, Music, Video, Calendar, Clock, HardDrive } from "lucide-react"
import Image from "next/image"

// Types for our library items
type MediaType = "document" | "audio" | "video"

interface LibraryItem {
  id: string
  title: string
  description: string
  type: MediaType
  url: string
  thumbnail: string
  channelId: string
  channelName: string
  dateAdded: string
  fileSize?: string
  duration?: string
  content?: string // For documents
}

// Mock data for initial display - same as in library page
const mockLibraryItems: LibraryItem[] = [
  {
    id: "1",
    title: "Introduction to African History",
    description: "A comprehensive overview of African history from ancient civilizations to modern times.",
    type: "document",
    url: "#",
    thumbnail: "/document-stack.png",
    channelId: "history",
    channelName: "History Channel",
    dateAdded: "2023-05-15",
    fileSize: "2.4 MB",
    content:
      "This document provides a comprehensive overview of African history, spanning from ancient civilizations to modern times. It explores the rich cultural heritage, significant historical events, and the contributions of African societies to global development.",
  },
  {
    id: "2",
    title: "The Civil Rights Movement",
    description: "Documentary exploring the American Civil Rights Movement of the 1950s and 1960s.",
    type: "video",
    url: "https://storage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
    thumbnail: "/placeholder.svg?key=xidwn",
    channelId: "documentary",
    channelName: "Documentary Channel",
    dateAdded: "2023-06-20",
    duration: "45:30",
  },
  {
    id: "3",
    title: "Freedom Songs Collection",
    description: "A collection of important songs from the Civil Rights Movement.",
    type: "audio",
    url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3",
    thumbnail: "/placeholder.svg?key=5dqtb",
    channelId: "music",
    channelName: "Music Channel",
    dateAdded: "2023-07-10",
    duration: "1:12:45",
  },
  {
    id: "4",
    title: "Black Excellence Through History",
    description: "A documentary series highlighting achievements of Black individuals throughout history.",
    type: "video",
    url: "https://storage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4",
    thumbnail: "/placeholder.svg?key=xpj8h",
    channelId: "documentary",
    channelName: "Documentary Channel",
    dateAdded: "2023-08-05",
    duration: "1:28:15",
  },
  {
    id: "5",
    title: "Freedom School Curriculum Guide",
    description: "Educational materials for teaching in Freedom Schools.",
    type: "document",
    url: "#",
    thumbnail: "/placeholder.svg?key=21o8g",
    channelId: "education",
    channelName: "Education Channel",
    dateAdded: "2023-09-12",
    fileSize: "4.8 MB",
    content:
      "This curriculum guide provides a framework for teaching in Freedom Schools. It includes lesson plans, activities, and resources designed to promote critical thinking, cultural awareness, and social justice.",
  },
  {
    id: "6",
    title: "Spoken Word Poetry Collection",
    description: "A collection of powerful spoken word performances.",
    type: "audio",
    url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3",
    thumbnail: "/placeholder.svg?key=y5unx",
    channelId: "arts",
    channelName: "Arts Channel",
    dateAdded: "2023-10-18",
    duration: "58:20",
  },
]

// Function to get icon based on media type
const getMediaIcon = (type: MediaType) => {
  switch (type) {
    case "document":
      return <FileText className="h-6 w-6" />
    case "audio":
      return <Music className="h-6 w-6" />
    case "video":
      return <Video className="h-6 w-6" />
    default:
      return <FileText className="h-6 w-6" />
  }
}

export default function LibraryItemPage() {
  const params = useParams()
  const router = useRouter()
  const [item, setItem] = useState<LibraryItem | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // In a real implementation, this would fetch from your Supabase database
    // For now, we'll use the mock data
    const timer = setTimeout(() => {
      const foundItem = mockLibraryItems.find((i) => i.id === params.id)
      setItem(foundItem || null)
      setLoading(false)
    }, 500) // Simulate loading

    return () => clearTimeout(timer)
  }, [params.id])

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8 mt-16 flex justify-center items-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-white"></div>
      </div>
    )
  }

  if (!item) {
    return (
      <div className="container mx-auto px-4 py-8 mt-16 text-center">
        <h1 className="text-2xl font-bold mb-4">Item Not Found</h1>
        <p className="mb-6">The library item you're looking for doesn't exist or has been removed.</p>
        <Button onClick={() => router.push("/library")}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Library
        </Button>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8 mt-16">
      <Button variant="ghost" className="mb-6" onClick={() => router.push("/library")}>
        <ArrowLeft className="mr-2 h-4 w-4" /> Back to Library
      </Button>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left column - Media preview */}
        <div className="lg:col-span-2">
          {item.type === "video" && (
            <div className="bg-gray-900 rounded-lg overflow-hidden">
              <video src={item.url} controls className="w-full aspect-video" poster={item.thumbnail} />
            </div>
          )}

          {item.type === "audio" && (
            <div className="bg-gray-900 rounded-lg overflow-hidden p-6">
              <div className="relative h-60 mb-6">
                <Image
                  src={item.thumbnail || "/placeholder.svg"}
                  alt={item.title}
                  fill
                  className="object-cover rounded-lg"
                />
              </div>
              <audio src={item.url} controls className="w-full" />
            </div>
          )}

          {item.type === "document" && (
            <div className="bg-gray-900 rounded-lg overflow-hidden p-6">
              <div className="relative h-60 mb-6">
                <Image
                  src={item.thumbnail || "/placeholder.svg"}
                  alt={item.title}
                  fill
                  className="object-cover rounded-lg"
                />
              </div>
              <div className="p-4 bg-gray-800 rounded-lg">
                <p className="text-gray-300 whitespace-pre-line">{item.content}</p>
              </div>
            </div>
          )}

          <div className="mt-6">
            <h1 className="text-2xl font-bold mb-2">{item.title}</h1>
            <p className="text-gray-400 mb-4">{item.description}</p>

            <div className="flex flex-wrap gap-4 mb-6">
              <Button className="flex items-center gap-2">
                <Download className="h-4 w-4" />
                Download
              </Button>
              <Button variant="outline" className="flex items-center gap-2">
                <Share className="h-4 w-4" />
                Share
              </Button>
            </div>
          </div>
        </div>

        {/* Right column - Details */}
        <div className="bg-gray-900 p-6 rounded-lg h-fit">
          <h2 className="text-lg font-semibold mb-4">Media Details</h2>

          <div className="space-y-4">
            <div className="flex items-center gap-3">
              {getMediaIcon(item.type)}
              <div>
                <p className="text-sm text-gray-400">Type</p>
                <p className="font-medium capitalize">{item.type}</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Calendar className="h-5 w-5 text-gray-400" />
              <div>
                <p className="text-sm text-gray-400">Date Added</p>
                <p className="font-medium">{item.dateAdded}</p>
              </div>
            </div>

            {item.duration && (
              <div className="flex items-center gap-3">
                <Clock className="h-5 w-5 text-gray-400" />
                <div>
                  <p className="text-sm text-gray-400">Duration</p>
                  <p className="font-medium">{item.duration}</p>
                </div>
              </div>
            )}

            {item.fileSize && (
              <div className="flex items-center gap-3">
                <HardDrive className="h-5 w-5 text-gray-400" />
                <div>
                  <p className="text-sm text-gray-400">File Size</p>
                  <p className="font-medium">{item.fileSize}</p>
                </div>
              </div>
            )}

            <div className="pt-4 border-t border-gray-800">
              <p className="text-sm text-gray-400 mb-2">Channel</p>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-gray-800 rounded-full flex items-center justify-center">
                  {item.channelName.charAt(0)}
                </div>
                <span>{item.channelName}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
