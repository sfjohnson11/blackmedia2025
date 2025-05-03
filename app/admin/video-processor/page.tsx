"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Loader2, CheckCircle, AlertCircle, RefreshCw, Play, FileVideo, Database } from "lucide-react"
import { createClient } from "@supabase/supabase-js"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ""
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""
const supabase = createClient(supabaseUrl, supabaseAnonKey)

export default function VideoProcessorPage() {
  const [channels, setChannels] = useState<any[]>([])
  const [selectedChannel, setSelectedChannel] = useState<number | null>(null)
  const [programs, setPrograms] = useState<any[]>([])
  const [loading, setLoading] = useState<boolean>(false)
  const [processingStatus, setProcessingStatus] = useState<Record<string, string>>({})
  const [activeTab, setActiveTab] = useState<string>("videos")
  const [message, setMessage] = useState<{ type: "success" | "error" | "info" | null; text: string }>({
    type: null,
    text: "",
  })

  // Fetch channels on component mount
  useEffect(() => {
    fetchChannels()
  }, [])

  // Fetch programs when a channel is selected
  useEffect(() => {
    if (selectedChannel !== null) {
      fetchProgramsForChannel(selectedChannel)
    }
  }, [selectedChannel])

  async function fetchChannels() {
    try {
      setLoading(true)
      const { data, error } = await supabase.from("channels").select("*").order("id")

      if (error) throw error
      setChannels(data || [])
    } catch (error) {
      console.error("Error fetching channels:", error)
      setMessage({ type: "error", text: "Failed to fetch channels" })
    } finally {
      setLoading(false)
    }
  }

  async function fetchProgramsForChannel(channelId: number) {
    try {
      setLoading(true)
      setPrograms([])
      const { data, error } = await supabase
        .from("programs")
        .select("*")
        .eq("channel_id", channelId)
        .order("start_time")

      if (error) throw error
      setPrograms(data || [])
    } catch (error) {
      console.error(`Error fetching programs for channel ${channelId}:`, error)
      setMessage({ type: "error", text: `Failed to fetch programs for channel ${channelId}` })
    } finally {
      setLoading(false)
    }
  }

  async function checkVideoUrl(url: string): Promise<boolean> {
    try {
      const response = await fetch(url, { method: "HEAD" })
      return response.ok
    } catch (error) {
      console.error("Error checking video URL:", error)
      return false
    }
  }

  async function processVideo(programId: number, mp4Url: string) {
    setProcessingStatus((prev) => ({ ...prev, [programId]: "checking" }))

    // Check if the video URL is accessible
    const isAccessible = await checkVideoUrl(mp4Url)

    if (isAccessible) {
      setProcessingStatus((prev) => ({ ...prev, [programId]: "success" }))
    } else {
      // Try alternative URL formats
      const fileName = mp4Url.split("/").pop()
      if (!fileName) {
        setProcessingStatus((prev) => ({ ...prev, [programId]: "error" }))
        return
      }

      const baseUrl = "https://msllqpnxwbugvkpnquwx.supabase.co/storage/v1/object/public"
      const alternativeUrls = [
        `${baseUrl}/channel${selectedChannel}/${fileName}`,
        `${baseUrl}/videos/channel${selectedChannel}/${fileName}`,
        `${baseUrl}/videos/channel-${selectedChannel}/${fileName}`,
        `${baseUrl}/videos/${fileName}`,
        `${baseUrl}/${selectedChannel}/${fileName}`,
        `${baseUrl}/ch${selectedChannel}/${fileName}`,
      ]

      let foundWorkingUrl = false
      for (const url of alternativeUrls) {
        const works = await checkVideoUrl(url)
        if (works) {
          // Update the program with the working URL
          const { error } = await supabase.from("programs").update({ mp4_url: url }).eq("id", programId)

          if (error) {
            console.error("Error updating program URL:", error)
            setProcessingStatus((prev) => ({ ...prev, [programId]: "error" }))
          } else {
            setProcessingStatus((prev) => ({ ...prev, [programId]: "fixed" }))
            foundWorkingUrl = true

            // Update the local state to reflect the change
            setPrograms((prevPrograms) =>
              prevPrograms.map((prog) => (prog.id === programId ? { ...prog, mp4_url: url } : prog)),
            )
          }
          break
        }
      }

      if (!foundWorkingUrl) {
        setProcessingStatus((prev) => ({ ...prev, [programId]: "error" }))
      }
    }
  }

  async function processAllVideos() {
    setMessage({ type: "info", text: "Processing all videos for this channel..." })

    for (const program of programs) {
      if (program.mp4_url) {
        await processVideo(program.id, program.mp4_url)
      }
    }

    setMessage({ type: "success", text: "Finished processing all videos" })
  }

  async function deleteProgram(programId: number) {
    try {
      setLoading(true)
      const { error } = await supabase.from("programs").delete().eq("id", programId)

      if (error) throw error

      // Update local state to remove the deleted program
      setPrograms((prevPrograms) => prevPrograms.filter((prog) => prog.id !== programId))
      setMessage({ type: "success", text: "Program deleted successfully" })
    } catch (error) {
      console.error("Error deleting program:", error)
      setMessage({ type: "error", text: "Failed to delete program" })
    } finally {
      setLoading(false)
    }
  }

  function formatDateTime(dateTimeStr: string) {
    const date = new Date(dateTimeStr)
    return date.toLocaleString()
  }

  function getStatusIcon(status: string | undefined) {
    switch (status) {
      case "checking":
        return <Loader2 className="h-5 w-5 text-blue-500 animate-spin" />
      case "success":
        return <CheckCircle className="h-5 w-5 text-green-500" />
      case "fixed":
        return <CheckCircle className="h-5 w-5 text-yellow-500" />
      case "error":
        return <AlertCircle className="h-5 w-5 text-red-500" />
      default:
        return <FileVideo className="h-5 w-5 text-gray-400" />
    }
  }

  function getStatusText(status: string | undefined) {
    switch (status) {
      case "checking":
        return "Checking..."
      case "success":
        return "Working"
      case "fixed":
        return "Fixed"
      case "error":
        return "Not Found"
      default:
        return "Not Checked"
    }
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center mb-6">
        <Link href="/admin">
          <Button variant="outline" size="sm" className="mr-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Return to Admin
          </Button>
        </Link>
      </div>
      <h1 className="text-3xl font-bold mb-6">Video Processor</h1>

      {message.type && (
        <div
          className={`mb-6 p-4 rounded-md ${
            message.type === "success"
              ? "bg-green-900/30 border border-green-800"
              : message.type === "error"
                ? "bg-red-900/30 border border-red-800"
                : "bg-blue-900/30 border border-blue-800"
          }`}
        >
          {message.text}
        </div>
      )}

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Select Channel</CardTitle>
          <CardDescription>Choose a channel to process its videos</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
            {channels.map((channel) => (
              <Button
                key={channel.id}
                variant={selectedChannel === channel.id ? "default" : "outline"}
                onClick={() => setSelectedChannel(channel.id)}
                className="h-auto py-2"
              >
                {channel.name || `Channel ${channel.id}`}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {selectedChannel !== null && (
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-4">
            <TabsTrigger value="videos">
              <FileVideo className="h-4 w-4 mr-2" />
              Videos
            </TabsTrigger>
            <TabsTrigger value="database">
              <Database className="h-4 w-4 mr-2" />
              Database
            </TabsTrigger>
          </TabsList>

          <TabsContent value="videos">
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <CardTitle>Videos for Channel {selectedChannel}</CardTitle>
                  <Button onClick={processAllVideos} disabled={loading || programs.length === 0}>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Process All Videos
                  </Button>
                </div>
                <CardDescription>
                  {programs.length} videos found. Click on a video to check its URL and fix if needed.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
                  </div>
                ) : programs.length === 0 ? (
                  <div className="text-center py-8 text-gray-400">No videos found for this channel</div>
                ) : (
                  <div className="space-y-4">
                    {programs.map((program) => (
                      <div
                        key={program.id}
                        className="border border-gray-800 rounded-md p-4 bg-gray-900/50 hover:bg-gray-900/80 transition-colors"
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <h3 className="font-medium">{program.title || "Untitled Program"}</h3>
                            <p className="text-sm text-gray-400">
                              {formatDateTime(program.start_time)} - {formatDateTime(program.end_time)}
                            </p>
                          </div>
                          <div className="flex items-center space-x-2">
                            <span
                              className={`flex items-center px-2 py-1 rounded text-xs ${
                                processingStatus[program.id] === "success" || processingStatus[program.id] === "fixed"
                                  ? "bg-green-900/30 text-green-400"
                                  : processingStatus[program.id] === "error"
                                    ? "bg-red-900/30 text-red-400"
                                    : "bg-gray-800 text-gray-400"
                              }`}
                            >
                              {getStatusIcon(processingStatus[program.id])}
                              <span className="ml-1">{getStatusText(processingStatus[program.id])}</span>
                            </span>
                          </div>
                        </div>

                        <div className="mt-2">
                          <p className="text-xs text-gray-500 break-all">{program.mp4_url}</p>
                        </div>

                        <div className="mt-3 flex space-x-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => processVideo(program.id, program.mp4_url)}
                            disabled={processingStatus[program.id] === "checking"}
                          >
                            {processingStatus[program.id] === "checking" ? (
                              <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                            ) : (
                              <RefreshCw className="h-3 w-3 mr-1" />
                            )}
                            Check URL
                          </Button>

                          {(processingStatus[program.id] === "success" || processingStatus[program.id] === "fixed") && (
                            <Button size="sm" variant="outline" className="bg-blue-900/30">
                              <Play className="h-3 w-3 mr-1" />
                              <a href={program.mp4_url} target="_blank" rel="noopener noreferrer">
                                Play Video
                              </a>
                            </Button>
                          )}

                          <Button
                            size="sm"
                            variant="outline"
                            className="bg-red-900/30 hover:bg-red-900/50"
                            onClick={() => deleteProgram(program.id)}
                          >
                            Delete
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="database">
            <Card>
              <CardHeader>
                <CardTitle>Database Information</CardTitle>
                <CardDescription>View and manage program data in the database</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="bg-gray-900 p-4 rounded-md">
                    <h3 className="font-medium mb-2">Program Count</h3>
                    <p>
                      This channel has <span className="font-bold text-blue-400">{programs.length}</span> programs in
                      the database.
                    </p>
                  </div>

                  <div className="bg-gray-900 p-4 rounded-md">
                    <h3 className="font-medium mb-2">Date Range</h3>
                    {programs.length > 0 ? (
                      <div>
                        <p>
                          <span className="text-gray-400">Earliest program:</span>{" "}
                          {formatDateTime(programs[0].start_time)}
                        </p>
                        <p>
                          <span className="text-gray-400">Latest program:</span>{" "}
                          {formatDateTime(programs[programs.length - 1].end_time)}
                        </p>
                      </div>
                    ) : (
                      <p className="text-gray-400">No programs available</p>
                    )}
                  </div>

                  <div className="bg-gray-900 p-4 rounded-md">
                    <h3 className="font-medium mb-2">Actions</h3>
                    <div className="space-y-2">
                      <Button
                        variant="outline"
                        className="w-full justify-start bg-red-900/20 hover:bg-red-900/40"
                        onClick={async () => {
                          if (confirm(`Are you sure you want to delete ALL programs for channel ${selectedChannel}?`)) {
                            try {
                              setLoading(true)
                              const { error } = await supabase
                                .from("programs")
                                .delete()
                                .eq("channel_id", selectedChannel)

                              if (error) throw error
                              setPrograms([])
                              setMessage({
                                type: "success",
                                text: `All programs for channel ${selectedChannel} have been deleted`,
                              })
                            } catch (error) {
                              console.error("Error deleting programs:", error)
                              setMessage({
                                type: "error",
                                text: `Failed to delete programs for channel ${selectedChannel}`,
                              })
                            } finally {
                              setLoading(false)
                            }
                          }
                        }}
                      >
                        Delete ALL Programs for This Channel
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
              <CardFooter className="border-t border-gray-800 pt-4">
                <p className="text-xs text-gray-400">
                  Note: Database operations cannot be undone. Please be careful when deleting data.
                </p>
              </CardFooter>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </div>
  )
}
