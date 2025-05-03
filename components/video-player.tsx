"use client"

import type React from "react"
import { useState, useEffect, useRef } from "react"
import {
  getCurrentProgram,
  getUpcomingPrograms,
  calculateProgramProgress,
  isLiveChannel,
  getLiveStreamUrl,
  getDirectDownloadUrl,
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
  const [currentProgram, setCurrentProgram] = useState<Program | null>(initialProgram)
  const [upcomingPrograms, setUpcomingPrograms] = useState<Program[]>(initialUpcoming)
  const [progress, setProgress] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showStandby, setShowStandby] = useState(false)
  const [errorDetails, setErrorDetails] = useState<string | null>(null)
  const [isRetrying, setIsRetrying] = useState(false)
  const [attemptedUrls, setAttemptedUrls] = useState<string[]>([])
  const [showDebugInfo, setShowDebugInfo] = useState(false)
  const [directUrl, setDirectUrl] = useState<string | null>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const standbyVideoRef = useRef<HTMLVideoElement>(null)
  const refreshTimerRef = useRef<NodeJS.Timeout | null>(null)
  const errorTimerRef = useRef<NodeJS.Timeout | null>(null)
  const standbyContainerRef = useRef<HTMLDivElement>(null)
  const mainContainerRef = useRef<HTMLDivElement>(null)
  const loadAttemptRef = useRef(0)
  const maxAttempts = 3

  const cleanedName = cleanChannelName(channel.name)

  // Standby video URL - using a reliable source
  const standbyVideoUrl =
    "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/standby_blacktruthtv-D7yZUERL2zhjE71Llxul69gbPLxGES.mp4"

  // Ensure standby video is always ready
  useEffect(() => {
    if (standbyVideoRef.current) {
      console.log("Initializing standby video")
      standbyVideoRef.current.src = standbyVideoUrl
      standbyVideoRef.current.load()
      standbyVideoRef.current.preload = "auto"
    }
  }, [standbyVideoUrl])

  // Handle video error with improved error reporting
  const handleVideoError = async (e: React.SyntheticEvent<HTMLVideoElement, Event>) => {
    const target = e.target as HTMLVideoElement
    let errorMessage = "Unknown error"

    console.log(`Video error for channel ${channel.id}, currentProgram:`, currentProgram)

    if (target.error) {
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

    console.error("Error loading video:", errorMessage)
    console.error("Failed URL:", target.src)

    // Store error details for display
    setErrorDetails(`${errorMessage} (URL: ${target.src.split("/").slice(-2).join("/")}...)`)

    // Try to get a direct download URL as a last resort
    if (currentProgram && loadAttemptRef.current < maxAttempts) {
      loadAttemptRef.current += 1
      console.log(`Attempt ${loadAttemptRef.current}: Getting direct download URL for ${currentProgram.mp4_url}`)

      try {
        const url = await getDirectDownloadUrl(currentProgram.mp4_url, channel.id)
        if (url && videoRef.current) {
          console.log(`Found direct URL: ${url}`)
          setDirectUrl(url)
          setAttemptedUrls((prev) => [...prev, url])

          // Add cache-busting parameter
          const urlWithCacheBust = `${url}?t=${Date.now()}`

          videoRef.current.src = urlWithCacheBust
          videoRef.current.load()
          return
        }
      } catch (err) {
        console.error("Error getting direct URL:", err)
      }
    }

    // If we've tried enough times or couldn't get a direct URL, show standby
    if (loadAttemptRef.current >= maxAttempts) {
      console.log("Maximum attempts reached, showing standby")
      setShowStandby(true)

      // Make sure standby video is playing
      if (standbyVideoRef.current) {
        standbyVideoRef.current.play().catch((e) => {
          console.error("Failed to play standby video:", e)
        })
      }
    }
  }

  // Function to retry playing the current video
  const retryPlayback = async () => {
    if (!currentProgram) return

    setIsRetrying(true)
    setErrorDetails(null)
    loadAttemptRef.current = 0
    setAttemptedUrls([])

    try {
      // Try to get a direct download URL
      const url = await getDirectDownloadUrl(currentProgram.mp4_url, channel.id)

      if (url && videoRef.current) {
        console.log(`Retrying with direct URL: ${url}`)
        setDirectUrl(url)
        setAttemptedUrls([url])

        // Add cache-busting parameter
        const urlWithCacheBust = `${url}?t=${Date.now()}`

        videoRef.current.src = urlWithCacheBust
        videoRef.current.load()
        setShowStandby(false)
      } else {
        console.error("Could not find a working URL")
        setErrorDetails("Could not find a working URL for this video")
        setShowStandby(true)
      }
    } catch (err) {
      console.error("Error in retry:", err)
      setErrorDetails(`Retry failed: ${err instanceof Error ? err.message : String(err)}`)
      setShowStandby(true)
    } finally {
      setIsRetrying(false)
    }
  }

  // Update the refreshCurrentProgram function to handle errors better and provide fallbacks
  const refreshCurrentProgram = async () => {
    setIsLoading(true)
    setError(null)

    try {
      const { program } = await getCurrentProgram(channel.id)
      const { programs } = await getUpcomingPrograms(channel.id)

      setCurrentProgram(program)
      setUpcomingPrograms(programs)

      // If no program exists, show standby
      if (!program) {
        console.log(`No program found for channel ${channel.id}, showing standby video immediately`)
        setShowStandby(true)

        if (standbyVideoRef.current) {
          standbyVideoRef.current.play().catch((e) => {
            console.error("Failed to play standby video:", e)
          })
        }

        setIsLoading(false)
        return
      }

      // If this is a live channel, try to use the live stream
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

      // For regular channels, try to get a direct download URL
      if (program && videoRef.current) {
        loadAttemptRef.current = 0
        setAttemptedUrls([])

        try {
          // First, try to get a direct URL
          const url = await getDirectDownloadUrl(program.mp4_url, channel.id)

          if (url) {
            console.log(`Found direct URL: ${url}`)
            setDirectUrl(url)
            setAttemptedUrls([url])

            // Add cache-busting parameter
            const urlWithCacheBust = `${url}?t=${Date.now()}`

            videoRef.current.src = urlWithCacheBust
            videoRef.current.load()
            setShowStandby(false)
          } else {
            // If we couldn't get a direct URL, try using the raw mp4_url as a fallback
            console.log(`No direct URL found, trying raw mp4_url as fallback: ${program.mp4_url}`)

            // Check if mp4_url is a valid URL or path
            if (program.mp4_url && (program.mp4_url.startsWith("http") || program.mp4_url.includes("/"))) {
              setDirectUrl(program.mp4_url)
              setAttemptedUrls([program.mp4_url])

              // Add cache-busting parameter if it's a URL
              const urlWithCacheBust = program.mp4_url.startsWith("http")
                ? `${program.mp4_url}?t=${Date.now()}`
                : program.mp4_url

              videoRef.current.src = urlWithCacheBust
              videoRef.current.load()
              setShowStandby(false)
            } else {
              console.error("Could not find a working URL and mp4_url is not usable")
              setErrorDetails("Could not find a working URL for this video")
              setShowStandby(true)

              if (standbyVideoRef.current) {
                standbyVideoRef.current.play().catch((e) => {
                  console.error("Failed to play standby video:", e)
                })
              }
            }
          }
        } catch (err) {
          console.error("Error getting direct URL:", err)

          // Try using the raw mp4_url as a last resort
          if (program.mp4_url && videoRef.current) {
            console.log(`Error getting direct URL, trying raw mp4_url as last resort: ${program.mp4_url}`)
            videoRef.current.src = program.mp4_url
            videoRef.current.load()
          } else {
            setShowStandby(true)

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
    console.log("Video loaded successfully")
    setShowStandby(false)
  }

  // Update the loadInitialProgram logic in the useEffect
  // Effect to handle initial setup and periodic refresh
  useEffect(() => {
    // Initial setup
    if (!currentProgram) {
      console.log(`No initial program for channel ${channel.id}, refreshing...`)
      refreshCurrentProgram()
    } else {
      // If we have an initial program, try to load it
      const loadInitialProgram = async () => {
        if (videoRef.current) {
          loadAttemptRef.current = 0
          setAttemptedUrls([])

          try {
            // First try to get a direct URL
            const url = await getDirectDownloadUrl(currentProgram.mp4_url, channel.id)

            if (url) {
              console.log(`Found direct URL for initial program: ${url}`)
              setDirectUrl(url)
              setAttemptedUrls([url])

              // Add cache-busting parameter
              const urlWithCacheBust = `${url}?t=${Date.now()}`

              videoRef.current.src = urlWithCacheBust
              videoRef.current.load()
              setShowStandby(false)
            } else {
              // If we couldn't get a direct URL, try using the raw mp4_url as a fallback
              console.log(`No direct URL found for initial program, trying raw mp4_url: ${currentProgram.mp4_url}`)

              // Check if mp4_url is a valid URL or path
              if (
                currentProgram.mp4_url &&
                (currentProgram.mp4_url.startsWith("http") || currentProgram.mp4_url.includes("/"))
              ) {
                setDirectUrl(currentProgram.mp4_url)
                setAttemptedUrls([currentProgram.mp4_url])

                videoRef.current.src = currentProgram.mp4_url
                videoRef.current.load()
                setShowStandby(false)
              } else {
                console.error("Could not find a working URL for initial program and mp4_url is not usable")
                setErrorDetails("Could not find a working URL for this video")
                setShowStandby(true)

                if (standbyVideoRef.current) {
                  standbyVideoRef.current.play().catch((e) => {
                    console.error("Failed to play standby video:", e)
                  })
                }
              }
            }
          } catch (err) {
            console.error("Error getting direct URL for initial program:", err)

            // Try using the raw mp4_url as a last resort
            if (currentProgram.mp4_url && videoRef.current) {
              console.log(
                `Error getting direct URL for initial program, trying raw mp4_url as last resort: ${currentProgram.mp4_url}`,
              )
              videoRef.current.src = currentProgram.mp4_url
              videoRef.current.load()
            } else {
              setShowStandby(true)

              if (standbyVideoRef.current) {
                standbyVideoRef.current.play().catch((e) => {
                  console.error("Failed to play standby video:", e)
                })
              }
            }
          }
        }
      }

      loadInitialProgram()
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
      loadAttemptRef.current = 0
      setAttemptedUrls([])
      setErrorDetails(null)

      const loadProgram = async () => {
        try {
          const url = await getDirectDownloadUrl(currentProgram.mp4_url, channel.id)

          if (url) {
            console.log(`Found direct URL for program: ${url}`)
            setDirectUrl(url)
            setAttemptedUrls([url])

            // Add cache-busting parameter
            const urlWithCacheBust = `${url}?t=${Date.now()}`

            videoRef.current!.src = urlWithCacheBust
            videoRef.current!.load()
            setShowStandby(false)
          } else {
            console.error("Could not find a working URL for program")
            setErrorDetails("Could not find a working URL for this video")
            setShowStandby(true)

            if (standbyVideoRef.current) {
              standbyVideoRef.current.play().catch((e) => {
                console.error("Failed to play standby video:", e)
              })
            }
          }
        } catch (err) {
          console.error("Error getting direct URL for program:", err)
          setShowStandby(true)

          if (standbyVideoRef.current) {
            standbyVideoRef.current.play().catch((e) => {
              console.error("Failed to play standby video:", e)
            })
          }
        }
      }

      loadProgram()
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
        {currentProgram && (
          <video
            ref={videoRef}
            autoPlay
            controls
            onError={handleVideoError}
            onLoadedData={handleVideoLoaded}
            className="w-full h-full"
          />
        )}
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

        {/* Update the debug info panel to show more details */}
        {showDebugInfo && (
          <div className="absolute bottom-4 left-4 right-4 bg-black/80 p-4 rounded-lg z-10 text-xs overflow-auto max-h-[50vh]">
            <h4 className="font-bold mb-2">Video Debug Info:</h4>
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

            {currentProgram && (
              <div className="mb-2">
                <span className="text-blue-400">Program: </span>
                <span>
                  {currentProgram.title} (ID: {currentProgram.id})
                </span>
                <div className="ml-4 mt-1">
                  <span className="text-blue-400">MP4 URL from DB: </span>
                  <span className="break-all">{currentProgram.mp4_url}</span>
                  <button
                    onClick={() => window.open(currentProgram.mp4_url, "_blank")}
                    className="ml-2 text-blue-400 hover:underline"
                  >
                    Test
                  </button>
                </div>
                {directUrl && (
                  <div className="ml-4 mt-1">
                    <span className="text-green-400">Direct URL: </span>
                    <span className="break-all">{directUrl}</span>
                    <button
                      onClick={() => window.open(directUrl, "_blank")}
                      className="ml-2 text-green-400 hover:underline"
                    >
                      Test
                    </button>
                  </div>
                )}
              </div>
            )}

            {attemptedUrls.length > 0 && (
              <div>
                <span className="text-blue-400">Attempted URLs:</span>
                <ul className="ml-4 mt-1">
                  {attemptedUrls.map((url, index) => (
                    <li key={index} className="break-all">
                      {index + 1}. {url}
                      <button onClick={() => window.open(url, "_blank")} className="ml-2 text-blue-400 hover:underline">
                        Test
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="mt-2 pt-2 border-t border-gray-700 flex gap-2 flex-wrap">
              <button
                onClick={retryPlayback}
                className="bg-blue-600 hover:bg-blue-700 text-white text-xs px-2 py-1 rounded"
              >
                Retry Playback
              </button>
              <button
                onClick={() => refreshCurrentProgram()}
                className="bg-green-600 hover:bg-green-700 text-white text-xs px-2 py-1 rounded"
              >
                Refresh Program
              </button>
              <button
                onClick={() =>
                  navigator.clipboard.writeText(
                    JSON.stringify(
                      {
                        channel: channel.id,
                        program: currentProgram?.id,
                        url: currentProgram?.mp4_url,
                        directUrl: directUrl,
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
