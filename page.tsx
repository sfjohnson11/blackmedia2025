"use client"

import { useState } from "react"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { CheckCircle, XCircle, ArrowLeft, Upload } from "lucide-react"

interface ChannelData {
  id: string
  name: string
  slug: string
  description: string
}

export default function ImportPage() {
  const [isLoading, setIsLoading] = useState(false)
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null)
  const [channels, setChannels] = useState<ChannelData[]>([])

  const fetchChannels = async () => {
    setIsLoading(true)
    setResult(null)

    try {
      const response = await fetch(
        "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/BlackTruthTV_Channels_Upload_CLEANED%20%281%29-M1SHKYhmm34xiZWMsQZTVVCSd7cZeX.csv",
      )

      if (!response.ok) {
        throw new Error(`Failed to fetch CSV: ${response.status} ${response.statusText}`)
      }

      const csvText = await response.text()
      const lines = csvText.split("\n")
      const headers = lines[0].split(",").map((h) => h.trim())

      const parsedChannels: ChannelData[] = []
      for (let i = 1; i < lines.length; i++) {
        if (!lines[i].trim()) continue // Skip empty lines

        const values = lines[i].split(",")
        const channel: any = {}

        headers.forEach((header, index) => {
          channel[header] = values[index] ? values[index].trim() : ""
        })

        parsedChannels.push(channel)
      }

      setChannels(parsedChannels)
      setResult({
        success: true,
        message: `Successfully fetched ${parsedChannels.length} channels from CSV.`,
      })
    } catch (error) {
      console.error("Error fetching channels:", error)
      setResult({
        success: false,
        message: error instanceof Error ? error.message : "An unknown error occurred",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const importChannels = async () => {
    if (channels.length === 0) {
      setResult({
        success: false,
        message: "Please fetch channels first before importing.",
      })
      return
    }

    setIsLoading(true)
    setResult(null)

    try {
      // Format channels for import
      const channelsToImport = channels.map((channel) => ({
        id: channel.id,
        name: channel.name,
        slug: channel.slug,
        description: channel.description,
        logo_url: `https://placehold.co/400x225?text=${encodeURIComponent(channel.name)}`,
      }))

      // Clear existing channels first
      const { error: deleteError } = await supabase.from("channels").delete().gt("id", "0")

      if (deleteError) {
        throw new Error(`Error clearing existing channels: ${deleteError.message}`)
      }

      // Insert channels
      const { error: insertError } = await supabase.from("channels").insert(channelsToImport)

      if (insertError) {
        throw new Error(`Error importing channels: ${insertError.message}`)
      }

      setResult({
        success: true,
        message: `Successfully imported ${channels.length} channels to Supabase.`,
      })
    } catch (error) {
      console.error("Error importing channels:", error)
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
          <h1 className="text-2xl font-bold">Import Black Truth TV Channels</h1>
        </div>

        <div className="mb-6">
          <p className="mb-4">
            Import your channels from the provided CSV file. This will replace any existing channels in your database.
          </p>

          <div className="flex flex-col gap-4 mt-6">
            <Button onClick={fetchChannels} disabled={isLoading} className="bg-blue-600 hover:bg-blue-700 w-full">
              <Upload className="h-4 w-4 mr-2" />
              {isLoading ? "Fetching..." : "Fetch Channels from CSV"}
            </Button>

            {channels.length > 0 && (
              <div className="bg-gray-900 p-4 rounded mb-4">
                <h3 className="font-semibold mb-2">Channels Found: {channels.length}</h3>
                <div className="max-h-60 overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-700">
                        <th className="text-left py-2">ID</th>
                        <th className="text-left py-2">Name</th>
                        <th className="text-left py-2">Slug</th>
                      </tr>
                    </thead>
                    <tbody>
                      {channels.map((channel, index) => (
                        <tr key={index} className="border-b border-gray-800">
                          <td className="py-2">{channel.id}</td>
                          <td className="py-2">{channel.name}</td>
                          <td className="py-2">{channel.slug}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <Button
              onClick={importChannels}
              disabled={isLoading || channels.length === 0}
              className="bg-red-600 hover:bg-red-700 w-full"
            >
              {isLoading ? "Importing..." : "Import Channels to Database"}
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
              {result.success && result.message.includes("imported") && (
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
