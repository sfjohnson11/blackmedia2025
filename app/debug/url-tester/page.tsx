"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { constructChannelVideoUrl } from "@/lib/supabase"

export default function UrlTester() {
  const [channelId, setChannelId] = useState("1")
  const [fileName, setFileName] = useState("")
  const [testUrl, setTestUrl] = useState("")
  const [testResult, setTestResult] = useState<null | { success: boolean; status?: number; error?: string }>(null)
  const [isLoading, setIsLoading] = useState(false)

  // Generate channels 1-29
  const channels = Array.from({ length: 29 }, (_, i) => (i + 1).toString())

  const generateUrl = () => {
    if (!fileName) return
    const url = constructChannelVideoUrl(channelId, fileName)
    setTestUrl(url)
  }

  const testUrl1 = async () => {
    if (!testUrl) return

    setIsLoading(true)
    setTestResult(null)

    try {
      const response = await fetch(testUrl, { method: "HEAD" })
      setTestResult({
        success: response.ok,
        status: response.status,
      })
    } catch (error) {
      setTestResult({
        success: false,
        error: error.message,
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="container mx-auto py-8">
      <h1 className="text-2xl font-bold mb-6">URL Tester</h1>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Generate Channel Video URL</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="channel">Channel</Label>
                <Select value={channelId} onValueChange={setChannelId}>
                  <SelectTrigger id="channel">
                    <SelectValue placeholder="Select channel" />
                  </SelectTrigger>
                  <SelectContent>
                    {channels.map((ch) => (
                      <SelectItem key={ch} value={ch}>
                        Channel {ch}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="fileName">File Name</Label>
                <Input
                  id="fileName"
                  value={fileName}
                  onChange={(e) => setFileName(e.target.value)}
                  placeholder="e.g., myvideo.mp4"
                />
              </div>
            </div>

            <Button onClick={generateUrl} disabled={!fileName}>
              Generate URL
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Test URL</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4">
            <div>
              <Label htmlFor="testUrl">URL to Test</Label>
              <Input
                id="testUrl"
                value={testUrl}
                onChange={(e) => setTestUrl(e.target.value)}
                placeholder="Enter URL to test"
              />
            </div>

            <Button onClick={testUrl1} disabled={!testUrl || isLoading}>
              {isLoading ? "Testing..." : "Test URL"}
            </Button>

            {testResult && (
              <div
                className={`p-4 rounded-md ${testResult.success ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}
              >
                <p className="font-medium">{testResult.success ? "✅ URL works!" : "❌ URL does not work"}</p>
                {testResult.status && <p className="text-sm mt-1">Status code: {testResult.status}</p>}
                {testResult.error && <p className="text-sm mt-1">Error: {testResult.error}</p>}
              </div>
            )}

            {testUrl && (
              <div className="mt-2">
                <Button variant="outline" onClick={() => window.open(testUrl, "_blank")} className="mr-2">
                  Open in New Tab
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    const videoElement = document.createElement("video")
                    videoElement.src = testUrl
                    videoElement.controls = true
                    videoElement.style.width = "100%"
                    videoElement.style.maxHeight = "400px"

                    const container = document.getElementById("video-container")
                    if (container) {
                      container.innerHTML = ""
                      container.appendChild(videoElement)
                    }
                  }}
                >
                  Test Video Playback
                </Button>
              </div>
            )}

            <div id="video-container" className="mt-4"></div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
