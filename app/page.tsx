import { ChannelRow } from "@/components/channel-row"
import { FeaturedChannel } from "@/components/featured-channel"
import { supabase, checkSupabaseConnection, checkTablesExist, createTables } from "@/lib/supabase"
import type { Channel } from "@/types"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { DatabaseIcon, WifiOff, ArrowRight } from "lucide-react"

async function getChannels() {
  try {
    // First check if we can connect to Supabase
    const isConnected = await checkSupabaseConnection()
    if (!isConnected) {
      return { channels: [], error: "Cannot connect to Supabase", tablesExist: false }
    }

    // Check if tables exist
    const tablesExist = await checkTablesExist()
    if (!tablesExist) {
      return { channels: [], error: "Tables do not exist", tablesExist: false }
    }

    const { data, error } = await supabase.from("channels").select("*").order("id")

    if (error) {
      console.error("Error fetching channels:", error)
      return { channels: [], error: error.message, tablesExist: true }
    }

    return { channels: data as Channel[], error: null, tablesExist: true }
  } catch (error) {
    console.error("Error fetching channels:", error)
    return {
      channels: [],
      error: error instanceof Error ? error.message : "An unknown error occurred",
      tablesExist: false,
    }
  }
}

export default async function Home() {
  const { channels, error, tablesExist } = await getChannels()

  // Handle connection error
  if (error && !tablesExist) {
    return (
      <div className="pt-24 px-4 md:px-10 flex flex-col items-center justify-center min-h-[80vh]">
        <div className="bg-gray-800 p-6 rounded-lg max-w-2xl w-full">
          <div className="flex items-center justify-center mb-6">
            <WifiOff className="h-12 w-12 text-red-500" />
          </div>
          <h1 className="text-3xl font-bold mb-6 text-center">Connection Error</h1>
          <div className="bg-gray-900 p-6 rounded-lg mb-6">
            <h2 className="text-xl font-semibold mb-4">Unable to connect to Supabase</h2>
            <p className="mb-4">
              There was an error connecting to your Supabase database: <span className="text-red-400">{error}</span>
            </p>
            <p className="mb-4">This could be due to:</p>
            <ul className="list-disc pl-5 mb-4 space-y-2">
              <li>Network connectivity issues</li>
              <li>Incorrect Supabase URL or API key</li>
              <li>Supabase service being temporarily unavailable</li>
              <li>CORS issues in the browser</li>
            </ul>
            <p>Please check your Supabase configuration and try again.</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/setup">
              <Button className="bg-red-600 hover:bg-red-700 w-full">Go to Setup</Button>
            </Link>
            <Link href="https://supabase.com/dashboard" target="_blank">
              <Button variant="outline" className="w-full">
                Open Supabase Dashboard
              </Button>
            </Link>
          </div>
        </div>
      </div>
    )
  }

  // Check if tables need to be created
  if (!tablesExist) {
    return (
      <div className="pt-24 px-4 md:px-10 flex flex-col items-center justify-center min-h-[80vh]">
        <div className="bg-gray-800 p-6 rounded-lg max-w-2xl w-full">
          <div className="flex items-center justify-center mb-6">
            <DatabaseIcon className="h-12 w-12 text-blue-500" />
          </div>
          <h1 className="text-3xl font-bold mb-6 text-center">Welcome to Black Truth TV</h1>
          <div className="bg-gray-900 p-6 rounded-lg mb-6">
            <h2 className="text-xl font-semibold mb-4">Database Setup Required</h2>
            <p className="mb-4">
              Your database tables need to be created before you can use Black Truth TV. Click the button below to
              automatically create the required tables.
            </p>

            <SetupButton />

            <div className="mt-6 text-sm text-gray-400">
              <p className="mb-2">This will create the following tables:</p>
              <ul className="list-disc pl-5 space-y-1">
                <li>
                  <code>channels</code> - Stores your channel information
                </li>
                <li>
                  <code>videos</code> - Stores your video content
                </li>
              </ul>
            </div>
          </div>

          <div className="flex flex-col gap-4 items-center">
            <Link href="/setup">
              <Button variant="outline" className="flex items-center gap-2">
                Advanced Setup Options
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </div>
    )
  }

  // Check if channels table exists but is empty
  if (channels.length === 0) {
    return (
      <div className="pt-24 px-4 md:px-10 flex flex-col items-center justify-center min-h-[80vh]">
        <div className="bg-gray-800 p-6 rounded-lg max-w-2xl w-full">
          <div className="flex items-center justify-center mb-6">
            <DatabaseIcon className="h-12 w-12 text-green-500" />
          </div>
          <h1 className="text-3xl font-bold mb-6 text-center">Tables Created Successfully</h1>
          <div className="bg-gray-900 p-6 rounded-lg mb-6">
            <h2 className="text-xl font-semibold mb-4">Import Your Channels</h2>
            <p className="mb-4">
              Your database tables have been created, but you need to import your channels. Click the button below to
              import your Black Truth TV channels from the CSV file.
            </p>

            <div className="flex justify-center mt-6">
              <Link href="/setup/import">
                <Button className="bg-red-600 hover:bg-red-700">Import Channels</Button>
              </Link>
            </div>
          </div>

          <div className="flex flex-col gap-4 items-center">
            <Link href="/setup">
              <Button variant="outline" className="flex items-center gap-2">
                View All Setup Options
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </div>
    )
  }

  const featuredChannel = channels.length > 0 ? channels[0] : null

  // Group channels into rows of 5
  const channelRows = []
  for (let i = 0; i < channels.length; i += 5) {
    channelRows.push(channels.slice(i, i + 5))
  }

  return (
    <div className="pt-16">
      {featuredChannel && <FeaturedChannel channel={featuredChannel} />}

      <section className="px-4 md:px-10 pb-10">
        <h2 className="text-2xl font-bold mb-6 mt-8">All Channels</h2>

        {channelRows.map((row, index) => (
          <ChannelRow key={index} channels={row} />
        ))}
      </section>
    </div>
  )
}
// Client component for setup button
;("use client")
function SetupButton() {
  import { useState } from "react"

  const [isLoading, setIsLoading] = useState(false)
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null)

  const handleSetup = async () => {
    setIsLoading(true)
    try {
      const { success, error } = await createTables()
      if (success) {
        setResult({ success: true, message: "Tables created successfully!" })
        // Reload the page after a short delay
        setTimeout(() => {
          window.location.reload()
        }, 1500)
      } else {
        setResult({ success: false, message: error || "Failed to create tables" })
      }
    } catch (e) {
      setResult({
        success: false,
        message: e instanceof Error ? e.message : "An unknown error occurred",
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex flex-col items-center gap-4">
      <Button onClick={handleSetup} disabled={isLoading} className="bg-red-600 hover:bg-red-700 w-full max-w-xs">
        {isLoading ? "Creating Tables..." : "Create Database Tables"}
      </Button>

      {result && (
        <div
          className={`p-3 rounded-md w-full ${
            result.success ? "bg-green-900/30 text-green-400" : "bg-red-900/30 text-red-400"
          }`}
        >
          {result.message}
        </div>
      )}
    </div>
  )
}
