"use client"

import type React from "react"

import { useState } from "react"
import { Loader2 } from "lucide-react"

export default function VideoUrlChecker() {
  const [url, setUrl] = useState("")
  const [result, setResult] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [videoLoaded, setVideoLoaded] = useState(false)
  const [videoError, setVideoError] = useState<string | null>(null)

  const checkUrl = async () => {
    if (!url) return

    setLoading(true)
    setResult(null)
    setVideoLoaded(false)
    setVideoError(null)

    try {
      const response = await fetch(`/api/check-video-url?url=${encodeURIComponent(url)}`)
      const data = await response.json()
      setResult(data)
    } catch (error) {
      setResult({
        error: "Failed to check URL",
        message: error instanceof Error ? error.message : String(error),
      })
    } finally {
      setLoading(false)
    }
  }

  const handleVideoLoad = () => {
    setVideoLoaded(true)
  }

  const handleVideoError = (e: React.SyntheticEvent<HTMLVideoElement>) => {
    setVideoLoaded(false)
    const videoElement = e.currentTarget
    const videoError = videoElement.error

    if (videoError) {
      setVideoError(`Error code: ${videoError.code}, Message: ${videoError.message}`)
    } else {
      setVideoError("Video error event but no error object available")
    }
  }

  return (
    <div className="container mx-auto p-4 max-w-4xl">
      <h1 className="text-2xl font-bold mb-4">Video URL Checker</h1>
      <p className="mb-4 text-gray-600">
        This tool helps diagnose issues with video URLs by checking if they are accessible and providing detailed
        information.
      </p>

      <div className="flex gap-2 mb-6">
        <input
          type="text"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="Enter video URL to check"
          className="flex-1 p-2 border rounded"
        />
        <button
          onClick={checkUrl}
          disabled={loading || !url}
          className="bg-blue-600 text-white px-4 py-2 rounded disabled:bg-gray-400"
        >
          {loading ? (
            <>
              <Loader2 className="inline-block w-4 h-4 mr-2 animate-spin" />
              Checking...
            </>
          ) : (
            "Check URL"
          )}
        </button>
      </div>

      {result && (
        <div className="mb-6">
          <h2 className="text-xl font-semibold mb-2">URL Check Results</h2>
          <div className="bg-gray-100 p-4 rounded overflow-auto">
            <pre className="text-sm">{JSON.stringify(result, null, 2)}</pre>
          </div>
        </div>
      )}

      {url && (
        <div className="mb-6">
          <h2 className="text-xl font-semibold mb-2">Video Test</h2>
          <div className="bg-black aspect-video relative">
            {!videoLoaded && !videoError && (
              <div className="absolute inset-0 flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-white animate-spin" />
              </div>
            )}

            {videoError && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/80">
                <div className="text-center p-4">
                  <p className="text-red-500 mb-2">Video Error</p>
                  <p className="text-white text-sm">{videoError}</p>
                </div>
              </div>
            )}

            <video
              src={url}
              controls
              className="w-full h-full"
              onCanPlay={handleVideoLoad}
              onError={handleVideoError}
              crossOrigin="anonymous"
            />
          </div>
        </div>
      )}

      <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-6">
        <h3 className="font-semibold text-yellow-800">Common Video Issues</h3>
        <ul className="list-disc pl-5 mt-2 text-sm text-yellow-700">
          <li>CORS issues: The video server must allow cross-origin requests</li>
          <li>Invalid URL format: Make sure the URL is properly formatted</li>
          <li>Unsupported video format: Browser may not support the video codec</li>
          <li>Network issues: The video server might be down or unreachable</li>
          <li>Authentication required: Some videos require authentication</li>
        </ul>
      </div>
    </div>
  )
}
