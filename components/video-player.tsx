"use client"

import type React from "react"
import { useState, useEffect, useRef } from "react"
import {
  getCurrentProgram,
  getUpcomingPrograms,
  calculateProgramProgress,
  isLiveChannel,
  getLiveStreamUrl,
} from "@/lib/supabase"
import type { Channel, Program } from "@/types"
import { Clock, Calendar, RefreshCw, Info, Play } from "lucide-react"
import { cleanChannelName } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import Link from "next/link"

interface VideoPlayerProps {
  channel: Channel
  initialProgram: Program | null
  upcomingPrograms: Program[]
}

export function VideoPlayer({ channel, initialProgram, upcomingPrograms: initialUpcoming }: VideoPlayerProps) {
  // Get the Supabase URL from environment or fall back to default
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://msllqpnxwbugvkpnquwx.supabase.co"
  const [currentProgram, setCurrentProgram] = useState<Program | null>(initialProgram)
  const [upcomingPrograms, setUpcomingPrograms] = useState<Program[]>(initialUpcoming)
  const [progress, setProgress] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showStandby, setShowStandby] = useState(true) // Start with standby visible
  const [errorDetails, setErrorDetails] = useState<string | null>(null)
  const [isRetrying, setIsRetrying] = useState(false)
  const [attemptedUrls, setAttemptedUrls] = useState<string[]>([])
  const [showDebugInfo, setShowDebugInfo] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)
  const standbyVideoRef = useRef<HTMLVideoElement>(null)
  const refreshTimerRef = useRef<NodeJS.Timeout | null>(null)
  const errorTimerRef = useRef<NodeJS.Timeout | null>(null)
  const standbyContainerRef = useRef<HTMLDivElement>(null)
  const mainContainerRef = useRef<HTMLDivElement>(null)
  const loadAttemptRef = useRef(0)
  const maxAttempts = 3 // Reduce number of attempts to avoid excessive retries

  const cleanedName = cleanChannelName(channel.name)

  // Standby video URL - using a reliable source
  const standbyVideoUrl =
    "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/standby_blacktruthtv-D7yZUERL2zhjE71Llxul69gbPLxGES.mp4"

  // Function to check if the browser supports the video format
  const checkVideoCompatibility = (url: string) => {
    // Extract file extension from URL
    const extension = url.split(".").pop()?.toLowerCase() || ""

    // Check if the browser supports this format
    if (extension === "mp4") {
      return videoRef.current?.canPlayType("video/mp4") || ""
    } else if (extension === "webm") {
      return videoRef.current?.canPlayType("video/webm") || ""
    } else if (extension === "ogg") {
      return videoRef.current?.canPlayType("video/ogg") || ""
    } else if (extension === "m3u8") {
      return videoRef.current?.canPlayType("application/vnd.apple.mpegurl") || ""
    }

    return "unknown format"
  }

  // Ensure standby video is always ready
  useEffect(() => {
    // Initialize standby video with better error handling
    if (standbyVideoRef.current) {
      console.log("Initializing standby video")
      standbyVideoRef.current.src = standbyVideoUrl
      standbyVideoRef.current.load()

      // Preload the standby video
      standbyVideoRef.current.preload = "auto"

      // Add event listeners for better debugging
      standbyVideoRef.current.addEventListener("error", (e) => {
        console.error("Standby video error:", e)
      })

      standbyVideoRef.current.addEventListener("loadeddata", () => {
        console.log("Standby video loaded successfully")
      })
    }

    // For channel 2 specifically, start with standby visible
    // This helps ensure we don't show a black screen while checking URLs
    if (channel.id === "2") {
      setShowStandby(true)
      console.log("Channel 2 detected, starting with standby video visible")
    }
  }, [standbyVideoUrl, channel.id])

  // Function to get video URL - focusing exclusively on Supabase URL patterns
  const getVideoUrl = (mp4Url: string) => {
    // Extract the filename from the URL
    const fileName = mp4Url.split("/").pop() || mp4Url

    // If it's already a full URL with http/https, use it directly
    if (mp4Url.startsWith("http")) {
      return mp4Url
    }

    // For Channel 21 (live channel), prioritize direct path
    if (channel.id === "21") {
      return `${supabaseUrl}/storage/v1/object/public/videos/${fileName}`
    }

    // Special handling for Channel 1 which is having playback issues
    if (channel.id === "1") {
      console.log("Special handling for channel 1")
      // Try these specific formats for channel 1
      const urlFormats = [
        // Try with direct filename in videos bucket first (most likely to work)
        `${supabaseUrl}/storage/v1/object/public/videos/${fileName}`,
        // Try with channel1 bucket
        `${supabaseUrl}/storage/v1/object/public/channel1/${fileName}`,
        // Try with videos/channel1 path
        `${supabaseUrl}/storage/v1/object/public/videos/channel1/${fileName}`,
        // Try with ch1 bucket
        `${supabaseUrl}/storage/v1/object/public/ch1/${fileName}`,
        // Try with the direct URL if it's a full path
        mp4Url.startsWith("http") ? mp4Url : null,
      ].filter(Boolean) as string[]

      // Use the current attempt to select a URL format
      const attemptIndex = loadAttemptRef.current % urlFormats.length
      const url = urlFormats[attemptIndex]

      // Add to attempted URLs for debugging
      if (!attemptedUrls.includes(url)) {
        setAttemptedUrls((prev) => [...prev, url])
      }

      return url
    }

    // Special handling for Channel 6 which is having format errors
    if (channel.id === "6") {
      console.log("Special handling for channel 6")
      // Try these specific formats for channel 6
      const urlFormats = [
        // Try with direct filename in videos bucket first (most likely to work)
        `${supabaseUrl}/storage/v1/object/public/videos/${fileName}`,
        // Try with channel6 bucket
        `${supabaseUrl}/storage/v1/object/public/channel6/${fileName}`,
        // Try with videos/channel6 path
        `${supabaseUrl}/storage/v1/object/public/videos/channel6/${fileName}`,
        // Try with ch6 bucket
        `${supabaseUrl}/storage/v1/object/public/ch6/${fileName}`,
        // Try with the direct URL if it's a full path
        mp4Url.startsWith("http") ? mp4Url : null,
      ].filter(Boolean) as string[]

      // Use the current attempt to select a URL format
      const attemptIndex = loadAttemptRef.current % urlFormats.length
      const url = urlFormats[attemptIndex]

      // Add to attempted URLs for debugging
      if (!attemptedUrls.includes(url)) {
        setAttemptedUrls((prev) => [...prev, url])
      }

      return url
    }

    // Special handling for Channel 2 which seems to have issues
    if (channel.id === "2") {
      // Try these specific formats for channel 2
      const urlFormats = [
        // Try with channel2 bucket first
        `${supabaseUrl}/storage/v1/object/public/channel2/${fileName}`,
        // Try with videos/channel2 path
        `${supabaseUrl}/storage/v1/object/public/videos/channel2/${fileName}`,
        // Try with just the filename in videos bucket
        `${supabaseUrl}/storage/v1/object/public/videos/${fileName}`,
        // Try with ch2 bucket
        `${supabaseUrl}/storage/v1/object/public/ch2/${fileName}`,
        // Try with the direct URL if it's a full path
        mp4Url.startsWith("http") ? mp4Url : null,
      ].filter(Boolean) as string[]

      // Use the current attempt to select a URL format
      const attemptIndex = loadAttemptRef.current % urlFormats.length
      const url = urlFormats[attemptIndex]

      // Add to attempted URLs for debugging
      if (!attemptedUrls.includes(url)) {
        setAttemptedUrls((prev) => [...prev, url])
      }

      return url
    }

    // For other channels, use the standard rotation of formats
    const urlFormats = [
      // Format 1: Direct URL if already a complete URL
      mp4Url.startsWith("http") ? mp4Url : null,

      // Format 2: channel{id}/{filename} - standard bucket pattern
      `${supabaseUrl}/storage/v1/object/public/channel${channel.id}/${fileName}`,

      // Format 3: videos/channel{id}/{filename} - nested path pattern
      `${supabaseUrl}/storage/v1/object/public/videos/channel${channel.id}/${fileName}`,

      // Format 4: Root bucket with filename only
      `${supabaseUrl}/storage/v1/object/public/videos/${fileName}`,

      // Format 5: Using channel ID as bucket
      `${supabaseUrl}/storage/v1/object/public/${channel.id}/${fileName}`,

      // Format 6: Try with channel ID as string in path
      `${supabaseUrl}/storage/v1/object/public/videos/ch${channel.id}/${fileName}`,

      // Format 7: Try with direct filename in channel bucket
      `${supabaseUrl}/storage/v1/object/public/ch${channel.id}/${fileName}`,
    ].filter(Boolean) as string[]

    // Use the current attempt to select a URL format
    const attemptIndex = loadAttemptRef.current % urlFormats.length
    const url = urlFormats[attemptIndex]

    // Add to attempted URLs for debugging
    if (!attemptedUrls.includes(url)) {
      setAttemptedUrls((prev) => [...prev, url])
    }

    return url
  }

  // Function to check if a Supabase URL exists before trying to play it
  const checkUrlExists = async (url: string): Promise<boolean> => {
    try {
      // Special handling for Channel 21 (live channel) - more aggressive checking
      if (channel.id === "21") {
        // Try multiple times with different cache-busting parameters
        for (let i = 0; i < 3; i++) {
          const checkUrl = `${url}?t=${Date.now()}-${i}`
          const response = await fetch(checkUrl, {
            method: "HEAD",
            headers: {
              "Cache-Control": "no-cache",
            },
          })
          if (response.ok) return true
        }
        return false
      }

      // Special handling for channel 6 to detect format errors
      if (channel.id === "6") {
        const checkUrl = `${url}?${Date.now()}`
        try {
          const response = await fetch(checkUrl, {
            method: "HEAD",
            headers: {
              "Cache-Control": "no-cache",
            },
            // Add a timeout to avoid hanging requests
            signal: AbortSignal.timeout(5000),
          })

          // Log detailed response for debugging
          console.log(`URL check for channel 6: ${url}, status: ${response.status}, ok: ${response.ok}`)

          // Check for 403 Forbidden which might indicate CORS issues
          if (response.status === 403) {
            console.error("Possible CORS issue detected for URL:", url)
            setErrorDetails((prev) => `${prev || ""} - Possible CORS issue detected`)
          }

          return response.ok
        } catch (error) {
          console.error(`Error checking URL for channel 6: ${url}`, error)
          return false
        }
      }

      // Standard check for other channels
      const checkUrl = `${url}?${Date.now()}`
      const response = await fetch(checkUrl, {
        method: "HEAD",
        headers: {
          "Cache-Control": "no-cache",
        },
      })
      return response.ok
    } catch (error) {
      console.error("Error checking Supabase URL:", error)
      return false
    }
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

    // Check video format compatibility
    if (target.src) {
      const compatibility = checkVideoCompatibility(target.src)
      console.log(`Video format compatibility: ${compatibility}`)
      if (compatibility === "") {
        console.error("Browser does not support this video format")
        setErrorDetails((prev) => `${prev || ""} - Browser does not support this video format`)
      }
    }

    // For format errors (code 3), try to provide more specific information
    if (target.error && target.error.code === 3) {
      console.error("Format error detected - video format may be incompatible with browser")
      errorMessage += " - Video format may be incompatible with this browser"

      // For channel 6 specifically, try more aggressively with different formats
      if (channel.id === "6") {
        loadAttemptRef.current += 1

        if (currentProgram && videoRef.current && loadAttemptRef.current < 10) {
          console.log(`Channel 6 - Trying next URL format (attempt ${loadAttemptRef.current})`)
          const nextUrl = getVideoUrl(currentProgram.mp4_url)

          // Add cache-busting parameter
          const urlWithCacheBust = `${nextUrl}?t=${Date.now()}-${loadAttemptRef.current}`

          console.log(`Trying URL: ${urlWithCacheBust}`)
          videoRef.current.src = urlWithCacheBust
          videoRef.current.load()
          return
        }
      }
    }

    // Special handling for Channel 1
    if (channel.id === "1") {
      console.log("Video error for channel 1, trying next format")
      loadAttemptRef.current += 1

      // Try more formats for channel 1 before giving up
      if (currentProgram && videoRef.current && loadAttemptRef.current < 10) {
        console.log(`Channel 1 - Trying next URL format (attempt ${loadAttemptRef.current})`)
        const nextUrl = getVideoUrl(currentProgram.mp4_url)

        // Add cache-busting parameter
        const urlWithCacheBust = `${nextUrl}?t=${Date.now()}-${loadAttemptRef.current}`

        console.log(`Trying URL: ${urlWithCacheBust}`)
        videoRef.current.src = urlWithCacheBust
        videoRef.current.load()
        return
      } else {
        // We've tried enough formats, show standby
        console.log("All URL formats failed for channel 1, showing standby")
        setShowStandby(true)

        // Make sure standby video is playing
        if (standbyVideoRef.current) {
          standbyVideoRef.current.play().catch((e) => {
            console.error("Failed to play standby video:", e)
          })
        }
        return
      }
    }

    // Store error details for display
    setErrorDetails(`${errorMessage} (URL: ${target.src.split("/").slice(-2).join("/")}...)`)

    // For Channel 21 (live channel), try more aggressively with different formats
    if (channel.id === "21") {
      loadAttemptRef.current += 1

      // For Channel 21, try the live stream URL if video files fail
      if (loadAttemptRef.current >= 3 && isLiveChannel(channel.id)) {
        const liveUrl = getLiveStreamUrl(channel.id)
        if (liveUrl && videoRef.current) {
          console.log(`Trying live stream URL for channel ${channel.id}: ${liveUrl}`)
          videoRef.current.src = liveUrl
          videoRef.current.load()
          return
        }
      }

      if (currentProgram && videoRef.current && loadAttemptRef.current < 10) {
        // More attempts for Channel 21
        console.log(`Channel ${channel.id} - Trying next URL format (attempt ${loadAttemptRef.current})`)
        const nextUrl = getVideoUrl(currentProgram.mp4_url)
        videoRef.current.src = nextUrl
        videoRef.current.load()
        return
      }
    } else {
      // Standard handling for other channels
      loadAttemptRef.current += 1

      if (currentProgram && videoRef.current && loadAttemptRef.current < maxAttempts * 3) {
        console.log(`Automatically trying next URL format (attempt ${loadAttemptRef.current})`)
        const nextUrl = getVideoUrl(currentProgram.mp4_url)
        videoRef.current.src = nextUrl
        videoRef.current.load()
        return
      }
    }

    // If no program or we've tried all formats, show standby
    console.log("All URL formats failed or no program, showing standby")
    setShowStandby(true)

    // Make sure standby video is playing
    if (standbyVideoRef.current) {
      standbyVideoRef.current.play().catch((e) => {
        console.error("Failed to play standby video:", e)
      })
    }
  }

  // Function to retry playing the current video
  const retryPlayback = async () => {
    if (!currentProgram) return

    setIsRetrying(true)
    setErrorDetails(null)
    // Reset the load attempt counter to try all formats again
    loadAttemptRef.current = 0
    setAttemptedUrls([])

    try {
      // Try to load the video again
      if (videoRef.current) {
        // Get a fresh URL with a cache-busting parameter
        const freshUrl = `${getVideoUrl(currentProgram.mp4_url)}?t=${Date.now()}`
        videoRef.current.src = freshUrl
        videoRef.current.load()

        // The onLoadedData event will handle hiding the standby if successful
      }
    } catch (err) {
      console.error("Error in retry:", err)
      setErrorDetails(`Retry failed: ${err instanceof Error ? err.message : String(err)}`)
      setShowStandby(true)
    } finally {
      setIsRetrying(false)
    }
  }

  const refreshCurrentProgram = async () => {
    setIsLoading(true)
    setError(null)

    try {
      const { program } = await getCurrentProgram(channel.id)
      const { programs } = await getUpcomingPrograms(channel.id)

      setCurrentProgram(program)
      setUpcomingPrograms(programs)

      // If this is Channel 21 (live), try to use the live stream first
      if (isLiveChannel(channel.id)) {
        const liveUrl = getLiveStreamUrl(channel.id)
        if (liveUrl && videoRef.current) {
          console.log(`Loading live stream for channel ${channel.id}: ${liveUrl}`)
          videoRef.current.src = liveUrl
          videoRef.current.load()
          setShowStandby(false)
          setIsLoading(false)
          return
        }
      }

      // Special handling for channel 1 which is having playback issues
      if (channel.id === "1") {
        console.log("Special handling for channel 1 in refreshCurrentProgram")

        // If we have a program, try to load it with enhanced error handling
        if (program && videoRef.current) {
          // Reset counters
          loadAttemptRef.current = 0
          setAttemptedUrls([])

          // Try to load the video but keep standby visible until we confirm it works
          const url = getVideoUrl(program.mp4_url)
          console.log(`Trying URL for channel 1: ${url}`)

          // Add a cache-busting parameter to the URL
          const urlWithCacheBust = `${url}?t=${Date.now()}`

          // Check if URL exists before trying to load it
          try {
            const exists = await checkUrlExists(url)
            if (exists) {
              videoRef.current.src = urlWithCacheBust
              videoRef.current.load()

              // Add an event listener to detect when video starts playing
              const playingHandler = () => {
                console.log("Channel 1 video started playing successfully")
                setShowStandby(false)
                videoRef.current?.removeEventListener("playing", playingHandler)
              }

              videoRef.current.addEventListener("playing", playingHandler)

              // Set a timeout to show standby if video doesn't play within 5 seconds
              setTimeout(() => {
                if (showStandby === false && videoRef.current?.paused) {
                  console.log("Channel 1 video failed to play within timeout, showing standby")
                  setShowStandby(true)

                  // Make sure standby video is playing
                  if (standbyVideoRef.current) {
                    standbyVideoRef.current.play().catch((e) => {
                      console.error("Failed to play standby video:", e)
                    })
                  }
                }
              }, 5000)
            } else {
              console.log("URL check failed for channel 1, showing standby")
              setShowStandby(true)

              // Make sure standby video is playing
              if (standbyVideoRef.current) {
                standbyVideoRef.current.play().catch((e) => {
                  console.error("Failed to play standby video:", e)
                })
              }
            }
          } catch (error) {
            console.error("Error checking URL for channel 1:", error)
            setShowStandby(true)

            // Make sure standby video is playing
            if (standbyVideoRef.current) {
              standbyVideoRef.current.play().catch((e) => {
                console.error("Failed to play standby video:", e)
              })
            }
          }
        } else {
          // No program available, show standby video
          console.log(`No program found for channel 1, showing standby video`)
          setShowStandby(true)

          // Make sure standby video is playing
          if (standbyVideoRef.current) {
            standbyVideoRef.current.play().catch((e) => {
              console.error("Failed to play standby video:", e)
            })
          }
        }
      }
      // Special handling for channel 6 which is having format errors
      else if (channel.id === "6") {
        console.log("Special handling for channel 6 in refreshCurrentProgram")

        // If we have a program, try to load it with enhanced error handling
        if (program && videoRef.current) {
          // Reset counters
          loadAttemptRef.current = 0
          setAttemptedUrls([])

          // Try to load the video but keep standby visible until we confirm it works
          const url = getVideoUrl(program.mp4_url)
          console.log(`Trying URL for channel 6: ${url}`)

          // Add a cache-busting parameter to the URL
          const urlWithCacheBust = `${url}?t=${Date.now()}`

          // Check if URL exists before trying to load it
          try {
            const exists = await checkUrlExists(url)
            if (exists) {
              videoRef.current.src = urlWithCacheBust
              videoRef.current.load()

              // Add an event listener to detect when video starts playing
              const playingHandler = () => {
                console.log("Channel 6 video started playing successfully")
                setShowStandby(false)
                videoRef.current?.removeEventListener("playing", playingHandler)
              }

              videoRef.current.addEventListener("playing", playingHandler)

              // Set a timeout to show standby if video doesn't play within 5 seconds
              setTimeout(() => {
                if (showStandby === false && videoRef.current?.paused) {
                  console.log("Channel 6 video failed to play within timeout, showing standby")
                  setShowStandby(true)

                  // Make sure standby video is playing
                  if (standbyVideoRef.current) {
                    standbyVideoRef.current.play().catch((e) => {
                      console.error("Failed to play standby video:", e)
                    })
                  }
                }
              }, 5000)
            } else {
              console.log("URL check failed for channel 6, showing standby")
              setShowStandby(true)

              // Make sure standby video is playing
              if (standbyVideoRef.current) {
                standbyVideoRef.current.play().catch((e) => {
                  console.error("Failed to play standby video:", e)
                })
              }
            }
          } catch (error) {
            console.error("Error checking URL for channel 6:", error)
            setShowStandby(true)

            // Make sure standby video is playing
            if (standbyVideoRef.current) {
              standbyVideoRef.current.play().catch((e) => {
                console.error("Failed to play standby video:", e)
              })
            }
          }
        } else {
          // No program available, show standby video
          console.log(`No program found for channel 6, showing standby video`)
          setShowStandby(true)

          // Make sure standby video is playing
          if (standbyVideoRef.current) {
            standbyVideoRef.current.play().catch((e) => {
              console.error("Failed to play standby video:", e)
            })
          }
        }
      } else if (channel.id === "2") {
        // Special handling for channel 2 which seems problematic
        if (channel.id === "2") {
          console.log("Special handling for channel 2")

          // If we have a program, try to load it but be ready to fall back quickly
          if (program && videoRef.current) {
            // Reset counters
            loadAttemptRef.current = 0
            setAttemptedUrls([])

            // Try to load the video but keep standby visible until we confirm it works
            const url = getVideoUrl(program.mp4_url)
            console.log(`Trying URL for channel 2: ${url}`)

            // Check if URL exists before trying to load it
            const exists = await checkUrlExists(url)
            if (exists) {
              videoRef.current.src = url
              videoRef.current.load()
              // We'll hide standby when video loads via the onLoadedData event
            } else {
              console.log("URL check failed for channel 2, showing standby")
              setShowStandby(true)

              // Make sure standby video is playing
              if (standbyVideoRef.current) {
                standbyVideoRef.current.play().catch((e) => {
                  console.error("Failed to play standby video:", e)
                })
              }
            }
          } else {
            // No program available, show standby video
            console.log(`No program found for channel 2, showing standby video`)
            setShowStandby(true)

            // Make sure standby video is playing
            if (standbyVideoRef.current) {
              standbyVideoRef.current.play().catch((e) => {
                console.error("Failed to play standby video:", e)
              })
            }
          }
        } else {
          // For non-live channels or if live stream fails
          if (program && videoRef.current) {
            // Reset counters
            loadAttemptRef.current = 0
            setAttemptedUrls([])

            // Set the video source
            videoRef.current.src = getVideoUrl(program.mp4_url)
            videoRef.current.load()
            setShowStandby(false) // Hide standby when new program loads
          } else {
            // No program available, show standby video
            console.log(`No program found for channel ${channel.id}, showing standby video`)
            setShowStandby(true)

            // Make sure standby video is playing
            if (standbyVideoRef.current) {
              standbyVideoRef.current.play().catch((e) => {
                console.error("Failed to play standby video:", e)
              })
            }
          }
        }
      }
    } catch (e) {
      console.error(`Error refreshing program for channel ${channel.id}:`, e)
      setError(`Failed to refresh program: ${e}`)
      setShowStandby(true)

      // Make sure standby video is playing on error
      if (standbyVideoRef.current) {
        standbyVideoRef.current.play().catch((e) => {
          console.error("Failed to play standby video:", e)
        })
      }
    } finally {
      setIsLoading(false)
    }
  }

  const handleVideoLoaded = () => {
    setShowStandby(false) // Hide standby when video loads successfully
  }

  // Effect to handle initial setup and periodic refresh
  useEffect(() => {
    // Initial setup
    if (!currentProgram) {
      console.log(`No initial program for channel ${channel.id}, refreshing...`)
      refreshCurrentProgram()
    } else {
      // If we have an initial program, try to load it
      if (videoRef.current) {
        // Reset counters
        loadAttemptRef.current = 0
        setAttemptedUrls([])

        // Set the video source
        videoRef.current.src = getVideoUrl(currentProgram.mp4_url)
        videoRef.current.load()
        setShowStandby(false)
      }
    }

    // Set up periodic refresh (every minute)
    refreshTimerRef.current = setInterval(() => {
      refreshCurrentProgram()
    }, 60000)

    return () => {
      if (refreshTimerRef.current) {
        clearInterval(refreshTimerRef.current)
      }
      if (errorTimerRef.current) {
        clearTimeout(errorTimerRef.current)
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

  // Effect to handle video playback when program changes
  useEffect(() => {
    if (videoRef.current && currentProgram) {
      // Reset counters
      loadAttemptRef.current = 0
      setAttemptedUrls([])
      setErrorDetails(null)

      // Check if this is a live channel
      if (isLiveChannel(channel.id)) {
        const liveStreamUrl = getLiveStreamUrl(channel.id)
        if (liveStreamUrl && videoRef.current) {
          console.log(`Loading live stream for channel ${channel.id}: ${liveStreamUrl}`)
          videoRef.current.src = liveStreamUrl
          videoRef.current.load()
          setShowStandby(false)
          // Exit early since we're using a live stream
          return
        } else {
          console.error("Live channel configured but no stream URL available")
          setErrorDetails("Live stream configuration error")
          setShowStandby(true)
          return
        }
      }

      // For Channel 21 (live channel), try direct URL first
      if (channel.id === "21" && currentProgram.mp4_url) {
        const url = getVideoUrl(currentProgram.mp4_url)
        console.log(`Trying URL for Channel 21: ${url}`)
        videoRef.current.src = url
        videoRef.current.load()
        return
      }

      const loadVideo = async () => {
        // Special handling for channel 1
        if (channel.id === "1") {
          console.log("Special video loading for channel 1")
          let foundWorkingUrl = false

          // Try each URL format with enhanced error handling
          for (let i = 0; i < 10; i++) {
            // Try more formats for channel 1
            loadAttemptRef.current = i
            const url = getVideoUrl(currentProgram.mp4_url)
            const urlWithCacheBust = `${url}?t=${Date.now()}-${i}`

            try {
              console.log(`Trying URL format ${i + 1} for channel 1: ${url}`)
              const exists = await checkUrlExists(url)

              if (exists) {
                console.log(`Found working URL for channel 1: ${url}`)
                if (videoRef.current) {
                  videoRef.current.src = urlWithCacheBust
                  videoRef.current.load()

                  // Add an event listener to detect when video starts playing
                  const playingHandler = () => {
                    console.log("Channel 1 video started playing successfully")
                    setShowStandby(false)
                    foundWorkingUrl = true
                    videoRef.current?.removeEventListener("playing", playingHandler)
                  }

                  videoRef.current.addEventListener("playing", playingHandler)

                  // Wait a bit to see if this format works before trying the next one
                  await new Promise((resolve) => setTimeout(resolve, 2000))

                  if (foundWorkingUrl) {
                    return // Exit if we found a working URL
                  }
                }
              } else {
                console.log(`URL format ${i + 1} failed for channel 1: ${url}`)
              }
            } catch (error) {
              console.error(`Error checking URL format ${i + 1} for channel 1:`, error)
            }
          }

          // If we get here, none of the URLs worked for channel 1
          console.error(`All URL formats failed for channel 1, program: ${currentProgram.title}`)
          setErrorDetails(`Could not find a valid video URL for channel 1: ${currentProgram.title}`)

          // Explicitly show standby video
          setShowStandby(true)

          // Make sure standby video is playing
          if (standbyVideoRef.current) {
            standbyVideoRef.current.play().catch((e) => {
              console.error("Failed to play standby video:", e)
            })
          }

          return // Exit the loadVideo function early
        }
        // Special handling for channel 6
        else if (channel.id === "6") {
          console.log("Special video loading for channel 6")
          let foundWorkingUrl = false

          // Try each URL format with enhanced error handling
          for (let i = 0; i < 10; i++) {
            // Try more formats for channel 6
            loadAttemptRef.current = i
            const url = getVideoUrl(currentProgram.mp4_url)
            const urlWithCacheBust = `${url}?t=${Date.now()}-${i}`

            try {
              console.log(`Trying URL format ${i + 1} for channel 6: ${url}`)
              const exists = await checkUrlExists(url)

              if (exists) {
                console.log(`Found working URL for channel 6: ${url}`)
                if (videoRef.current) {
                  videoRef.current.src = urlWithCacheBust
                  videoRef.current.load()

                  // Add an event listener to detect when video starts playing
                  const playingHandler = () => {
                    console.log("Channel 6 video started playing successfully")
                    setShowStandby(false)
                    foundWorkingUrl = true
                    videoRef.current?.removeEventListener("playing", playingHandler)
                  }

                  videoRef.current.addEventListener("playing", playingHandler)

                  // Wait a bit to see if this format works before trying the next one
                  await new Promise((resolve) => setTimeout(resolve, 2000))

                  if (foundWorkingUrl) {
                    return // Exit if we found a working URL
                  }
                }
              } else {
                console.log(`URL format ${i + 1} failed for channel 6: ${url}`)
              }
            } catch (error) {
              console.error(`Error checking URL format ${i + 1} for channel 6:`, error)
            }
          }

          // If we get here, none of the URLs worked for channel 6
          console.error(`All URL formats failed for channel 6, program: ${currentProgram.title}`)
          setErrorDetails(`Could not find a valid video URL for channel 6: ${currentProgram.title}`)

          // Explicitly show standby video
          setShowStandby(true)

          // Make sure standby video is playing
          if (standbyVideoRef.current) {
            standbyVideoRef.current.play().catch((e) => {
              console.error("Failed to play standby video:", e)
            })
          }

          return // Exit the loadVideo function early
        }

        // Try to find a working URL for other channels...

        // Try to find a working URL
        let foundWorkingUrl = false

        for (let i = 0; i < 7; i++) {
          // Try all 7 URL formats
          loadAttemptRef.current = i
          const url = getVideoUrl(currentProgram.mp4_url)

          try {
            // Check if the URL exists before trying to play it
            console.log(`Trying URL format ${i + 1} for channel ${channel.id}: ${url}`)
            const exists = await checkUrlExists(url)

            if (exists) {
              console.log(`Found working URL: ${url}`)
              if (videoRef.current) {
                videoRef.current.src = url
                videoRef.current.load()
                foundWorkingUrl = true
                return // Exit if we found a working URL
              }
            } else {
              console.log(`URL format ${i + 1} failed: ${url}`)
            }
          } catch (error) {
            console.error(`Error checking URL format ${i + 1}:`, error)
          }
        }

        // If we get here, none of the URLs worked
        console.error(`All URL formats failed for channel ${channel.id}, program: ${currentProgram.title}`)
        setErrorDetails(`Could not find a valid video URL for this program: ${currentProgram.title}`)

        // Explicitly show standby video
        setShowStandby(true)

        // Make sure standby video is playing
        if (standbyVideoRef.current) {
          standbyVideoRef.current.play().catch((e) => {
            console.error("Failed to play standby video:", e)
          })
        }
      }

      loadVideo()
    }
  }, [currentProgram, channel.id])

  // Render both videos but control visibility with CSS
  return (
    <div className="w-full aspect-video bg-black relative">
      {/* Main video container - always rendered but may be hidden */}
      <div
        ref={mainContainerRef}
        className={`absolute inset-0 transition-opacity duration-500 ${showStandby ? "opacity-0" : "opacity-100"}`}
        style={{ zIndex: showStandby ? 1 : 2 }}
      >
        <video
          ref={videoRef}
          className="w-full h-full"
          controls
          autoPlay
          onError={handleVideoError}
          onLoadedData={handleVideoLoaded}
          playsInline
        />
      </div>

      {/* Standby video container - always rendered but may be hidden */}
      <div
        ref={standbyContainerRef}
        className={`absolute inset-0 transition-opacity duration-500 ${showStandby ? "opacity-100" : "opacity-0"}`}
        style={{ zIndex: showStandby ? 2 : 1 }}
      >
        {/* Standby content */}
        <div className="absolute inset-0 bg-gradient-to-b from-gray-900 to-black flex flex-col items-center justify-center">
          <div className="text-center max-w-2xl px-4">
            <h2 className="text-3xl font-bold mb-4">
              Channel {channel.id}: {cleanedName}
            </h2>

            <div className="bg-black/40 p-6 rounded-lg mb-8">
              <div className="flex items-center justify-center mb-4">
                <div className="w-16 h-16 rounded-full bg-red-600 flex items-center justify-center">
                  <Play className="h-8 w-8 text-white" />
                </div>
              </div>

              <p className="text-xl mb-4">Content for this channel is currently unavailable.</p>

              <p className="text-gray-400 mb-6">
                We're working on adding videos for this channel. Please check back later or try another channel.
              </p>

              {currentProgram && (
                <div className="mb-6">
                  <h3 className="font-semibold mb-2">Scheduled Program:</h3>
                  <p className="text-white">{currentProgram.title}</p>
                  <p className="text-sm text-gray-400">
                    {new Date(currentProgram.start_time).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                      hour12: true,
                    })}
                  </p>
                </div>
              )}

              <div className="flex justify-center space-x-4">
                <Button onClick={retryPlayback} disabled={isRetrying} className="bg-red-600 hover:bg-red-700">
                  {isRetrying ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      Retrying...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Retry Playback
                    </>
                  )}
                </Button>

                <Button onClick={() => (window.location.href = "/channels")} variant="outline">
                  Browse Channels
                </Button>
              </div>
            </div>

            {upcomingPrograms.length > 0 && (
              <div className="mt-4">
                <h3 className="text-xl font-semibold mb-4">Coming Up Next:</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {upcomingPrograms.slice(0, 4).map((program, index) => (
                    <div key={index} className="bg-gray-800/50 p-3 rounded-lg">
                      <p className="font-medium">{program.title}</p>
                      <p className="text-sm text-gray-400">
                        {new Date(program.start_time).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                          hour12: true,
                        })}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Debug info button */}
        <button
          onClick={() => setShowDebugInfo(!showDebugInfo)}
          className="absolute top-4 right-4 bg-black/70 p-2 rounded-md z-10 text-gray-400 hover:text-white"
          aria-label="Toggle debug info"
        >
          <Info className="h-4 w-4" />
        </button>

        {/* Debug info panel - Focused on Supabase URL troubleshooting */}
        {showDebugInfo && (
          <div className="absolute bottom-4 left-4 right-4 bg-black/80 p-4 rounded-lg z-10 text-xs">
            <h4 className="font-bold mb-2">Supabase Video Debug:</h4>
            {errorDetails && (
              <div className="mb-2">
                <span className="text-red-400">Error: </span>
                <span>{errorDetails}</span>
              </div>
            )}

            <div className="mb-2">
              <span className="text-blue-400">Channel ID: </span>
              <span>{channel.id}</span>
            </div>

            <div className="mb-2">
              <span className="text-blue-400">Supabase URL: </span>
              <span>{supabaseUrl}</span>
            </div>

            {currentProgram && (
              <div className="mb-2">
                <span className="text-blue-400">Program: </span>
                <span>
                  {currentProgram.title} (ID: {currentProgram.id})
                </span>
                <div className="ml-4 mt-1">
                  <span className="text-blue-400">MP4 URL: </span>
                  <span>{currentProgram.mp4_url}</span>
                </div>
              </div>
            )}

            {attemptedUrls.length > 0 && (
              <div>
                <span className="text-blue-400">Attempted Supabase URLs:</span>
                <ul className="ml-4 mt-1">
                  {attemptedUrls.map((url, index) => (
                    <li key={index} className="truncate">
                      {index + 1}. {url}
                      <button onClick={() => window.open(url, "_blank")} className="ml-2 text-blue-400 hover:underline">
                        Test
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {channel.id === "1" && (
              <div className="mb-2 mt-2 pt-2 border-t border-gray-700">
                <span className="text-yellow-400 font-bold">Channel 1 Debug Info: </span>
                <div className="ml-4 mt-1">
                  <button
                    onClick={() => {
                      if (videoRef.current) {
                        console.log("Video element state:", {
                          readyState: videoRef.current.readyState,
                          networkState: videoRef.current.networkState,
                          paused: videoRef.current.paused,
                          currentSrc: videoRef.current.currentSrc,
                          error: videoRef.current.error
                            ? {
                                code: videoRef.current.error.code,
                                message: videoRef.current.error.message,
                              }
                            : null,
                        })
                      }
                    }}
                    className="bg-blue-600 hover:bg-blue-700 text-white text-xs px-2 py-1 rounded"
                  >
                    Log Video State
                  </button>
                  <button
                    onClick={() => {
                      if (videoRef.current) {
                        videoRef.current.load()
                        videoRef.current.play().catch((e) => console.error("Manual play failed:", e))
                      }
                    }}
                    className="bg-green-600 hover:bg-green-700 text-white text-xs px-2 py-1 rounded ml-2"
                  >
                    Force Reload & Play
                  </button>
                </div>
              </div>
            )}
            {channel.id === "6" && (
              <div className="mb-2 mt-2 pt-2 border-t border-gray-700">
                <span className="text-yellow-400 font-bold">Channel 6 Debug Info: </span>
                <div className="ml-4 mt-1">
                  <button
                    onClick={() => {
                      if (videoRef.current) {
                        console.log("Video element state:", {
                          readyState: videoRef.current.readyState,
                          networkState: videoRef.current.networkState,
                          paused: videoRef.current.paused,
                          currentSrc: videoRef.current.currentSrc,
                          error: videoRef.current.error
                            ? {
                                code: videoRef.current.error.code,
                                message: videoRef.current.error.message,
                              }
                            : null,
                        })
                      }
                    }}
                    className="bg-blue-600 hover:bg-blue-700 text-white text-xs px-2 py-1 rounded"
                  >
                    Log Video State
                  </button>
                  <button
                    onClick={() => {
                      if (videoRef.current) {
                        videoRef.current.load()
                        videoRef.current.play().catch((e) => console.error("Manual play failed:", e))
                      }
                    }}
                    className="bg-green-600 hover:bg-green-700 text-white text-xs px-2 py-1 rounded ml-2"
                  >
                    Force Reload & Play
                  </button>
                </div>
              </div>
            )}

            <div className="mt-2 pt-2 border-t border-gray-700 flex gap-2">
              <button
                onClick={retryPlayback}
                className="bg-blue-600 hover:bg-blue-700 text-white text-xs px-2 py-1 rounded"
              >
                Retry All Formats
              </button>
              <button
                onClick={() =>
                  navigator.clipboard.writeText(
                    JSON.stringify(
                      {
                        channel: channel.id,
                        program: currentProgram?.id,
                        url: currentProgram?.mp4_url,
                        attempts: attemptedUrls,
                      },
                      null,
                      2,
                    ),
                  )
                }
                className="bg-gray-600 hover:bg-gray-700 text-white text-xs px-2 py-1 rounded"
              >
                Copy Debug Info
              </button>
              <Link
                href="/debug/video-test"
                className="bg-green-600 hover:bg-green-700 text-white text-xs px-2 py-1 rounded"
              >
                Open URL Tester
              </Link>
            </div>
          </div>
        )}
      </div>

      {/* Channel name overlay - always visible */}
      <div className="absolute top-4 left-4 bg-black/70 px-3 py-1 rounded-md z-10 flex items-center">
        <span className="text-sm font-medium">{cleanedName}</span>
        {isLiveChannel(channel.id) && (
          <span className="ml-2 bg-red-600 text-white text-xs px-1.5 py-0.5 rounded-sm flex items-center">
            <span className="w-2 h-2 bg-white rounded-full mr-1 animate-pulse"></span>
            LIVE
          </span>
        )}
      </div>

      {/* Program info overlay - only visible when showing main video */}
      {currentProgram && !showStandby && (
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4 z-10 pointer-events-none">
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
      )}
    </div>
  )
}
