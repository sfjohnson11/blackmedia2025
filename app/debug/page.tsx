"use client"

import { useState, useEffect } from "react"
import { listBuckets, listFiles } from "@/lib/supabase"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Play } from "lucide-react"

export default function DebugPage() {
  const [buckets, setBuckets] = useState<any[]>([])
  const [selectedBucket, setSelectedBucket] = useState<string>("")
  const [files, setFiles] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [testUrl, setTestUrl] = useState<string>("")
  const [testResult, setTestResult] = useState<string>("")
  const [channelId, setChannelId] = useState<string>("")
  const [mp4Filename, setMp4Filename] = useState<string>("")
  const [urlTestResults, setUrlTestResults] = useState<Array<{ url: string; works: boolean }>>([])
  const [isTestingUrls, setIsTestingUrls] = useState(false)

  useEffect(() => {
    async function fetchBuckets() {
      try {
        setLoading(true)
        const bucketsData = await listBuckets()
        setBuckets(bucketsData || [])
        setError(null)
      } catch (err) {
        console.error("Error fetching buckets:", err)
        setError("Failed to fetch buckets")
      } finally {
        setLoading(false)
      }
    }

    fetchBuckets()
  }, [])

  async function handleBucketSelect(bucketName: string) {
    try {
      setSelectedBucket(bucketName)
      setLoading(true)
      const filesData = await listFiles(bucketName)
      setFiles(filesData || [])
      setError(null)
    } catch (err) {
      console.error(`Error fetching files for bucket ${bucketName}:`, err)
      setError(`Failed to fetch files for bucket ${bucketName}`)
      setFiles([])
    } finally {
      setLoading(false)
    }
  }

  async function testVideoUrl() {
    try {
      setTestResult("Testing URL...")
      const response = await fetch(testUrl, { method: "HEAD" })
      if (response.ok) {
        setTestResult(`Success! Status: ${response.status}`)
      } else {
        setTestResult(`Failed! Status: ${response.status} ${response.statusText}`)
      }
    } catch (err) {
      console.error("Error testing URL:", err)
      setTestResult(`Error: ${err instanceof Error ? err.message : "Unknown error"}`)
    }
  }

  async function testAllUrlFormats() {
    if (!channelId || !mp4Filename) return

    setIsTestingUrls(true)
    setUrlTestResults([])

    const fileName = mp4Filename
    const baseUrl = "https://msllqpnxwbugvkpnquwx.supabase.co/storage/v1/object/public"

    const urlFormats = [
      // Format 1: Direct filename if it's a full URL
      mp4Filename.startsWith("http") ? mp4Filename : null,

      // Format 2: channel{id}/{filename}
      `${baseUrl}/channel${channelId}/${fileName}`,

      // Format 3: videos/channel{id}/{filename}
      `${baseUrl}/videos/channel${channelId}/${fileName}`,

      // Format 4: Try with lowercase "channel" prefix
      `${baseUrl}/videos/channel-${channelId}/${fileName}`,

      // Format 5: Try without channel prefix in path
      `${baseUrl}/videos/${fileName}`,

      // Format 6: Try with the channel ID as the bucket name
      `${baseUrl}/${channelId}/${fileName}`,

      // Format 7: Try with "ch" prefix
      `${baseUrl}/ch${channelId}/${fileName}`,
    ].filter(Boolean) as string[]

    const results = []

    for (const url of urlFormats) {
      try {
        const response = await fetch(url, { method: "HEAD" })
        results.push({
          url,
          works: response.ok,
        })
      } catch (error) {
        results.push({
          url,
          works: false,
        })
      }

      // Update results as they come in
      setUrlTestResults([...results])
    }

    setIsTestingUrls(false)
  }

  return (
    <div className="container mx-auto px-4 py-8 pt-20">
      <h1 className="text-3xl font-bold mb-6">Storage Debug Page</h1>

      <div className="bg-gray-800 p-6 rounded-lg mb-8">
        <h2 className="text-xl font-semibold mb-4">Test Video URL</h2>
        <div className="flex flex-col md:flex-row gap-4 mb-4">
          <input
            type="text"
            value={testUrl}
            onChange={(e) => setTestUrl(e.target.value)}
            placeholder="Enter video URL to test"
            className="flex-1 px-4 py-2 bg-gray-700 rounded-md text-white"
          />
          <button onClick={testVideoUrl} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-md">
            Test URL
          </button>
        </div>
        {testResult && (
          <div className={`p-4 rounded-md ${testResult.includes("Success") ? "bg-green-900/30" : "bg-red-900/30"}`}>
            {testResult}
          </div>
        )}
      </div>

      <div className="mt-8 bg-blue-900/30 p-6 rounded-lg">
        <div className="flex items-start">
          <div className="mr-4">
            <Play className="h-6 w-6 text-blue-400" />
          </div>
          <div>
            <h2 className="text-xl font-semibold mb-2">New Video URL Tester Tool</h2>
            <p className="mb-4">
              We've created a dedicated tool for testing Supabase video URLs with better playback testing and
              troubleshooting features.
            </p>
            <Link href="/debug/video-test">
              <Button className="bg-blue-600 hover:bg-blue-700">Go to Video URL Tester</Button>
            </Link>
          </div>
        </div>
      </div>

      <div className="bg-gray-800 p-6 rounded-lg mb-8">
        <h2 className="text-xl font-semibold mb-4">Video URL Format Tester</h2>
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-300 mb-1">Channel ID</label>
          <input
            type="text"
            value={channelId || ""}
            onChange={(e) => setChannelId(e.target.value)}
            placeholder="Enter channel ID (e.g., 1)"
            className="w-full px-4 py-2 bg-gray-700 rounded-md text-white mb-2"
          />

          <label className="block text-sm font-medium text-gray-300 mb-1">MP4 Filename</label>
          <input
            type="text"
            value={mp4Filename || ""}
            onChange={(e) => setMp4Filename(e.target.value)}
            placeholder="Enter MP4 filename"
            className="w-full px-4 py-2 bg-gray-700 rounded-md text-white"
          />
        </div>

        <button
          onClick={testAllUrlFormats}
          disabled={!channelId || !mp4Filename || isTestingUrls}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-md mb-4"
        >
          {isTestingUrls ? "Testing URLs..." : "Test All URL Formats"}
        </button>

        {urlTestResults.length > 0 && (
          <div className="mt-4">
            <h3 className="font-semibold mb-2">Results:</h3>
            <div className="bg-gray-900 p-3 rounded-md max-h-60 overflow-y-auto">
              {urlTestResults.map((result, index) => (
                <div key={index} className={`p-2 mb-2 rounded ${result.works ? "bg-green-900/30" : "bg-red-900/30"}`}>
                  <div className="flex items-start">
                    <span
                      className={`inline-block w-5 h-5 rounded-full mr-2 flex-shrink-0 ${result.works ? "bg-green-500" : "bg-red-500"}`}
                    ></span>
                    <div>
                      <p className="break-all text-xs">{result.url}</p>
                      <p className={`text-xs mt-1 ${result.works ? "text-green-400" : "text-red-400"}`}>
                        {result.works ? "✓ Working" : "✗ Not Found"}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="bg-gray-800 p-6 rounded-lg">
          <h2 className="text-xl font-semibold mb-4">Storage Buckets</h2>
          {loading && buckets.length === 0 ? (
            <p>Loading buckets...</p>
          ) : error ? (
            <p className="text-red-400">{error}</p>
          ) : (
            <ul className="space-y-2">
              {buckets.map((bucket) => (
                <li key={bucket.id}>
                  <button
                    onClick={() => handleBucketSelect(bucket.name)}
                    className={`px-3 py-1 rounded-md ${
                      selectedBucket === bucket.name ? "bg-blue-600" : "bg-gray-700 hover:bg-gray-600"
                    }`}
                  >
                    {bucket.name}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="bg-gray-800 p-6 rounded-lg">
          <h2 className="text-xl font-semibold mb-4">
            {selectedBucket ? `Files in "${selectedBucket}"` : "Select a bucket"}
          </h2>
          {selectedBucket && loading ? (
            <p>Loading files...</p>
          ) : error && selectedBucket ? (
            <p className="text-red-400">{error}</p>
          ) : selectedBucket ? (
            files.length > 0 ? (
              <ul className="space-y-2">
                {files.map((file, index) => (
                  <li key={index} className="break-all">
                    <div className="flex items-start">
                      <span className="bg-gray-700 px-2 py-1 rounded text-sm mr-2">
                        {file.metadata?.mimetype || "unknown"}
                      </span>
                      <span>{file.name}</span>
                    </div>
                    {file.metadata?.mimetype?.startsWith("video/") && (
                      <button
                        onClick={() =>
                          setTestUrl(
                            `https://msllqpnxwbugvkpnquwx.supabase.co/storage/v1/object/public/${selectedBucket}/${file.name}`,
                          )
                        }
                        className="text-blue-400 text-sm mt-1 hover:underline"
                      >
                        Copy URL for testing
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p>No files found in this bucket</p>
            )
          ) : (
            <p>Select a bucket to view files</p>
          )}
        </div>
      </div>

      <div className="mt-8 bg-gray-800 p-6 rounded-lg">
        <h2 className="text-xl font-semibold mb-4">Troubleshooting Steps</h2>
        <ol className="list-decimal pl-5 space-y-3">
          <li>
            Make sure your buckets are named correctly. If they're named "channel1", "channel2", etc., update the code
            to use that format.
          </li>
          <li>Check that your bucket permissions are set to public for the videos you want to access.</li>
          <li>Verify that the file paths in your programs table match the actual file names in your buckets.</li>
          <li>Test direct URLs to your videos to see if they're accessible (use the tool above).</li>
          <li>Check for CORS issues by looking at the browser console when trying to play videos.</li>
        </ol>
      </div>

      <div className="mt-6">
        <Link href="/" className="text-blue-400 hover:underline">
          Return to Home
        </Link>
      </div>
    </div>
  )
}
