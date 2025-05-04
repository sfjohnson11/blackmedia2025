"use client"

import { useState, useEffect } from "react"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { Search, FileText, Music, Video, Filter } from "lucide-react"
import Link from "next/link"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"

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
}

// Mock data for initial display
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
  },
  {
    id: "2",
    title: "The Civil Rights Movement",
    description: "Documentary exploring the American Civil Rights Movement of the 1950s and 1960s.",
    type: "video",
    url: "#",
    thumbnail: "/placeholder.svg?key=bbnmv",
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
    url: "#",
    thumbnail: "/placeholder.svg?key=zk5dg",
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
    url: "#",
    thumbnail: "/placeholder.svg?key=cuhv6",
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
    thumbnail: "/placeholder.svg?key=4y17r",
    channelId: "education",
    channelName: "Education Channel",
    dateAdded: "2023-09-12",
    fileSize: "4.8 MB",
  },
  {
    id: "6",
    title: "Spoken Word Poetry Collection",
    description: "A collection of powerful spoken word performances.",
    type: "audio",
    url: "#",
    thumbnail: "/placeholder.svg?key=scual",
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

export default function LibraryPage() {
  const [searchQuery, setSearchQuery] = useState("")
  const [activeTab, setActiveTab] = useState("all")
  const [items, setItems] = useState<LibraryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [channels, setChannels] = useState<string[]>([])
  const [selectedChannel, setSelectedChannel] = useState<string | null>(null)

  useEffect(() => {
    // In a real implementation, this would fetch from your Supabase database
    // For now, we'll use the mock data
    const timer = setTimeout(() => {
      setItems(mockLibraryItems)

      // Extract unique channel names
      const uniqueChannels = Array.from(new Set(mockLibraryItems.map((item) => item.channelName)))
      setChannels(uniqueChannels)

      setLoading(false)
    }, 1000) // Simulate loading

    return () => clearTimeout(timer)
  }, [])

  // Filter items based on search query, active tab, and selected channel
  const filteredItems = items.filter((item) => {
    const matchesSearch =
      item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.description.toLowerCase().includes(searchQuery.toLowerCase())

    const matchesTab = activeTab === "all" || item.type === activeTab

    const matchesChannel = !selectedChannel || item.channelName === selectedChannel

    return matchesSearch && matchesTab && matchesChannel
  })

  return (
    <div className="container mx-auto px-4 py-8 mt-16">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold mb-2">Media Library</h1>
          <p className="text-gray-400">Access videos, audio, and documents from all channels</p>
        </div>
      </div>

      {/* Search and filter */}
      <div className="flex flex-col md:flex-row gap-4 mb-8">
        <div className="relative flex-grow">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
          <Input
            type="text"
            placeholder="Search library..."
            className="pl-10 bg-gray-900 border-gray-700"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="flex gap-2">
          <select
            className="bg-gray-900 border border-gray-700 rounded-md px-3 py-2 text-sm"
            value={selectedChannel || ""}
            onChange={(e) => setSelectedChannel(e.target.value || null)}
          >
            <option value="">All Channels</option>
            {channels.map((channel) => (
              <option key={channel} value={channel}>
                {channel}
              </option>
            ))}
          </select>

          <Button variant="outline" className="flex items-center gap-2 bg-gray-800 border-gray-700">
            <Filter className="h-4 w-4" />
            <span>Filter</span>
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="all" value={activeTab} onValueChange={setActiveTab} className="mb-8">
        <TabsList className="bg-gray-900">
          <TabsTrigger value="all" className="data-[state=active]:bg-gray-800">
            All
          </TabsTrigger>
          <TabsTrigger value="video" className="data-[state=active]:bg-gray-800">
            Videos
          </TabsTrigger>
          <TabsTrigger value="audio" className="data-[state=active]:bg-gray-800">
            Audio
          </TabsTrigger>
          <TabsTrigger value="document" className="data-[state=active]:bg-gray-800">
            Documents
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Library items grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="bg-gray-900 rounded-lg overflow-hidden">
              <Skeleton className="h-40 w-full" />
              <div className="p-4">
                <Skeleton className="h-6 w-3/4 mb-2" />
                <Skeleton className="h-4 w-full mb-1" />
                <Skeleton className="h-4 w-2/3" />
              </div>
            </div>
          ))}
        </div>
      ) : filteredItems.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {filteredItems.map((item) => (
            <Link href={`/library/${item.id}`} key={item.id}>
              <div className="bg-gray-900 rounded-lg overflow-hidden transition-transform hover:scale-105 hover:shadow-xl">
                <div className="relative h-40">
                  <Image src={item.thumbnail || "/placeholder.svg"} alt={item.title} fill className="object-cover" />
                  <div className="absolute top-2 right-2 bg-black/70 p-1 rounded-md">{getMediaIcon(item.type)}</div>
                  {item.type === "video" && item.duration && (
                    <div className="absolute bottom-2 right-2 bg-black/70 px-2 py-1 text-xs rounded-md">
                      {item.duration}
                    </div>
                  )}
                </div>
                <div className="p-4">
                  <h3 className="font-bold mb-1 line-clamp-1">{item.title}</h3>
                  <p className="text-sm text-gray-400 mb-2 line-clamp-2">{item.description}</p>
                  <div className="flex justify-between items-center text-xs text-gray-500">
                    <span>{item.channelName}</span>
                    <span>{item.type === "document" ? item.fileSize : ""}</span>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <div className="inline-flex justify-center items-center w-16 h-16 rounded-full bg-gray-900 mb-4">
            <Search className="h-8 w-8 text-gray-400" />
          </div>
          <h2 className="text-xl font-semibold mb-2">No results found</h2>
          <p className="text-gray-400 max-w-md mx-auto">
            We couldn't find any media matching your search. Try adjusting your filters or search terms.
          </p>
        </div>
      )}
    </div>
  )
}
