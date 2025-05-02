"use client"

import type React from "react"

import { useState, useEffect, useRef } from "react"
import { getCurrentProgram, getUpcomingPrograms, calculateProgramProgress } from "@/lib/supabase"
import type { Channel, Program } from "@/types"
import { Clock, Calendar, AlertCircle } from "lucide-react"

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
  const videoRef = useRef<HTMLVideoElement>(null)
  const standbyVideoRef = useRef<HTMLVideoElement>(null)
  const refreshTimerRef = useRef<NodeJS.Timeout | null>(null)

  // Function to get the standby video URL for this channel
  const getStandbyVideoUrl = () => {
    // Try different bucket path formats
    return "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/standby_blacktruthtv-D7yZUERL2zhjE71Llxul69gbPLxGES.mp4"
  }

  // Function to format the video URL with the bucket path
  const getVideoUrl = (mp4Url: string) => {
    // Try different bucket path formats
    // Format 1: Direct channel bucket
    const url = `https://msllqpnxwbugvkpnquwx.supabase.co/storage/v1/object/public/channel${channel.id}/${mp4Url}`
    console.log("Trying video URL:", url)
    return url
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

  // Handle standby video error
  const handleStandbyError = (e: React.SyntheticEvent<HTMLVideoElement, Event>) => {
    console.error("Error loading standby video:", e)
    // Try to extract more error details
    const target = e.target as HTMLVideoElement
    const errorMessage = `Error code: ${target.error?.code}, message: ${target.error?.message}`
    console.error(errorMessage)

    // No need to set video error state here as we're already in the standby view
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
  }

  // Function to test alternative video URLs
  const tryAlternativeUrl = async (mp4Url: string) => {
    if (!videoRef.current || !currentProgram) return

    // Try alternative URL formats
    const formats = [
      // Format 1: videos/channel{id}
      `https://msllqpnxwbugvkpnquwx.supabase.co/storage/v1/object/public/videos/channel${channel.id}/${mp4Url}`,
      // Format 2: channel{id} (no videos prefix)
      `https://msllqpnxwbugvkpnquwx.supabase.co/storage/v1/object/public/channel${channel.id}/${mp4Url}`,
      // Format 3: videos (no channel subfolder)
      `https://msllqpnxwbugvkpnquwx.supabase.co/storage/v1/object/public/videos/${mp4Url}`,
      // Format 4: channel{id} bucket with no subfolder
      `https://msllqpnxwbugvkpnquwx.supabase.co/storage/v1/object/public/channel${channel.id}/${mp4Url}`,
    ]

    // We'll try each format
    for (const url of formats) {
      try {
        console.log("Testing alternative URL:", url)
        // Check if the URL is accessible
        const response = await fetch(url, { method: "HEAD" })
        if (response.ok) {
          console.log("Found working URL:", url)
          videoRef.current.src = url
          videoRef.current.load()
          videoRef.current.play().catch((err) => {
            console.error("Error playing video with alternative URL:", err)
          })
          return true
        }
      } catch (err) {
        console.error("Error testing URL:", url, err)
      }
    }

    return false
  }

  // Effect to handle initial setup and periodic refresh
  useEffect(() => {
    // Initial refresh if no program provided
    if (!currentProgram) {
      refreshCurrentProgram()
    }

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
    if (videoRef.current && currentProgram && !videoError) {
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
  }, [currentProgram, videoError])

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
