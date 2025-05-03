"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { ArrowLeft, RefreshCw, Play, AlertTriangle } from "lucide-react"
import { testAllVideoFormats } from "@/lib/supabase"

export default function VideoTestPage() {
  const [channelId, setChannelId] = useState("")
  const [fileName, setFileName] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [results, setResults] = useState<Array<{ url: string; works: boolean }>>([])
  const [selectedUrl, setSelectedUrl] = useState<string>("")
  const [videoError, setVideoError] = useState<string>("")

  const handleTest = async () => {
    if (!channelId || !fileName) return

    setIsLoading(true)
    try {
      const testResults = await testAllVideoFormats(channelId, fileName)
      setResults(testResults)

      // If we found a working URL, select it
      const workingUrl = testResults.find((r) => r.works)
      if (workingUrl) {
        setSelectedUrl(workingUrl.url)
      } else {
        setSelectedUrl("")
      }
    } catch (error) {
      console.error("Error testing video formats:", error)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="pt-24 px-4 md:px-10 flex flex-col items-center justify-center min-h-[80vh]">
      <div className="bg-gray-800 p-6 rounded-lg max-w-4xl w-full">
        <div className="flex items-center mb-6">
          <Link href="/debug" className="mr-4">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Debug
            </Button>
          </Link>
          <h1 className="text-2xl font-bold">Supabase Video URL Tester</h1>
        </div>

        <div className="mb-6">
          <p className="mb-4">
            This tool tests different Supabase URL formats to find which one works for your videos.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div>
              <label htmlFor="channelId" className="block text-sm font-medium mb-1">
                Channel ID:
              </label>
              <input
                id="channelId"
                type="text"
                value={channelId}
                onChange={(e) => setChannelId(e.target.value)}
                placeholder="Enter channel ID (e.g. 1)"
                className="w-full p-2 bg-gray-900 border border-gray-700 rounded-md"
              />
            </div>
            <div>
              <label htmlFor="fileName" className="block text-sm font-medium mb-1">
                MP4 Filename:
              </label>
              <input
                id="fileName"
                type="text"
                value={fileName}
                onChange={(e) => setFileName(e.target.value)}
                placeholder="Enter filename (e.g. video.mp4)"
                className="w-full p-2 bg-gray-900 border border-gray-700 rounded-md"
              />
            </div>
          </div>

          <Button
            onClick={handleTest}
            disabled={isLoading || !channelId || !fileName}
            className="bg-blue-600 hover:bg-blue-700 w-full"
          >
            {isLoading ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Testing URL Formats...
              </>
            ) : (
              "Test Supabase URL Formats"
            )}
          </Button>
        </div>

        {results.length > 0 && (
          <div className="mt-6">
            <h2 className="text-xl font-semibold mb-4">Test Results</h2>
            <div className="bg-gray-900 p-4 rounded-lg mb-6">
              <div className="grid gap-2">
                {results.map((result, index) => (
                  <div
                    key={index}
                    className={`p-3 rounded-md ${result.works ? "bg-green-900/30" : "bg-red-900/30"} flex justify-between items-start`}
                  >
                    <div className="flex-1">
                      <div className="flex items-center">
                        <div
                          className={`w-3 h-3 rounded-full mr-2 ${result.works ? "bg-green-500" : "bg-red-500"}`}
                        ></div>
                        <span className="text-sm font-medium">Format {index + 1}</span>
                      </div>
                      <p className="text-xs break-all mt-1">{result.url}</p>
                    </div>
                    {result.works && (
                      <Button
                        size="sm"
                        onClick={() => setSelectedUrl(result.url)}
                        className="ml-2 bg-green-600 hover:bg-green-700"
                      >
                        <Play className="h-3 w-3 mr-1" /> Play
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {selectedUrl && (
              <div className="mt-6">
                <h2 className="text-xl font-semibold mb-4">Video Preview</h2>
                <div className="aspect-video bg-black rounded-md overflow-hidden relative">
                  <video
                    src={selectedUrl}
                    controls
                    className="w-full h-full"
                    onError={(e) => setVideoError("Error playing this video. It may not be accessible in the browser.")}
                    onPlay={() => setVideoError("")}
                  />
                  {videoError && (
                    <div className="absolute inset-0 bg-black/80 flex items-center justify-center">
                      <div className="text-center p-4">
                        <AlertTriangle className="h-10 w-10 text-yellow-500 mx-auto mb-2" />
                        <p>{videoError}</p>
                      </div>
                    </div>
                  )}
                </div>
                <p className="text-xs text-gray-400 mt-2 break-all">URL: {selectedUrl}</p>
              </div>
            )}

            <div className="mt-6 border-t border-gray-700 pt-6">
              <h3 className="font-semibold mb-2">Troubleshooting Tips</h3>
              <ul className="text-sm text-gray-300 space-y-1 list-disc pl-5">
                <li>Make sure the file exists in your Supabase storage</li>
                <li>Check that the bucket and file permissions are set to public</li>
                <li>Verify the channel ID matches the storage bucket structure</li>
                <li>Try using the exact filename from your database's mp4_url field</li>
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
