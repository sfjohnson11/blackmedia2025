"use client"

import type React from "react"

import { useState, useEffect, useRef } from "react"
import { getCurrentProgram, getUpcomingPrograms, calculateProgramProgress } from "@/lib/supabase"
import type { Channel, Program } from "@/types"
import { Clock, Calendar } from "lucide-react"

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
  const videoRef = useRef<HTMLVideoElement>(null)
  const standbyVideoRef = useRef<HTMLVideoElement>(null)
  const refreshTimerRef = useRef<NodeJS.Timeout | null>(null)

  // Function to get the standby video URL for this channel
  const getStandbyVideoUrl = () => {
    // Use the standby.mp4 from the channel's bucket
    // Make sure to use the correct bucket name format
    return `https://msllqpnxwbugvkpnquwx.supabase.co/storage/v1/object/public/videos/channel${channel.id}/standby.mp4`
  }

  // Fallback standby video in case the channel-specific one fails
  const fallbackStandbyUrl =
    "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/standby_blacktruthtv-D7yZUERL2zhjE71Llxul69gbPLxGES.mp4"

  // Function to format the video URL with the bucket path
  const getVideoUrl = (mp4Url: string) => {
    // Updated to use the correct bucket path format
    // Log the constructed URL for debugging
    const url = `https://msllqpnxwbugvkpnquwx.supabase.co/storage/v1/object/public/videos/channel${channel.id}/${mp4Url}`
    console.log("Video URL:", url)
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

  // Handle standby video error (fall back to the generic standby)
  const handleStandbyError = (e: React.SyntheticEvent<HTMLVideoElement, Event>) => {
    console.error("Error loading channel standby video, switching to fallback", e)
    if (standbyVideoRef.current) {
      standbyVideoRef.current.src = fallbackStandbyUrl
      standbyVideoRef.current.load()
      standbyVideoRef.current.play().catch((err) => {
        console.error("Error playing fallback standby video:", err)
      })
    }
  }

  // Handle video error
  const handleVideoError = (e: React.SyntheticEvent<HTMLVideoElement, Event>) => {
    console.error("Error loading video, switching to standby", e)
    // Log the URL that failed
    if (videoRef.current) {
      console.error("Failed URL:", videoRef.current.src)
    }
    setVideoError(true)
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
        setVideoError(true)
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
          crossOrigin="anonymous"
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
        crossOrigin="anonymous"
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
