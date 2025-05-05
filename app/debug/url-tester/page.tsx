"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { AlertCircle, CheckCircle } from "lucide-react"

export default function UrlTesterPage() {
  const [url, setUrl] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null)
  const [videoUrl, setVideoUrl] = useState("")

  const testUrl = async () => {
    if (!url) return

    setIsLoading(true)
    setResult(null)
    setVideoUrl("")

    try {
      const response = await fetch(url, { method: "HEAD" })

      if (response.ok) {
        setResult({
          success: true,
          message: `URL is accessible (Status: ${response.status})`,
        })
        setVideoUrl(url)
      } else {
        setResult({
          success: false,
          message: `URL returned error status: ${response.status}`,
        })
      }
    } catch (error) {
      setResult({
        success: false,
        message: `Error accessing URL: ${error instanceof Error ? error.message : String(error)}`,
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Video URL Tester</h1>
      <p className="mb-4 text-gray-400">Test if a video URL is accessible and playable</p>

      <div className="flex gap-2 mb-4">
        <Input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="Enter video URL to test"
          className="flex-1"
        />
        <Button onClick={testUrl} disabled={isLoading}>
          {isLoading ? "Testing..." : "Test URL"}
        </Button>
      </div>

      {result && (
        <div className={`p-3 rounded mb-4 ${result.success ? "bg-green-900/50" : "bg-red-900/50"}`}>
          <div className="flex items-center gap-2">
            {result.success ? (
              <CheckCircle className="text-green-500" size={20} />
            ) : (
              <AlertCircle className="text-red-500" size={20} />
            )}
            <span className={result.success ? "text-green-500" : "text-red-500"}>{result.message}</span>
          </div>
        </div>
      )}

      {videoUrl && (
        <div className="mt-6">
          <h2 className="text-xl font-semibold mb-2">Video Preview</h2>
          <div className="aspect-video bg-black rounded overflow-hidden">
            <video controls className="w-full h-full" src={videoUrl}>
              Your browser does not support the video tag.
            </video>
          </div>
        </div>
      )}

      <div className="mt-8">
        <h2 className="text-xl font-semibold mb-2">Common Test URLs</h2>
        <div className="space-y-2">
          <div className="p-3 bg-gray-800 rounded">
            <p className="font-mono text-sm break-all">https://example.com/video.mp4</p>
            <Button
              size="sm"
              variant="outline"
              className="mt-2"
              onClick={() => setUrl("https://example.com/video.mp4")}
            >
              Use This URL
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
