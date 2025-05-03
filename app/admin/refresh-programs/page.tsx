"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { RefreshCw, Check, ArrowLeft } from "lucide-react"
import Link from "next/link"

export default function RefreshProgramsPage() {
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [refreshed, setRefreshed] = useState(false)
  const [message, setMessage] = useState("")

  const handleRefresh = async () => {
    setIsRefreshing(true)
    setMessage("Clearing cache and refreshing program data...")

    try {
      // Clear localStorage cache if any exists
      localStorage.removeItem("programCache")
      localStorage.removeItem("channelCache")

      // Force browser to reload without cache
      const reloadOptions = {
        cache: "reload",
        headers: {
          "Cache-Control": "no-cache",
        },
      }

      // Fetch a timestamp to ensure we're getting fresh data
      await fetch(`/api/refresh-cache?t=${Date.now()}`, reloadOptions)

      setMessage("Program data refreshed successfully! You can now return to viewing channels.")
      setRefreshed(true)
    } catch (error) {
      setMessage(`Error refreshing data: ${error instanceof Error ? error.message : String(error)}`)
    } finally {
      setIsRefreshing(false)
    }
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="mb-6">
        <Link href="/admin" className="flex items-center text-blue-500 hover:text-blue-700">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Admin Dashboard
        </Link>
      </div>

      <div className="bg-gray-800 rounded-lg p-6 shadow-lg">
        <h1 className="text-2xl font-bold mb-6">Refresh Program Data</h1>

        <p className="mb-4 text-gray-300">
          Use this tool to refresh program data and clear any cached information. This is helpful when:
        </p>

        <ul className="list-disc pl-5 mb-6 text-gray-300 space-y-1">
          <li>You've recently updated the program schedule</li>
          <li>You're seeing outdated program information</li>
          <li>Videos aren't loading correctly</li>
          <li>Channel information appears to be stale</li>
        </ul>

        <div className="flex justify-center mb-6">
          <Button
            onClick={handleRefresh}
            disabled={isRefreshing || refreshed}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {isRefreshing ? (
              <>
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                Refreshing...
              </>
            ) : refreshed ? (
              <>
                <Check className="mr-2 h-4 w-4" />
                Refreshed
              </>
            ) : (
              <>
                <RefreshCw className="mr-2 h-4 w-4" />
                Refresh Program Data
              </>
            )}
          </Button>
        </div>

        {message && (
          <div className={`p-4 rounded-md ${refreshed ? "bg-green-900/30" : "bg-blue-900/30"}`}>{message}</div>
        )}

        {refreshed && (
          <div className="mt-6 flex justify-center space-x-4">
            <Link href="/channels">
              <Button>Go to Channels</Button>
            </Link>
            <Button onClick={() => window.location.reload()} variant="outline">
              Reload Page
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
