"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"
import { Loader2, Save, AlertTriangle, ArrowLeft } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export default function LiveStreamsAdmin() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [liveStreams, setLiveStreams] = useState<any[]>([])
  const [channels, setChannels] = useState<any[]>([])
  const [newStreamUrl, setNewStreamUrl] = useState("")
  const [selectedChannelId, setSelectedChannelId] = useState("21") // Default to channel 21

  // Fetch live streams and channels
  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true)
        setError(null)

        // Create the table if it doesn't exist
        await fetch("/api/setup-live-streams")

        // Fetch channels
        const { data: channelsData, error: channelsError } = await supabase
          .from("channels")
          .select("id, name")
          .order("id")

        if (channelsError) throw channelsError
        setChannels(channelsData || [])

        // Fetch live streams
        const { data: streamsData, error: streamsError } = await supabase
          .from("live_streams")
          .select("*")
          .order("channel_id")

        if (streamsError) throw streamsError
        setLiveStreams(streamsData || [])

        // If channel 21 has a stream URL, set it as the current value
        const channel21Stream = streamsData?.find((stream) => stream.channel_id === "21")
        if (channel21Stream) {
          setNewStreamUrl(channel21Stream.stream_url)
        }
      } catch (err) {
        console.error("Error fetching data:", err)
        setError("Failed to load data. Please try again.")
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [])

  // Save live stream URL
  const handleSave = async () => {
    try {
      setSaving(true)
      setError(null)
      setSuccess(null)

      if (!newStreamUrl.trim()) {
        setError("Please enter a valid stream URL")
        return
      }

      const response = await fetch("/api/setup-live-streams", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          channelId: selectedChannelId,
          streamUrl: newStreamUrl.trim(),
        }),
      })

      const result = await response.json()

      if (!response.ok || !result.success) {
        throw new Error(result.error || "Failed to save stream URL")
      }

      setSuccess(`Stream URL for channel ${selectedChannelId} saved successfully`)

      // Refresh the live streams list
      const { data, error } = await supabase.from("live_streams").select("*").order("channel_id")

      if (error) throw error
      setLiveStreams(data || [])
    } catch (err) {
      console.error("Error saving stream URL:", err)
      setError(err instanceof Error ? err.message : "An unknown error occurred")
    } finally {
      setSaving(false)
    }
  }

  // Handle channel selection
  const handleChannelChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const channelId = e.target.value
    setSelectedChannelId(channelId)

    // Update the URL input with the existing URL for this channel, if any
    const existingStream = liveStreams.find((stream) => stream.channel_id === channelId)
    setNewStreamUrl(existingStream?.stream_url || "")
  }

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[80vh]">
        <div className="flex flex-col items-center">
          <Loader2 className="h-12 w-12 text-red-600 animate-spin mb-4" />
          <p className="text-xl">Loading live stream settings...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">Live Stream Management</h1>
        <Link href="/admin">
          <Button variant="outline" className="flex items-center gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back to Admin
          </Button>
        </Link>
      </div>

      {error && (
        <div className="bg-red-900/30 border border-red-700 text-red-400 px-4 py-3 rounded mb-6 flex items-start">
          <AlertTriangle className="h-5 w-5 mr-2 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="bg-green-900/30 border border-green-700 text-green-400 px-4 py-3 rounded mb-6">{success}</div>
      )}

      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Add/Update Live Stream</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <label className="block text-sm font-medium mb-2">Channel</label>
            <select
              value={selectedChannelId}
              onChange={handleChannelChange}
              className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md"
            >
              {channels.map((channel) => (
                <option key={channel.id} value={channel.id}>
                  Channel {channel.id}: {channel.name}
                </option>
              ))}
            </select>
          </div>

          <div className="mb-6">
            <label className="block text-sm font-medium mb-2">Stream URL (HLS .m3u8 format recommended)</label>
            <input
              type="text"
              value={newStreamUrl}
              onChange={(e) => setNewStreamUrl(e.target.value)}
              placeholder="https://example.com/stream.m3u8"
              className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md"
            />
            <p className="text-xs text-gray-400 mt-1">
              For testing, you can use: https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8
            </p>
          </div>

          <Button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-md"
          >
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Save Stream URL
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {liveStreams.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Current Live Streams</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead className="bg-gray-900">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                      Channel
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                      Stream URL
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                      Last Updated
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-700">
                  {liveStreams.map((stream) => (
                    <tr key={stream.id}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {channels.find((c) => c.id === stream.channel_id)?.name || `Channel ${stream.channel_id}`}
                      </td>
                      <td className="px-6 py-4">
                        <div className="truncate max-w-xs">{stream.stream_url}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">{new Date(stream.updated_at).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-6 text-center">
            <p>No live streams configured yet. Add your first stream above.</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
