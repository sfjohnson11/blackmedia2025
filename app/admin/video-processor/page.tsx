"use client"

import type React from "react"

import { useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import { supabase } from "@/lib/supabase"
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Loader2, Upload, Check, AlertTriangle, FileVideo, ArrowLeft } from "lucide-react"
import Link from "next/link"

export default function VideoProcessorPage() {
  const [channelId, setChannelId] = useState("")
  const [videoTitle, setVideoTitle] = useState("")
  const [file, setFile] = useState<File | null>(null)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [isUploading, setIsUploading] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [uploadResult, setUploadResult] = useState<any>(null)
  const [processingResult, setProcessingResult] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0]
      // Check if file is too large (over 2GB)
      if (selectedFile.size > 2 * 1024 * 1024 * 1024) {
        setError("File is too large. Maximum size is 2GB.")
        return
      }

      setFile(selectedFile)
      setError(null)

      // Extract title from filename if empty
      if (!videoTitle) {
        const fileName = selectedFile.name.replace(/\.[^/.]+$/, "") // Remove extension
        setVideoTitle(fileName)
      }
    }
  }

  const uploadVideo = async () => {
    if (!file || !channelId || !videoTitle) {
      setError("Please select a channel, enter a title, and choose a file.")
      return
    }

    setIsUploading(true)
    setUploadProgress(0)
    setError(null)

    try {
      // Generate a unique filename to avoid conflicts
      const fileExt = file.name.split(".").pop()
      const fileName = `${Date.now()}_${videoTitle.replace(/\s+/g, "_")}.${fileExt}`

      // Upload to Supabase with progress tracking
      const { data, error } = await supabase.storage.from(`channel${channelId}`).upload(fileName, file, {
        cacheControl: "3600",
        upsert: false,
        onUploadProgress: (progress) => {
          setUploadProgress((progress.loaded / progress.total) * 100)
        },
      })

      if (error) throw error

      setUploadResult({
        success: true,
        fileName,
        path: data.path,
      })

      // Create a program entry in the database
      const { data: programData, error: programError } = await supabase
        .from("programs")
        .insert({
          channel_id: channelId,
          title: videoTitle,
          mp4_url: fileName,
          start_time: new Date().toISOString(),
          duration: 3600, // Default duration, will be updated after processing
        })
        .select()

      if (programError) throw programError

      // Start processing the video
      await processVideo(channelId, programData[0].id, fileName)
    } catch (err) {
      console.error("Error uploading file:", err)
      setError(err instanceof Error ? err.message : "An unknown error occurred during upload")
    } finally {
      setIsUploading(false)
    }
  }

  const processVideo = async (channelId: string, videoId: number, fileName: string) => {
    setIsProcessing(true)

    try {
      const response = await fetch("/api/convert-video", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ channelId, videoId, fileName }),
      })

      const result = await response.json()

      if (!result.success) {
        throw new Error(result.message || "Video processing failed")
      }

      setProcessingResult(result)
    } catch (err) {
      console.error("Error processing video:", err)
      setError(err instanceof Error ? err.message : "An unknown error occurred during processing")
    } finally {
      setIsProcessing(false)
    }
  }

  const reset = () => {
    setFile(null)
    setVideoTitle("")
    setUploadProgress(0)
    setIsUploading(false)
    setIsProcessing(false)
    setUploadResult(null)
    setProcessingResult(null)
    setError(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  return (
    <div className="pt-24 px-4 md:px-10 pb-16">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center mb-8">
          <Link href="/admin" className="mr-4">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Admin
            </Button>
          </Link>
          <h1 className="text-3xl font-bold">Video Processor</h1>
        </div>

        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Upload and Process Video</CardTitle>
            <CardDescription>
              Upload large MP4 files and automatically convert them to HLS format for streaming
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!uploadResult ? (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Channel ID</label>
                  <input
                    type="text"
                    value={channelId}
                    onChange={(e) => setChannelId(e.target.value)}
                    placeholder="Enter channel ID (e.g. 1)"
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md"
                    disabled={isUploading || isProcessing}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Video Title</label>
                  <input
                    type="text"
                    value={videoTitle}
                    onChange={(e) => setVideoTitle(e.target.value)}
                    placeholder="Enter video title"
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md"
                    disabled={isUploading || isProcessing}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Video File (MP4)</label>
                  <div className="flex items-center gap-4">
                    <Button
                      onClick={() => fileInputRef.current?.click()}
                      variant="outline"
                      disabled={isUploading || isProcessing}
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      Select File
                    </Button>
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleFileChange}
                      accept="video/mp4,video/*"
                      className="hidden"
                      disabled={isUploading || isProcessing}
                    />
                    {file && (
                      <div className="text-sm text-gray-300 flex items-center">
                        <FileVideo className="h-4 w-4 mr-2 text-blue-400" />
                        {file.name} ({(file.size / (1024 * 1024)).toFixed(2)} MB)
                      </div>
                    )}
                  </div>
                </div>

                {error && (
                  <div className="bg-red-900/30 text-red-400 p-3 rounded-md flex items-start">
                    <AlertTriangle className="h-5 w-5 mr-2 mt-0.5 flex-shrink-0" />
                    <p>{error}</p>
                  </div>
                )}

                {isUploading && (
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Uploading...</span>
                      <span>{Math.round(uploadProgress)}%</span>
                    </div>
                    <Progress value={uploadProgress} className="w-full" />
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                <div className="p-4 bg-green-900/30 rounded-md flex items-start">
                  <Check className="h-5 w-5 text-green-500 mr-3 flex-shrink-0" />
                  <div>
                    <p className="font-medium text-green-400">Upload Successful!</p>
                    <p className="text-sm text-gray-300 mt-1">
                      The video has been uploaded to channel {channelId} and is now being processed.
                    </p>
                  </div>
                </div>

                {isProcessing && (
                  <div className="p-4 bg-blue-900/30 rounded-md flex items-center">
                    <Loader2 className="h-5 w-5 text-blue-400 mr-3 animate-spin" />
                    <p>Processing video to HLS format. This may take several minutes depending on the file size.</p>
                  </div>
                )}

                {processingResult && (
                  <div className="p-4 bg-green-900/30 rounded-md">
                    <div className="flex items-start mb-4">
                      <Check className="h-5 w-5 text-green-500 mr-3 flex-shrink-0" />
                      <div>
                        <p className="font-medium text-green-400">Processing Complete!</p>
                        <p className="text-sm text-gray-300 mt-1">
                          The video has been processed to HLS format for streaming.
                        </p>
                      </div>
                    </div>

                    <div className="bg-black/40 p-4 rounded-md">
                      <h3 className="text-sm font-medium mb-2">HLS Playlist URL:</h3>
                      <p className="text-xs text-gray-300 break-all">{processingResult.playlistUrl}</p>

                      {processingResult.thumbnailUrl && (
                        <div className="mt-4">
                          <h3 className="text-sm font-medium mb-2">Thumbnail:</h3>
                          <div className="aspect-video bg-gray-900 rounded-md overflow-hidden">
                            <img
                              src={processingResult.thumbnailUrl || "/placeholder.svg"}
                              alt="Video thumbnail"
                              className="w-full h-full object-contain"
                            />
                          </div>
                        </div>
                      )}

                      {processingResult.duration && (
                        <p className="mt-4 text-sm">
                          <span className="font-medium">Duration:</span> {Math.floor(processingResult.duration / 60)}:
                          {(processingResult.duration % 60).toString().padStart(2, "0")}
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {error && (
                  <div className="bg-red-900/30 text-red-400 p-3 rounded-md flex items-start">
                    <AlertTriangle className="h-5 w-5 mr-2 mt-0.5 flex-shrink-0" />
                    <p>{error}</p>
                  </div>
                )}
              </div>
            )}
          </CardContent>
          <CardFooter className="flex justify-end gap-3">
            {!uploadResult ? (
              <Button
                onClick={uploadVideo}
                disabled={!file || !channelId || isUploading || isProcessing}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {isUploading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4 mr-2" />
                    Upload and Process
                  </>
                )}
              </Button>
            ) : (
              <Button onClick={reset} disabled={isProcessing}>
                Process Another Video
              </Button>
            )}
          </CardFooter>
        </Card>

        <div className="bg-gray-800 p-6 rounded-lg">
          <h2 className="text-xl font-bold mb-4">About Video Processing</h2>
          <div className="space-y-4 text-gray-300">
            <p>
              This tool processes large MP4 videos and converts them to HLS (HTTP Live Streaming) format, which splits
              the video into small segments for efficient streaming.
            </p>

            <div className="space-y-2">
              <h3 className="font-medium text-white">Benefits:</h3>
              <ul className="list-disc pl-5 space-y-1">
                <li>Videos are broken into small segments (under 100MB each)</li>
                <li>More efficient streaming, especially on mobile devices</li>
                <li>Automatic thumbnail generation</li>
                <li>Precise duration detection</li>
                <li>Support for videos larger than 2GB</li>
              </ul>
            </div>

            <div className="bg-yellow-900/30 p-4 rounded-md">
              <h3 className="font-medium text-yellow-400 mb-2">Important Notes:</h3>
              <ul className="list-disc pl-5 space-y-1 text-gray-300">
                <li>Processing may take several minutes depending on the file size</li>
                <li>The original MP4 file is preserved in the original bucket</li>
                <li>The HLS files are stored in a separate "{`channel{id}-hls`}" bucket</li>
                <li>The video player component will automatically use HLS if available</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
