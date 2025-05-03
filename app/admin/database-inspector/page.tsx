"use client"

import type React from "react"

import { useState, useEffect } from "react"
import Link from "next/link"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { ArrowLeft, Database, RefreshCw, Trash2, CheckCircle, XCircle, AlertTriangle } from "lucide-react"

export default function DatabaseInspectorPage() {
  const [isLoading, setIsLoading] = useState(false)
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null)
  const [databaseInfo, setDatabaseInfo] = useState<any>(null)
  const [selectedChannel, setSelectedChannel] = useState<string>("1")
  const [channelPrograms, setChannelPrograms] = useState<any[]>([])
  const [isProgramsLoading, setIsProgramsLoading] = useState(false)
  const [isResetting, setIsResetting] = useState(false)

  // Fetch database info on load
  useEffect(() => {
    fetchDatabaseInfo()
  }, [])

  // Fetch database info
  const fetchDatabaseInfo = async () => {
    setIsLoading(true)
    setResult(null)

    try {
      // Get channels
      const { data: channels, error: channelsError } = await supabase
        .from("channels")
        .select("*")
        .order("id", { ascending: true })

      if (channelsError) {
        throw new Error(`Error fetching channels: ${channelsError.message}`)
      }

      // Get program counts by channel
      const programCounts: Record<string, number> = {}

      for (const channel of channels) {
        const { count, error: countError } = await supabase
          .from("programs")
          .select("*", { count: "exact", head: true })
          .eq("channel_id", channel.id)

        if (countError) {
          console.error(`Error counting programs for channel ${channel.id}:`, countError)
          programCounts[channel.id] = -1 // Error indicator
        } else {
          programCounts[channel.id] = count || 0
        }
      }

      // Get total program count
      const { count: totalPrograms, error: totalError } = await supabase
        .from("programs")
        .select("*", { count: "exact", head: true })

      if (totalError) {
        throw new Error(`Error counting total programs: ${totalError.message}`)
      }

      setDatabaseInfo({
        channels,
        programCounts,
        totalPrograms,
        timestamp: new Date().toISOString(),
      })

      setResult({
        success: true,
        message: `Successfully fetched database information. Found ${channels.length} channels and ${totalPrograms} total programs.`,
      })
    } catch (error) {
      console.error("Error fetching database info:", error)
      setResult({
        success: false,
        message: error instanceof Error ? error.message : "An unknown error occurred",
      })
    } finally {
      setIsLoading(false)
    }
  }

  // Fetch programs for a specific channel
  const fetchChannelPrograms = async (channelId: string) => {
    setIsProgramsLoading(true)
    setChannelPrograms([])

    try {
      const { data: programs, error } = await supabase
        .from("programs")
        .select("*")
        .eq("channel_id", channelId)
        .order("start_time", { ascending: true })

      if (error) {
        throw new Error(`Error fetching programs for channel ${channelId}: ${error.message}`)
      }

      setChannelPrograms(programs || [])
    } catch (error) {
      console.error(`Error fetching programs for channel ${channelId}:`, error)
      setResult({
        success: false,
        message: error instanceof Error ? error.message : "An unknown error occurred",
      })
    } finally {
      setIsProgramsLoading(false)
    }
  }

  // Handle channel selection change
  const handleChannelChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const channelId = e.target.value
    setSelectedChannel(channelId)
    fetchChannelPrograms(channelId)
  }

  // Reset programs for a specific channel
  const resetChannelPrograms = async (channelId: string) => {
    if (!confirm(`Are you sure you want to delete ALL programs for channel ${channelId}? This cannot be undone.`)) {
      return
    }

    setIsResetting(true)
    setResult(null)

    try {
      const { error } = await supabase.from("programs").delete().eq("channel_id", channelId)

      if (error) {
        throw new Error(`Error deleting programs for channel ${channelId}: ${error.message}`)
      }

      setResult({
        success: true,
        message: `Successfully deleted all programs for channel ${channelId}.`,
      })

      // Refresh data
      fetchDatabaseInfo()
      setChannelPrograms([])
    } catch (error) {
      console.error(`Error resetting programs for channel ${channelId}:`, error)
      setResult({
        success: false,
        message: error instanceof Error ? error.message : "An unknown error occurred",
      })
    } finally {
      setIsResetting(false)
    }
  }

  // Reset all programs
  const resetAllPrograms = async () => {
    if (!confirm("⚠️ WARNING: Are you sure you want to delete ALL programs for ALL channels? This cannot be undone.")) {
      return
    }

    if (!confirm("⚠️ FINAL WARNING: This will completely erase your program schedule. Type 'DELETE' to confirm.")) {
      return
    }

    setIsResetting(true)
    setResult(null)

    try {
      const { error } = await supabase.from("programs").delete().gt("id", "0") // Delete all programs

      if (error) {
        throw new Error(`Error deleting all programs: ${error.message}`)
      }

      setResult({
        success: true,
        message: `Successfully deleted all programs from the database.`,
      })

      // Refresh data
      fetchDatabaseInfo()
      setChannelPrograms([])
    } catch (error) {
      console.error("Error resetting all programs:", error)
      setResult({
        success: false,
        message: error instanceof Error ? error.message : "An unknown error occurred",
      })
    } finally {
      setIsResetting(false)
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
          <h1 className="text-2xl font-bold">Database Inspector</h1>
        </div>

        <div className="mb-6">
          <p className="mb-4">
            This tool helps you inspect and manage your database. You can view channel information, program counts, and
            reset program data if needed.
          </p>

          <div className="flex justify-end mb-4">
            <Button onClick={fetchDatabaseInfo} disabled={isLoading} className="bg-blue-600 hover:bg-blue-700">
              {isLoading ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Refreshing...
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Refresh Data
                </>
              )}
            </Button>
          </div>

          {databaseInfo && (
            <div className="space-y-6">
              <div className="bg-gray-900 p-4 rounded-md">
                <h3 className="font-semibold mb-4 flex items-center">
                  <Database className="h-5 w-5 mr-2 text-blue-500" />
                  Database Summary
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-gray-800 p-3 rounded-md">
                    <p className="text-sm text-gray-400">Total Channels:</p>
                    <p className="text-xl font-bold">{databaseInfo.channels.length}</p>
                  </div>
                  <div className="bg-gray-800 p-3 rounded-md">
                    <p className="text-sm text-gray-400">Total Programs:</p>
                    <p className="text-xl font-bold">{databaseInfo.totalPrograms}</p>
                  </div>
                </div>

                <div className="mt-4">
                  <p className="text-xs text-gray-400">
                    Last refreshed: {new Date(databaseInfo.timestamp).toLocaleString()}
                  </p>
                </div>
              </div>

              <div className="bg-gray-900 p-4 rounded-md">
                <h3 className="font-semibold mb-4">Channel Program Counts</h3>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                  {databaseInfo.channels.map((channel: any) => (
                    <div
                      key={channel.id}
                      className="bg-gray-800 p-3 rounded-md flex flex-col items-center justify-center text-center"
                    >
                      <p className="text-sm font-medium mb-1">Channel {channel.id}</p>
                      <p className="text-xs text-gray-400 mb-2">{channel.name}</p>
                      <p className="text-lg font-bold">
                        {databaseInfo.programCounts[channel.id] === -1
                          ? "Error"
                          : databaseInfo.programCounts[channel.id]}
                      </p>
                      <p className="text-xs text-gray-400">programs</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-gray-900 p-4 rounded-md">
                <h3 className="font-semibold mb-4">Inspect Channel Programs</h3>

                <div className="mb-4">
                  <label htmlFor="channelSelect" className="block text-sm font-medium mb-1">
                    Select Channel:
                  </label>
                  <div className="flex gap-2">
                    <select
                      id="channelSelect"
                      value={selectedChannel}
                      onChange={handleChannelChange}
                      className="flex-grow p-2 bg-gray-800 border border-gray-700 rounded-md"
                    >
                      {databaseInfo.channels.map((channel: any) => (
                        <option key={channel.id} value={channel.id}>
                          Channel {channel.id}: {channel.name} ({databaseInfo.programCounts[channel.id]} programs)
                        </option>
                      ))}
                    </select>
                    <Button
                      onClick={() => resetChannelPrograms(selectedChannel)}
                      disabled={isResetting}
                      className="bg-red-600 hover:bg-red-700"
                    >
                      {isResetting ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>

                {isProgramsLoading ? (
                  <div className="text-center py-8">
                    <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-2 text-blue-500" />
                    <p>Loading programs...</p>
                  </div>
                ) : channelPrograms.length > 0 ? (
                  <div className="max-h-80 overflow-y-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-700">
                          <th className="text-left py-2">ID</th>
                          <th className="text-left py-2">Title</th>
                          <th className="text-left py-2">Start Time</th>
                          <th className="text-left py-2">Duration</th>
                        </tr>
                      </thead>
                      <tbody>
                        {channelPrograms.map((program) => (
                          <tr key={program.id} className="border-b border-gray-800">
                            <td className="py-2">{program.id}</td>
                            <td className="py-2">{program.title}</td>
                            <td className="py-2">{new Date(program.start_time).toLocaleString()}</td>
                            <td className="py-2">{program.duration ? `${program.duration / 60} min` : "N/A"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-400">
                    <p>No programs found for this channel.</p>
                  </div>
                )}
              </div>

              <div className="bg-red-900/30 p-4 rounded-md">
                <h3 className="font-semibold mb-4 text-red-400 flex items-center">
                  <AlertTriangle className="h-5 w-5 mr-2" />
                  Danger Zone
                </h3>

                <p className="mb-4 text-sm">
                  These actions cannot be undone. Be very careful when using these options.
                </p>

                <Button
                  onClick={resetAllPrograms}
                  disabled={isResetting}
                  className="w-full bg-red-600 hover:bg-red-700"
                >
                  {isResetting ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      Resetting...
                    </>
                  ) : (
                    <>
                      <Trash2 className="h-4 w-4 mr-2" />
                      Reset ALL Programs (All Channels)
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}

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
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
