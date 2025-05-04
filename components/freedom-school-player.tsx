"use client"

import type React from "react"

import { useEffect, useRef, useState } from "react"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Volume2, VolumeX, Maximize, ExternalLink, AlertCircle } from "lucide-react"
import Link from "next/link"

// Define the Freedom School video content with more reliable sources
const FREEDOM_SCHOOL_CHANNEL_ID = "freedom-school"
const FREEDOM_SCHOOL_VIDEOS = [
  {
    id: 1,
    title: "The History of Freedom Schools",
    description: "Learn about the origins of Freedom Schools during the Civil Rights Movement",
    mp4_url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4", // Reliable test video
    thumbnail: "/placeholder.svg?key=z9nia",
    duration: 180, // in seconds
  },
  {
    id: 2,
    title: "Freedom Schools Today",
    description: "How the tradition continues in modern African American education",
    mp4_url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4", // Reliable test video
    thumbnail: "/placeholder.svg?key=7cdxz",
    duration: 240, // in seconds
  },
  {
    id: 3,
    title: "Education as Liberation",
    description: "The philosophy behind Freedom Schools",
    mp4_url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4", // Reliable test video
    thumbnail: "/placeholder.svg?key=ye8i8",
    duration: 210, // in seconds
  },
]

export function FreedomSchoolPlayer() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [currentVideoIndex, setCurrentVideoIndex] = useState(0)
  const [isMuted, setIsMuted] = useState(true)
  const [isPlaying, setIsPlaying] = useState(true)
  const [showInfo, setShowInfo] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const currentVideo = FREEDOM_SCHOOL_VIDEOS[currentVideoIndex]
  const videoUrl = currentVideo.mp4_url

  // Handle video end - play the next video in the loop
  const handleVideoEnd = () => {
    const nextIndex = (currentVideoIndex + 1) % FREEDOM_SCHOOL_VIDEOS.length
    setCurrentVideoIndex(nextIndex)
  }

  // Toggle mute state
  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !videoRef.current.muted
      setIsMuted(!isMuted)
    }
  }

  // Toggle info overlay
  const toggleInfo = () => {
    setShowInfo(!showInfo)
  }

  // Handle video errors
  const handleVideoError = (e: React.SyntheticEvent<HTMLVideoElement, Event>) => {
    console.error("Video error occurred:", e)

    // If we have a video element and a source URL, try reloading with a different approach
    if (videoRef.current && videoUrl) {
      console.log("Attempting to reload video with fallback method")

      // Try direct assignment without URL checking
      videoRef.current.src = videoUrl

      // Force load and play
      videoRef.current.load()
      videoRef.current.play().catch((err) => {
        console.error("Failed to play video after fallback:", err)
      })
    }
  }

  // Handle video loaded
  const handleVideoLoaded = () => {
    setIsLoading(false)
    setError(null)
  }

  // Try to play the video
  const attemptPlay = async () => {
    if (videoRef.current) {
      try {
        setIsLoading(true)
        await videoRef.current.play()
        setIsPlaying(true)
      } catch (err) {
        console.error("Error playing video:", err)
        setIsPlaying(false)
        setError("Video playback was blocked. Click to play.")
      } finally {
        setIsLoading(false)
      }
    }
  }

  // Manual play button handler
  const handleManualPlay = () => {
    if (error) {
      setError(null)
      attemptPlay()
    }
  }

  // Load the current video
  useEffect(() => {
    setIsLoading(true)
    setError(null)

    if (videoRef.current) {
      videoRef.current.src = currentVideo.mp4_url
      videoRef.current.load()
      attemptPlay()
    }
  }, [currentVideo, currentVideoIndex])

  // Register the Freedom School channel in Supabase if it doesn't exist
  useEffect(() => {
    const registerFreedomSchoolChannel = async () => {
      try {
        // Check if the Freedom School channel already exists
        const { data, error } = await supabase.from("channels").select("*").eq("id", FREEDOM_SCHOOL_CHANNEL_ID).single()

        if (error && error.code !== "PGRST116") {
          console.error("Error checking for Freedom School channel:", error)
          return
        }

        // If the channel doesn't exist, create it
        if (!data) {
          const { error: insertError } = await supabase.from("channels").insert([
            {
              id: FREEDOM_SCHOOL_CHANNEL_ID,
              name: "Freedom School Channel",
              slug: "freedom-school",
              description:
                "Educational content about the history and tradition of Freedom Schools in African American history",
              logo_url: "/placeholder.svg?key=p6ovi",
            },
          ])

          if (insertError) {
            console.error("Error creating Freedom School channel:", insertError)
            return
          }

          console.log("Freedom School channel created successfully")

          // Add the videos to the programs table
          for (const video of FREEDOM_SCHOOL_VIDEOS) {
            const startTime = new Date()
            startTime.setMinutes(startTime.getMinutes() - Math.floor(Math.random() * 60)) // Random start time in the past hour

            const { error: programError } = await supabase.from("programs").insert([
              {
                channel_id: FREEDOM_SCHOOL_CHANNEL_ID,
                title: video.title,
                mp4_url: video.mp4_url,
                start_time: startTime.toISOString(),
                duration: video.duration,
              },
            ])

            if (programError) {
              console.error(`Error adding program "${video.title}":`, programError)
            }
          }
        }
      } catch (err) {
        console.error("Error in registerFreedomSchoolChannel:", err)
      }
    }

    registerFreedomSchoolChannel()
  }, [])

  return (
    <div className="relative rounded-lg overflow-hidden bg-black border border-gray-800 shadow-lg">
      {/* Video Player */}
      <div className="relative aspect-video bg-gray-900">
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50">
            <div className="w-8 h-8 border-4 border-gray-300 border-t-red-600 rounded-full animate-spin"></div>
          </div>
        )}

        {error && (
          <div
            className="absolute inset-0 flex flex-col items-center justify-center bg-black/70 cursor-pointer"
            onClick={handleManualPlay}
          >
            <AlertCircle className="h-10 w-10 text-red-500 mb-2" />
            <p className="text-white text-center px-4">{error}</p>
            <Button variant="outline" size="sm" className="mt-4 bg-red-600 hover:bg-red-700 text-white border-none">
              Try Again
            </Button>
          </div>
        )}

        <video
          ref={videoRef}
          className="w-full h-full object-cover"
          playsInline
          muted={isMuted}
          onEnded={handleVideoEnd}
          onError={handleVideoError}
          onLoadedData={handleVideoLoaded}
          poster={currentVideo.thumbnail}
          controls={false}
        >
          <source src={currentVideo.mp4_url} type="video/mp4" />
          Your browser does not support the video tag.
        </video>

        {/* Title Overlay */}
        <div className="absolute top-0 left-0 right-0 bg-gradient-to-b from-black/80 to-transparent p-3">
          <h3 className="text-sm md:text-base font-semibold text-white">{currentVideo.title}</h3>
        </div>

        {/* Controls Overlay */}
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-3 flex justify-between items-center">
          <Button variant="ghost" size="sm" className="text-white hover:bg-black/50 p-1 h-auto" onClick={toggleMute}>
            {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
          </Button>

          <div className="flex space-x-2">
            <Button variant="ghost" size="sm" className="text-white hover:bg-black/50 p-1 h-auto" onClick={toggleInfo}>
              <span className="text-xs">Info</span>
            </Button>

            <Link href={`/watch/${FREEDOM_SCHOOL_CHANNEL_ID}`}>
              <Button variant="ghost" size="sm" className="text-white hover:bg-black/50 p-1 h-auto">
                <Maximize className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>

        {/* Info Overlay */}
        {showInfo && (
          <div className="absolute inset-0 bg-black/80 p-4 overflow-y-auto" onClick={toggleInfo}>
            <h3 className="text-lg font-bold text-white mb-2">{currentVideo.title}</h3>
            <p className="text-sm text-gray-300 mb-4">{currentVideo.description}</p>
            <p className="text-xs text-gray-400 mb-4">
              Part of our Freedom School educational series exploring the rich tradition of Freedom Schools in African
              American history.
            </p>
            <div className="flex justify-end">
              <Link href={`/watch/${FREEDOM_SCHOOL_CHANNEL_ID}`}>
                <Button size="sm" className="bg-red-600 hover:bg-red-700 text-white">
                  <ExternalLink className="h-3 w-3 mr-1" />
                  <span className="text-xs">Watch Full Channel</span>
                </Button>
              </Link>
            </div>
          </div>
        )}
      </div>

      {/* Playlist Preview */}
      <div className="bg-gray-900 p-3">
        <h4 className="text-xs font-medium text-gray-400 mb-2">FREEDOM SCHOOL CHANNEL</h4>
        <div className="flex space-x-2 overflow-x-auto pb-2">
          {FREEDOM_SCHOOL_VIDEOS.map((video, index) => (
            <button
              key={video.id}
              className={`flex-shrink-0 w-20 h-12 rounded overflow-hidden border-2 ${
                index === currentVideoIndex ? "border-red-600" : "border-transparent"
              }`}
              onClick={() => setCurrentVideoIndex(index)}
            >
              <img
                src={video.thumbnail || "/placeholder.svg"}
                alt={video.title}
                className="w-full h-full object-cover"
              />
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
