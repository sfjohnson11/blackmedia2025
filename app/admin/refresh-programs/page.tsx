"use client"

import { useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { ArrowLeft, RefreshCw } from "lucide-react"
import { supabase } from "@/lib/supabase"

export default function RefreshProgramsPage() {
  const [isLoading, setIsLoading] = useState(false)
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null)
  const [channelId, setChannelId] = useState<string>("")
  const [channels, setChannels] = useState<Array<{ id: string; name: string }>>([])

  // Fetch channels on component mount
  useState(() => {
    const fetchChannels = async () => {
      const { data } = await supabase.from("channels").select("id, name").order("id")
      if (data) {
        setChannels(data)
      }
    }

    fetchChannels()
  })

  const handleRefresh = async () => {
    setIsLoading(true)
    setResult(null)

    try {
      // Clear browser's localStorage cache for currently playing data
      localStorage.removeItem("currentlyPlaying")

      // If a specific channel is selected, clear its cache in localStorage
      if (channelId) {
        const cacheKeys = Object.keys(localStorage)
        cacheKeys.forEach((key) => {
          if (key.includes(channelId)) {
            localStorage.removeItem(key)
          }
        })

        setResult({
          success: true,
          message: `Successfully cleared cache for channel ${channelId}. Please return to the channel page and refresh.`,
        })
      } else {
        // Clear all program-related cache
        const cacheKeys = Object.keys(localStorage)
        cacheKeys.forEach((key) => {
          if (key.includes("channel") || key.includes("program") || key.includes("Playing")) {
            localStorage.removeItem(key)
          }
        })

        setResult({
          success: true,
          message: "Successfully cleared all program caches. Please return to the channel pages and refresh.",
        })
      }
    } catch (error) {
      console.error("Error refreshing programs:", error)
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
      <div className="bg-gray-800 p-6 rounded-lg max-w-4xl w-full">
        <div className="flex items-center mb-6">
          <Link href="/admin" className="mr-4">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Admin
            </Button>
          </Link>
          <h1 className="text-2xl font-bold">Refresh Program Data</h1>
        </div>

        <div className="mb-6">
          <p className="mb-4">
            If you've updated program schedules but still see old data in the app, use this tool to clear cached program
            data. This will force the app to fetch fresh program data from the database.
          </p>

          <div className="bg-blue-900/30 p-4 rounded-md mb-6">
            <p className="text-gray-300">
              Select a specific channel to refresh, or leave blank to refresh all channels.
            </p>
          </div>

          <div className="bg-gray-900 p-4 rounded mb-6">
            <h3 className="font-semibold mb-4">Select Channel (Optional)</h3>

            <div className="mb-4">
              <select
                value={channelId}
                onChange={(e) => setChannelId(e.target.value)}
                className="w-full p-2 bg-gray-800 border border-gray-700 rounded-md"
              >
                <option value="">All Channels</option>
                {channels.map((channel) => (
                  <option key={channel.id} value={channel.id}>
                    Channel {channel.id}: {channel.name}
                  </option>
                ))}
              </select>
            </div>

            <Button onClick={handleRefresh} disabled={isLoading} className="w-full bg-red-600 hover:bg-red-700">
              {isLoading ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Refreshing...
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Refresh Program Data
                </>
              )}
            </Button>
          </div>

          {result && (
            <div
              className={`mt-6 p-4 rounded-md ${result.success ? "bg-green-900/30 text-green-400" : "bg-red-900/30 text-red-400"}`}
            >
              <p>{result.message}</p>
              {result.success && (
                <div className="mt-4 text-center">
                  <Link href="/channels">
                    <Button className="bg-green-600 hover:bg-green-700 mr-4">Go to Channels</Button>
                  </Link>
                  <Link href="/admin">
                    <Button variant="outline">Return to Admin</Button>
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
