"use client"

import type React from "react"

import { useState, useEffect, useRef } from "react"
import { getCurrentProgram, getUpcomingPrograms, calculateProgramProgress, listFiles } from "@/lib/supabase"
import type { Channel, Program } from "@/types"
import { Clock, Calendar, AlertCircle, RefreshCw } from "lucide-react"

interface VideoPlayerProps {
  channel: Channel
  initialProgram: Program | null
  upcomingPrograms: Program[]
}

export function VideoPlayer({ channel, initialProgram, upcomingPrograms: initialUpcoming }: VideoPlayerProps) {
  const [currentProgram, setCurrentProgram] = useState<Program | null>(initialProgram)
  const [upcomingPrograms, setUpcomingPrograms] = useState<Program[]>(initialUpcoming)
  const [progress, setProgress] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [videoError, setVideoError] = useState(false)
  const [errorDetails, setErrorDetails] = useState<string | null>(null)
  const [isRetrying, setIsRetrying] = useState(false)
  const [bucketFiles, setBucketFiles] = useState<string[]>([])
  const videoRef = useRef<HTMLVideoElement>(null)
  const standbyVideoRef = useRef<HTMLVideoElement>(null)
  const refreshTimerRef = useRef<NodeJS.Timeout | null>(null)

  // Function to get the standby video URL
  const getStandbyVideoUrl = () => {
    return "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/standby_blacktruthtv-D7yZUERL2zhjE71Llxul69gbPLxGES.mp4"
  }

  // Function to format the video URL with the bucket path
  const getVideoUrl = (mp4Url: string) => {
    // Default URL format
    return `https://msllqpnxwbugvkpnquwx.supabase.co/storage/v1/object/public/channel${channel.id}/${mp4Url}`
  }

  // Function to refresh the current program
  const refreshCurrentProgram = async () => {
    try {
      setIsLoading(true)
      const { program, isNext, error } = await getCurrentProgram(channel.id)

      if (error) {
        throw error
      }

      if (program) {
        setCurrentProgram(program)
        setVideoError(false)
        setErrorDetails(null)

        // Calculate progress if it's a current program
        if (!isNext) {
          const { progressPercent } = calculateProgramProgress(program)
          setProgress(progressPercent)
        } else {
          setProgress(0)
        }
      } else {
        setCurrentProgram(null)
        setProgress(0)
      }

      // Also refresh upcoming programs
      const { programs } = await getUpcomingPrograms(channel.id)
      setUpcomingPrograms(programs)

      setError(null)
    } catch (err) {
      console.error("Error refreshing program:", err)
      setError("Failed to load program")
    } finally {
      setIsLoading(false)
    }
  }

  // Function to list files in the channel bucket
  const fetchBucketFiles = async () => {
    try {
      // Try different bucket names
      const bucketNames = [`channel${channel.id}`, `videos`, `video`, `media`, `content`, `assets`]

      for (const bucket of bucketNames) {
        console.log(`Checking bucket: ${bucket}`)
        const files = await listFiles(bucket)
        if (files && files.length > 0) {
          console.log(`Found files in bucket ${bucket}:`, files)
          setBucketFiles(files.map((f) => f.name))
          return { bucket, files }
        }
      }

      console.log("No files found in any of the checked buckets")
      return { bucket: null, files: [] }
    } catch (err) {
      console.error("Error fetching bucket files:", err)
      return { bucket: null, files: [] }
    }
  }

  // Handle standby video error
  const handleStandbyError = (e: React.SyntheticEvent<HTMLVideoElement, Event>) => {
    console.error("Error loading standby video:", e)
    // Try to extract more error details
    const target = e.target as HTMLVideoElement
    const errorMessage = `Error code: ${target.error?.code}, message: ${target.error?.message}`
    console.error(errorMessage)
  }

  // Handle video error with improved error reporting
  const handleVideoError = (e: React.SyntheticEvent<HTMLVideoElement, Event>) => {
    // Extract detailed error information
    const target = e.target as HTMLVideoElement
    let errorMessage = "Unknown error"

    if (target.error) {
      // Get the MediaError details
      switch (target.error.code) {
        case 1:
          errorMessage = "The fetching process was aborted by the user"
          break
        case 2:
          errorMessage = "Network error - video download failed"
          break
        case 3:
          errorMessage = "Video decoding failed - format may be unsupported"
          break
        case 4:
          errorMessage = "Video not found (404) or access denied"
          break
        default:
          errorMessage = `Error code: ${target.error.code}`
      }

      if (target.error.message) {
        errorMessage += ` - ${target.error.message}`
      }
    }

    // Log the detailed error
    console.error("Error loading video:", errorMessage)
    console.error("Failed URL:", target.src)

    // Store error details for display
    setErrorDetails(errorMessage)
    setVideoError(true)

    // Fetch bucket files to help with debugging
    fetchBucketFiles()
  }

  // Function to try alternative URL formats
  const tryAlternativeUrl = async (mp4Url: string) => {
    if (!videoRef.current || !currentProgram) return false

    setIsRetrying(true)
    console.log("Trying alternative URLs for:", mp4Url)

    try {
      // First, check if the filename contains a path
      const fileName = mp4Url.split("/").pop() || mp4Url

      // Try alternative URL formats
      const formats = [
        // Format 1: channel{id}/{filename}
        `https://msllqpnxwbugvkpnquwx.supabase.co/storage/v1/object/public/channel${channel.id}/${fileName}`,

        // Format 2: videos/{filename}
        `https://msllqpnxwbugvkpnquwx.supabase.co/storage/v1/object/public/videos/${fileName}`,

        // Format 3: videos/channel{id}/{filename}
        `https://msllqpnxwbugvkpnquwx.supabase.co/storage/v1/object/public/videos/channel${channel.id}/${fileName}`,

        // Format 4: media/{filename}
        `https://msllqpnxwbugvkpnquwx.supabase.co/storage/v1/object/public/media/${fileName}`,

        // Format 5: content/{filename}
        `https://msllqpnxwbugvkpnquwx.supabase.co/storage/v1/object/public/content/${fileName}`,

        // Format 6: assets/{filename}
        `https://msllqpnxwbugvkpnquwx.supabase.co/storage/v1/object/public/assets/${fileName}`,

        // Format 7: channel{id} with original path
        `https://msllqpnxwbugvkpnquwx.supabase.co/storage/v1/object/public/channel${channel.id}/${mp4Url}`,

        // Format 8: Try with MP4 extension if not present
        `https://msllqpnxwbugvkpnquwx.supabase.co/storage/v1/object/public/channel${channel.id}/${fileName}${fileName.includes(".") ? "" : ".mp4"}`,

        // Format 9: Try with direct URL if it's a full URL
        mp4Url.startsWith("http") ? mp4Url : `https://${mp4Url}`,
      ]

      // We'll try each format
      for (const url of formats) {
        try {
          console.log("Testing URL:", url)

          // Try to fetch the video
          const response = await fetch(url, { method: "HEAD" })

          if (response.ok) {
            console.log("Found working URL:", url)
            videoRef.current.src = url
            videoRef.current.load()
            await videoRef.current.play()
            setVideoError(false)
            setErrorDetails(null)
            setIsRetrying(false)
            return true
          }
        } catch (err) {
          console.error("Error testing URL:", url, err)
        }
      }

      // If we get here, none of the URLs worked
      console.error("All URL formats failed")
      setErrorDetails(`Could not find video file. Tried multiple formats for: ${fileName}`)
      return false
    } catch (err) {
      console.error("Error in tryAlternativeUrl:", err)
      return false
    } finally {
      setIsRetrying(false)
    }
  }

  // Function to retry playing the current video
  const retryPlayback = async () => {
    if (!currentProgram) return

    setIsRetrying(true)
    setVideoError(false)
    setErrorDetails(null)

    try {
      // First try the original URL
      if (videoRef.current) {
        videoRef.current.src = getVideoUrl(currentProgram.mp4_url)
        videoRef.current.load()
        try {
          await videoRef.current.play()
          setIsRetrying(false)
          return
        } catch (err) {
          console.error("Error playing original URL, trying alternatives:", err)
        }
      }

      // If that fails, try alternative URLs
      const success = await tryAlternativeUrl(currentProgram.mp4_url)
      if (!success) {
        setVideoError(true)
      }
    } catch (err) {
      console.error("Error in retry:", err)
      setVideoError(true)
      setErrorDetails(`Retry failed: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setIsRetrying(false)
    }
  }

  // Effect to handle initial setup and periodic refresh
  useEffect(() => {
    // Initial refresh if no program provided
    if (!currentProgram) {
      refreshCurrentProgram()
    }

    // Fetch bucket files for debugging
    fetchBucketFiles()

    // Set up periodic refresh (every minute)
    refreshTimerRef.current = setInterval(() => {
      refreshCurrentProgram()
    }, 60000)

    return () => {
      if (refreshTimerRef.current) {
        clearInterval(refreshTimerRef.current)
      }
    }
  }, [channel.id])

  // Effect to update progress for current program
  useEffect(() => {
    if (!currentProgram) return

    const progressTimer = setInterval(() => {
      const { progressPercent, isFinished } = calculateProgramProgress(currentProgram)

      if (isFinished) {
        // Time to refresh and get the next program
        refreshCurrentProgram()
      } else {
        setProgress(progressPercent)
      }
    }, 1000)

    return () => clearInterval(progressTimer)
  }, [currentProgram])

  // Effect to handle video playback
  useEffect(() => {
    if (videoRef.current && currentProgram && !videoError && !isRetrying) {
      videoRef.current.play().catch((error) => {
        console.error("Error playing video:", error)
        // Try alternative URLs before giving up
        tryAlternativeUrl(currentProgram.mp4_url).then((success) => {
          if (!success) {
            setVideoError(true)
            setErrorDetails(`Failed to play video: ${error.message || "Unknown error"}`)
          }
        })
      })
    }
  }, [currentProgram, videoError, isRetrying])

  // If no program or video error, show standby video
  if (!currentProgram || videoError) {
    return (
      <div className="w-full aspect-video bg-black relative">
        <video
          ref={standbyVideoRef}
          src={getStandbyVideoUrl()}
          className="w-full h-full"
          controls
          autoPlay
          loop
          onError={handleStandbyError}
        />

        <div className="absolute top-4 left-4 bg-black/70 px-3 py-1 rounded-md">
          <span className="text-sm font-medium">{channel.name}</span>
        </div>

        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4">
          <h3 className="text-lg font-bold mb-1">Standby</h3>
          <p className="text-sm text-gray-300">
            {!currentProgram ? "No program currently scheduled" : "Content temporarily unavailable"}
          </p>

          {error && <p className="text-red-400 text-xs mt-2">{error}</p>}

          {errorDetails && (
            <div className="mt-2 p-2 bg-red-900/30 rounded-md flex items-start">
              <AlertCircle className="h-4 w-4 text-red-400 mr-2 mt-0.5 flex-shrink-0" />
              <p className="text-red-400 text-xs">{errorDetails}</p>
            </div>
          )}

          {isLoading && <p className="text-blue-400 text-xs mt-2">Loading program schedule...</p>}

          {currentProgram && (
            <button
              onClick={retryPlayback}
              disabled={isRetrying}
              className="mt-3 px-3 py-1.5 bg-red-600/80 hover:bg-red-700 rounded-md text-sm flex items-center"
            >
              {isRetrying ? (
                <>
                  <RefreshCw className="h-3 w-3 mr-2 animate-spin" />
                  Trying alternative sources...
                </>
              ) : (
                <>
                  <RefreshCw className="h-3 w-3 mr-2" />
                  Retry Playback
                </>
              )}
            </button>
          )}

          {bucketFiles.length > 0 && (
            <div className="mt-3 p-2 bg-gray-800/50 rounded-md">
              <p className="text-xs text-gray-400 mb-1">Available files in bucket:</p>
              <div className="text-xs text-gray-500 max-h-20 overflow-y-auto">
                {bucketFiles.map((file, index) => (
                  <div key={index} className="truncate">
                    {file}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="w-full aspect-video bg-black relative">
      <video
        ref={videoRef}
        src={getVideoUrl(currentProgram.mp4_url)}
        className="w-full h-full"
        controls
        autoPlay
        onError={handleVideoError}
      />

      <div className="absolute top-4 left-4 bg-black/70 px-3 py-1 rounded-md">
        <span className="text-sm font-medium">{channel.name}</span>
      </div>

      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4">
        <h3 className="text-lg font-bold mb-1">{currentProgram.title}</h3>
        <div className="flex items-center text-sm text-gray-300 mb-2">
          <Clock className="h-3 w-3 mr-1" />
          <span>
            {new Date(currentProgram.start_time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </span>
        </div>

        <div className="w-full bg-gray-700 rounded-full h-1 mb-4">
          <div className="bg-red-600 h-1 rounded-full" style={{ width: `${progress}%` }}></div>
        </div>

        {upcomingPrograms.length > 0 && (
          <div className="hidden md:block">
            <h4 className="text-sm font-semibold mb-2 flex items-center">
              <Calendar className="h-3 w-3 mr-1" />
              Coming Up Next
            </h4>
            <div className="flex space-x-4 overflow-x-auto pb-2">
              {upcomingPrograms.slice(0, 3).map((program, index) => (
                <div key={index} className="min-w-[200px] bg-black/50 p-2 rounded">
                  <p className="font-medium text-sm">{program.title}</p>
                  <p className="text-xs text-gray-400">
                    {new Date(program.start_time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
