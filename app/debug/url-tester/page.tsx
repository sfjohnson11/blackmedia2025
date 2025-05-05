"use client"

import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"

export default function UrlTesterPage() {
  const [channelId, setChannelId] = useState("")
  const [programId, setProgramId] = useState("")
  const [channels, setChannels] = useState<any[]>([])
  const [programs, setPrograms] = useState<any[]>([])
  const [selectedProgram, setSelectedProgram] = useState<any>(null)
  const [testResults, setTestResults] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Load channels on mount
  useEffect(() => {
    async function loadChannels() {
      try {
        const { data, error } = await supabase.from("channels").select("*").order("id")
        if (error) throw error
        setChannels(data || [])
      } catch (err) {
        console.error("Error loading channels:", err)
        setError(`Error loading channels: ${err instanceof Error ? err.message : String(err)}`)
      }
    }

    loadChannels()
  }, [])

  // Load programs when channel changes
  useEffect(() => {
    if (!channelId) {
      setPrograms([])
      return
    }

    async function loadPrograms() {
      try {
        setIsLoading(true)
        const { data, error } = await supabase
          .from("programs")
          .select("*")
          .eq("channel_id", channelId)
          .order("start_time", { ascending: false })
          .limit(20)

        if (error) throw error
        setPrograms(data || [])
      } catch (err) {
        console.error("Error loading programs:", err)
        setError(`Error loading programs: ${err instanceof Error ? err.message : String(err)}`)
      } finally {
        setIsLoading(false)
      }
    }

    loadPrograms()
  }, [channelId])

  // Load specific program
  useEffect(() => {
    if (!programId) {
      setSelectedProgram(null)
      return
    }

    async function loadProgram() {
      try {
        setIsLoading(true)
        const { data, error } = await supabase.from("programs").select("*").eq("id", programId).single()

        if (error) throw error
        setSelectedProgram(data)
      } catch (err) {
        console.error("Error loading program:", err)
        setError(`Error loading program: ${err instanceof Error ? err.message : String(err)}`)
      } finally {
        setIsLoading(false)
      }
    }

    loadProgram()
  }, [programId])

  // Fix double slashes in URLs (but preserve http://)
  const fixUrl = (url: string): string => {
    if (!url) return ""

    // First preserve the protocol (http:// or https://)
    let protocol = ""
    const protocolMatch = url.match(/^(https?:\/\/)/)
    if (protocolMatch) {
      protocol = protocolMatch[0]
      url = url.substring(protocol.length)
    }

    // Replace any double slashes with single slashes
    url = url.replace(/\/+/g, "/")

    // Put the protocol back
    return protocol + url
  }

  // Generate test URLs
  const generateTestUrls = (url: string): string[] => {
    if (!url) return []

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ""

    // Extract filename from url
    const urlParts = url.split("/")
    const fileName = urlParts[urlParts.length - 1].split("?")[0] // Remove query parameters

    // Generate different URL patterns
    const urls = [
      // Original URL (fixed)
      fixUrl(url),

      // Try with channel ID in path (various formats)
      `${supabaseUrl}/storage/v1/object/public/channel${channelId}/${fileName}`,
      `${supabaseUrl}/storage/v1/object/public/ch${channelId}/${fileName}`,
      `${supabaseUrl}/storage/v1/object/public/videos/channel${channelId}/${fileName}`,
      `${supabaseUrl}/storage/v1/object/public/videos/ch${channelId}/${fileName}`,

      // Try with just the filename in various buckets
      `${supabaseUrl}/storage/v1/object/public/videos/${fileName}`,
      `${supabaseUrl}/storage/v1/object/public/${fileName}`,

      // Try with channel ID as a folder name
      `${supabaseUrl}/storage/v1/object/public/${channelId}/${fileName}`,
    ]

    // Filter out duplicates and empty URLs
    return [...new Set(urls.filter(Boolean))].map(fixUrl)
  }

  // Test a URL
  const testUrl = async (url: string) => {
    try {
      const response = await fetch(url, { method: "HEAD" })
      return {
        url,
        status: response.status,
        ok: response.ok,
        contentType: response.headers.get("content-type") || "unknown",
        contentLength: response.headers.get("content-length") || "unknown",
      }
    } catch (err) {
      return {
        url,
        status: "error",
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      }
    }
  }

  // Run tests
  const runTests = async () => {
    if (!selectedProgram || !selectedProgram.mp4_url) {
      setError("No program or URL selected")
      return
    }

    setIsLoading(true)
    setError(null)
    setTestResults([])

    try {
      const urls = generateTestUrls(selectedProgram.mp4_url)
      const results = []

      for (const url of urls) {
        const result = await testUrl(url)
        results.push(result)
      }

      setTestResults(results)
    } catch (err) {
      console.error("Error running tests:", err)
      setError(`Error running tests: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setIsLoading(false)
    }
  }

  // Open URL in new tab
  const openUrl = (url: string) => {
    window.open(url, "_blank")
  }

  return (
    <div className="container mx-auto p-4 max-w-4xl">
      <h1 className="text-2xl font-bold mb-4">URL Tester</h1>

      {error && <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">{error}</div>}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Channel</label>
          <select
            value={channelId}
            onChange={(e) => setChannelId(e.target.value)}
            className="w-full p-2 border rounded"
          >
            <option value="">Select a channel</option>
            {channels.map((channel) => (
              <option key={channel.id} value={channel.id}>
                {channel.id} - {channel.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Program</label>
          <select
            value={programId}
            onChange={(e) => setProgramId(e.target.value)}
            className="w-full p-2 border rounded"
            disabled={!channelId || isLoading}
          >
            <option value="">Select a program</option>
            {programs.map((program) => (
              <option key={program.id} value={program.id}>
                {program.title}
              </option>
            ))}
          </select>
        </div>
      </div>

      {selectedProgram && (
        <div className="bg-gray-100 p-4 rounded mb-6">
          <h2 className="font-bold mb-2">Selected Program</h2>
          <p>
            <strong>ID:</strong> {selectedProgram.id}
          </p>
          <p>
            <strong>Title:</strong> {selectedProgram.title}
          </p>
          <p>
            <strong>Channel ID:</strong> {selectedProgram.channel_id}
          </p>
          <p>
            <strong>Original URL:</strong> {selectedProgram.mp4_url}
          </p>
          <p>
            <strong>Fixed URL:</strong> {fixUrl(selectedProgram.mp4_url)}
          </p>
          <div className="mt-4">
            <button
              onClick={runTests}
              disabled={isLoading}
              className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded mr-2"
            >
              {isLoading ? "Testing..." : "Test URLs"}
            </button>
            <button
              onClick={() => openUrl(fixUrl(selectedProgram.mp4_url))}
              className="bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded"
            >
              Open URL
            </button>
          </div>
        </div>
      )}

      {testResults.length > 0 && (
        <div>
          <h2 className="text-xl font-bold mb-4">Test Results</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full bg-white border">
              <thead>
                <tr>
                  <th className="py-2 px-4 border">URL</th>
                  <th className="py-2 px-4 border">Status</th>
                  <th className="py-2 px-4 border">Content Type</th>
                  <th className="py-2 px-4 border">Actions</th>
                </tr>
              </thead>
              <tbody>
                {testResults.map((result, index) => (
                  <tr key={index} className={result.ok ? "bg-green-50" : "bg-red-50"}>
                    <td className="py-2 px-4 border break-all">
                      <div className="max-w-xs overflow-hidden text-ellipsis">{result.url}</div>
                    </td>
                    <td className="py-2 px-4 border">{result.status === "error" ? "Error" : result.status}</td>
                    <td className="py-2 px-4 border">{result.contentType || "N/A"}</td>
                    <td className="py-2 px-4 border">
                      <button
                        onClick={() => openUrl(result.url)}
                        className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-1 px-2 rounded text-xs"
                      >
                        Open
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
