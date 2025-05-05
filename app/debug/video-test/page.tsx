"use client"

import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"

export default function VideoTestPage() {
  const [channels, setChannels] = useState<any[]>([])
  const [selectedChannel, setSelectedChannel] = useState<string>("")
  const [programs, setPrograms] = useState<any[]>([])
  const [selectedProgram, setSelectedProgram] = useState<string>("")
  const [videoUrl, setVideoUrl] = useState<string>("")
  const [testResults, setTestResults] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(false)

  // Fetch channels
  useEffect(() => {
    async function fetchChannels() {
      const { data, error } = await supabase.from("channels").select("*")
      if (error) {
        console.error("Error fetching channels:", error)
        return
      }
      setChannels(data || [])
    }
    fetchChannels()
  }, [])

  // Fetch programs for selected channel
  useEffect(() => {
    if (!selectedChannel) {
      setPrograms([])
      return
    }

    async function fetchPrograms() {
      const { data, error } = await supabase
        .from("programs")
        .select("*")
        .eq("channel_id", selectedChannel)
        .order("start_time", { ascending: false })
        .limit(20)

      if (error) {
        console.error("Error fetching programs:", error)
        return
      }
      setPrograms(data || [])
    }
    fetchPrograms()
  }, [selectedChannel])

  // Update video URL when program is selected
  useEffect(() => {
    if (!selectedProgram) {
      setVideoUrl("")
      return
    }

    const program = programs.find((p) => p.id.toString() === selectedProgram)
    if (program && program.mp4_url) {
      setVideoUrl(program.mp4_url)
    } else {
      setVideoUrl("")
    }
  }, [selectedProgram, programs])

  // Test video URL
  const testVideoUrl = async () => {
    if (!videoUrl) return

    setIsLoading(true)
    setTestResults(null)

    try {
      // Test with HEAD request
      const headResult = await fetch(videoUrl, { method: "HEAD" })
        .then((response) => ({
          ok: response.ok,
          status: response.status,
          statusText: response.statusText,
          headers: Object.fromEntries(response.headers.entries()),
        }))
        .catch((error) => ({ error: error.message }))

      setTestResults({
        url: videoUrl,
        headResult,
      })
    } catch (error) {
      setTestResults({
        url: videoUrl,
        error: error instanceof Error ? error.message : String(error),
      })
    } finally {
      setIsLoading(false)
    }
  }

  // Open URL directly
  const openUrlDirectly = () => {
    if (videoUrl) {
      window.open(videoUrl, "_blank")
    }
  }

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Video URL Tester</h1>

      <div className="mb-4">
        <label className="block text-sm font-medium mb-1">Select Channel</label>
        <select
          value={selectedChannel}
          onChange={(e) => setSelectedChannel(e.target.value)}
          className="w-full p-2 border rounded"
        >
          <option value="">Select a channel</option>
          {channels.map((channel) => (
            <option key={channel.id} value={channel.id}>
              {channel.name} (ID: {channel.id})
            </option>
          ))}
        </select>
      </div>

      <div className="mb-4">
        <label className="block text-sm font-medium mb-1">Select Program</label>
        <select
          value={selectedProgram}
          onChange={(e) => setSelectedProgram(e.target.value)}
          className="w-full p-2 border rounded"
          disabled={!selectedChannel}
        >
          <option value="">Select a program</option>
          {programs.map((program) => (
            <option key={program.id} value={program.id}>
              {program.title} (ID: {program.id})
            </option>
          ))}
        </select>
      </div>

      <div className="mb-4">
        <label className="block text-sm font-medium mb-1">Video URL</label>
        <input
          type="text"
          value={videoUrl}
          onChange={(e) => setVideoUrl(e.target.value)}
          className="w-full p-2 border rounded"
        />
      </div>

      <div className="flex space-x-2 mb-6">
        <button
          onClick={testVideoUrl}
          disabled={!videoUrl || isLoading}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
        >
          {isLoading ? "Testing..." : "Test URL"}
        </button>

        <button
          onClick={openUrlDirectly}
          disabled={!videoUrl}
          className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 disabled:opacity-50"
        >
          Open Directly
        </button>
      </div>

      {testResults && (
        <div className="mt-4 border rounded p-4">
          <h2 className="text-xl font-bold mb-2">Test Results</h2>

          <div className="mb-2">
            <strong>URL:</strong> {testResults.url}
          </div>

          {testResults.error ? (
            <div className="text-red-500">
              <strong>Error:</strong> {testResults.error}
            </div>
          ) : (
            <>
              <div className="mb-2">
                <strong>Status:</strong> {testResults.headResult.status} {testResults.headResult.statusText}
              </div>

              <div className="mb-2">
                <strong>Accessible:</strong> {testResults.headResult.ok ? "Yes" : "No"}
              </div>

              {testResults.headResult.headers && (
                <div>
                  <strong>Headers:</strong>
                  <pre className="bg-gray-100 p-2 rounded mt-1 text-xs overflow-auto">
                    {JSON.stringify(testResults.headResult.headers, null, 2)}
                  </pre>
                </div>
              )}
            </>
          )}

          <div className="mt-4">
            <button onClick={openUrlDirectly} className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700">
              Open URL in Browser
            </button>
          </div>
        </div>
      )}

      <div className="mt-8">
        <h2 className="text-xl font-bold mb-2">Video Preview</h2>
        {videoUrl ? (
          <video
            src={videoUrl}
            controls
            className="w-full max-h-96 bg-black"
            onError={() => console.error("Error loading video preview")}
          >
            Your browser does not support the video tag.
          </video>
        ) : (
          <div className="bg-gray-200 w-full h-48 flex items-center justify-center text-gray-500">
            Select a program to preview video
          </div>
        )}
      </div>
    </div>
  )
}
