"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"
import type { Channel } from "@/types"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Search, Filter, Loader2 } from "lucide-react"
import { ChannelGrid } from "@/components/channel-grid"

export default function BrowsePage() {
  const [channels, setChannels] = useState<Channel[]>([])
  const [filteredChannels, setFilteredChannels] = useState<Channel[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Fetch channels on component mount
  useEffect(() => {
    async function fetchChannels() {
      try {
        setIsLoading(true)
        const { data, error } = await supabase.from("channels").select("*")

        if (error) {
          throw error
        }

        // Sort channels numerically by ID
        const sortedData = (data as Channel[]).sort((a, b) => {
          const aNum = Number.parseInt(a.id, 10)
          const bNum = Number.parseInt(b.id, 10)
          return aNum - bNum
        })

        setChannels(sortedData)
        setFilteredChannels(sortedData)
      } catch (error) {
        console.error("Error fetching channels:", error)
        setError("Failed to load channels. Please try again later.")
      } finally {
        setIsLoading(false)
      }
    }

    fetchChannels()
  }, [])

  // Filter channels based on search term
  useEffect(() => {
    if (searchTerm.trim() === "") {
      setFilteredChannels(channels)
      return
    }

    const term = searchTerm.toLowerCase()
    const filtered = channels.filter(
      (channel) =>
        channel.name.toLowerCase().includes(term) ||
        (channel.description && channel.description.toLowerCase().includes(term)),
    )

    setFilteredChannels(filtered)
  }, [searchTerm, channels])

  // Handle search input change
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value)
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="pt-24 px-4 md:px-10 flex items-center justify-center min-h-[80vh]">
        <div className="flex flex-col items-center">
          <Loader2 className="h-12 w-12 text-red-600 animate-spin mb-4" />
          <p className="text-xl">Loading channels...</p>
        </div>
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div className="pt-24 px-4 md:px-10 flex items-center justify-center min-h-[80vh]">
        <div className="bg-gray-800 p-6 rounded-lg max-w-md w-full text-center">
          <h2 className="text-xl font-semibold mb-4">Error</h2>
          <p className="mb-4">{error}</p>
          <Button className="bg-red-600 hover:bg-red-700" onClick={() => window.location.reload()}>
            Try Again
          </Button>
        </div>
      </div>
    )
  }

  // No channels state
  if (channels.length === 0) {
    return (
      <div className="pt-24 px-4 md:px-10 flex items-center justify-center min-h-[80vh]">
        <div className="bg-gray-800 p-6 rounded-lg max-w-md w-full text-center">
          <h2 className="text-xl font-semibold mb-4">No Channels Found</h2>
          <p className="mb-4">Please set up your database tables and add some channels to get started.</p>
          <Link href="/setup">
            <Button className="bg-red-600 hover:bg-red-700">Go to Setup</Button>
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="pt-24 px-4 md:px-10 pb-10">
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8">
        <h1 className="text-3xl font-bold mb-4 md:mb-0">Browse All Channels</h1>

        <div className="flex space-x-4">
          <div className="relative">
            <input
              type="text"
              placeholder="Search channels..."
              className="pl-10 pr-4 py-2 bg-gray-900 border border-gray-700 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent w-full md:w-64"
              value={searchTerm}
              onChange={handleSearchChange}
            />
            <Search className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
            {searchTerm && (
              <button
                className="absolute right-3 top-2.5 text-gray-400 hover:text-white"
                onClick={() => setSearchTerm("")}
              >
                ×
              </button>
            )}
          </div>

          <Button variant="outline" className="flex items-center gap-2">
            <Filter className="h-4 w-4" />
            <span>Filter</span>
          </Button>
        </div>
      </div>

      {filteredChannels.length === 0 ? (
        <div className="bg-gray-800 p-6 rounded-lg text-center my-12">
          <h2 className="text-xl font-semibold mb-2">No results found</h2>
          <p className="text-gray-400">No channels match your search for "{searchTerm}"</p>
          <Button variant="link" className="text-red-500 mt-2" onClick={() => setSearchTerm("")}>
            Clear search
          </Button>
        </div>
      ) : (
        <ChannelGrid channels={filteredChannels} />
      )}
    </div>
  )
}
