"use client"

import type React from "react"
import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { Loader2, Play, Pause, Volume2, VolumeX, Maximize, ChevronLeft, AlertTriangle, RefreshCw } from "lucide-react"
import {
  getLiveStreamUrl,
  getDirectDownloadUrl,
  calculateProgramProgress,
  saveWatchProgress,
  getWatchProgress,
  getCurrentProgram,
  getUpcomingPrograms,
  isLiveChannel,
} from "@/lib/supabase"
import type { Channel, Program } from "@/types"
import { cleanChannelName } from "@/lib/utils"

interface VideoPlayerProps {
  channel: Channel
  initialProgram: Program | null
  upcomingPrograms: Program[]
}

export function VideoPlayer({ channel, initialProgram, upcomingPrograms: initialUpcoming }: VideoPlayerProps) {
  const router = useRouter()
  const [isPlaying, setIsPlaying] = useState(false)
  const [isMuted, setIsMuted] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [currentProgram, setCurrentProgram] = useState<Program | null>(initialProgram)
  const [upcomingPrograms, setUpcomingPrograms] = useState<Program[]>(initialUpcoming)
  const [videoUrl, setVideoUrl] = useState<string | null>(null)
  const [progress, setProgress] = useState(0)
  const [progressPercent, setProgressPercent] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [showStandby, setShowStandby] = useState(false)
  const [errorDetails, setErrorDetails] = useState<string | null>(null)
  const [isRetrying, setIsRetrying] = useState(false)
  const [attemptedUrls, setAttemptedUrls] = useState<string[]>([])
  const [showDebugInfo, setShowDebugInfo] = useState(false)
  const [directUrl, setDirectUrl] = useState<string | null>(null)
  const [lastRefreshTime, setLastRefreshTime] = useState<number>(Date.now())
  const [playbackStartTime, setPlaybackStartTime] = useState<number | null>(null)
  const [isLive, setIsLive] = useState(false)
  const [volume, setVolume] = useState(1)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [showControls, setShowControls] = useState(true)
  const [controlsTimeout, setControlsTimeout] = useState<NodeJS.Timeout | null>(null)
  const [playbackRate, setPlaybackRate] = useState(1)
  const [isFavorite, setIsFavorite] = useState(false)
  const [showChannelSwitcher, setShowChannelSwitcher] = useState(false)
  const [sleepTimerMinutes, setSleepTimerMinutes] = useState<number | null>(null)
  const [sleepTimerEnd, setSleepTimerEnd] = useState<Date | null>(null)
  const [showShareOptions, setShowShareOptions] = useState(false)
  const [showTooltips, setShowTooltips] = useState(true)
  const [keyboardShortcutsEnabled, setKeyboardShortcutsEnabled] = useState(true)
  const [loadTimeout, setLoadTimeout] = useState<NodeJS.Timeout | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [savedProgress, setSavedProgress] = useState<number | null>(null)
  const [fallbackMode, setFallbackMode] = useState(false)
  const [retryCount, setRetryCount] = useState(0)
  const [scheduledProgramId, setScheduledProgramId] = useState<number | null>(initialProgram?.id || null)
  const [lastProgramCheck, setLastProgramCheck] = useState<number>(Date.now())
  const [programSwitchInProgress, setProgramSwitchInProgress] = useState(false)
  const [videoFormat, setVideoFormat] = useState<string | null>(null)
  const [formatFallbackAttempted, setFormatFallbackAttempted] = useState(false)

  const videoRef = useRef<HTMLVideoElement>(null)
  const standbyVideoRef = useRef<HTMLVideoElement>(null)
  const refreshTimerRef = useRef<NodeJS.Timeout | null>(null)
  const errorTimerRef = useRef<NodeJS.Timeout | null>(null)
  const standbyContainerRef = useRef<HTMLDivElement>(null)
  const mainContainerRef = useRef<HTMLDivElement>(null)
  const videoContainerRef = useRef<HTMLDivElement>(null)
  const loadAttemptRef = useRef(0)
  const programChangeTimeRef = useRef<number | null>(null)
  const sleepTimerRef = useRef<NodeJS.Timeout | null>(null)
  const maxAttempts = 3
  const [videoMetadata, setVideoMetadata] = useState<{ duration: number; loaded: boolean }>({
    duration: 0,
    loaded: false,
  })
  const [lastPlaybackTime, setLastPlaybackTime] = useState<number>(0)
  const playbackCheckRef = useRef<NodeJS.Timeout | null>(null)
  const progressSaveIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const lastPlaybackTimeRef = useRef<number>(0)
  const stallDetectionRef = useRef<NodeJS.Timeout | null>(null)
  const retryCountRef = useRef<number>(0)
  const maxRetries = 5
  const programCheckIntervalRef = useRef<NodeJS.Timeout | null>(null)

  // Track if component is mounted to prevent state updates after unmount
  const isMountedRef = useRef(true)

  // Track the last time we saved progress
  const lastProgressSaveRef = useRef<number>(0)

  // Track if we're currently in a retry loop
  const isRetryingRef = useRef(false)

  const cleanedName = cleanChannelName(channel.name)

  // Standby video URL - using a reliable source
  const standbyVideoUrl =
    "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/standby_blacktruthtv-D7yZUERL2zhjE71Llxul69gbPLxGES.mp4"

  // Fallback video URLs for testing
  const fallbackVideoUrls = [
    "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8", // HLS stream
    "https://storage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4", // MP4 video
    "https://storage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4", // Another MP4 video
  ]

  // Add this function near the top of the component, with the other utility functions
  const shouldDisableAutoRefresh = (duration: number): boolean => {
    // We no longer disable auto refresh completely, but we'll use this to determine
    // how frequently to check for program changes
    return duration > 300
  }

  // Helper function to detect video format from URL
  const detectVideoFormat = (url: string): string => {
    if (!url) return "unknown"

    const lowerUrl = url.toLowerCase()

    if (lowerUrl.includes(".m3u8")) return "hls"
    if (lowerUrl.includes(".mpd")) return "dash"
    if (lowerUrl.includes(".mp4")) return "mp4"
    if (lowerUrl.includes(".webm")) return "webm"
    if (lowerUrl.includes(".mov")) return "mov"
    if (lowerUrl.includes(".avi")) return "avi"
    if (lowerUrl.includes(".mkv")) return "mkv"
    if (lowerUrl.includes(".flv")) return "flv"

    // Try to guess from path components
    if (lowerUrl.includes("/hls/")) return "hls"
    if (lowerUrl.includes("/dash/")) return "dash"

    return "unknown"
  }

  // Helper function to get MIME type from URL
  const getMimeType = (url: string): string => {
    const format = detectVideoFormat(url)

    switch (format) {
      case "hls":
        return "application/vnd.apple.mpegurl"
      case "dash":
        return "application/dash+xml"
      case "mp4":
        return "video/mp4"
      case "webm":
        return "video/webm"
      case "mov":
        return "video/quicktime"
      case "avi":
        return "video/x-msvideo"
      case "mkv":
        return "video/x-matroska"
      case "flv":
        return "video/x-flv"
      default:
        return "video/mp4" // Default to mp4 as a safe choice
    }
  }

  // Helper function to try alternative format for the same video
  const tryAlternativeFormat = async (originalUrl: string): Promise<string | null> => {
    if (!originalUrl) return null

    // If it's an m3u8 file, try mp4 instead
    if (originalUrl.includes(".m3u8")) {
      return originalUrl.replace(".m3u8", ".mp4")
    }

    // If it's an mp4 file, try m3u8 instead
    if (originalUrl.includes(".mp4")) {
      return originalUrl.replace(".mp4", ".m3u8")
    }

    // Try adding or removing trailing slash
    if (originalUrl.endsWith("/")) {
      return originalUrl.slice(0, -1)
    } else {
      return `${originalUrl}/`
    }
  }

  // Check if channel is in favorites
  useEffect(() => {
    const checkFavorite = () => {
      const favorites = JSON.parse(localStorage.getItem("favoriteChannels") || "[]")
      setIsFavorite(favorites.includes(channel.id))
    }

    checkFavorite()
  }, [channel.id])

  // Toggle favorite status
  const toggleFavorite = () => {
    const favorites = JSON.parse(localStorage.getItem("favoriteChannels") || "[]")

    if (isFavorite) {
      const newFavorites = favorites.filter((id: string) => id !== channel.id)
      localStorage.setItem("favoriteChannels", JSON.stringify(newFavorites))
    } else {
      favorites.push(channel.id)
      localStorage.setItem("favoriteChannels", JSON.stringify(favorites))
    }

    setIsFavorite(!isFavorite)
  }

  // Set up sleep timer
  const startSleepTimer = (minutes: number) => {
    if (sleepTimerRef.current) {
      clearTimeout(sleepTimerRef.current)
    }

    setSleepTimerMinutes(minutes)
    const endTime = new Date(Date.now() + minutes * 60000)
    setSleepTimerEnd(endTime)

    sleepTimerRef.current = setTimeout(() => {
      if (videoRef.current) {
        videoRef.current.pause()
        setIsPlaying(false)
      }
      setSleepTimerMinutes(null)
      setSleepTimerEnd(null)
    }, minutes * 60000)
  }

  // Cancel sleep timer
  const cancelSleepTimer = () => {
    if (sleepTimerRef.current) {
      clearTimeout(sleepTimerRef.current)
    }
    setSleepTimerMinutes(null)
    setSleepTimerEnd(null)
  }

  // Format remaining sleep time
  const formatSleepTimeRemaining = (): string => {
    if (!sleepTimerEnd) return ""

    const now = new Date()
    const diffMs = sleepTimerEnd.getTime() - now.getTime()
    if (diffMs <= 0) return "0:00"

    const minutes = Math.floor(diffMs / 60000)
    const seconds = Math.floor((diffMs % 60000) / 1000)
    return `${minutes}:${seconds.toString().padStart(2, "0")}`
  }

  // Share functionality
  const shareChannel = () => {
    if (navigator.share) {
      navigator
        .share({
          title: `Watch ${cleanedName}`,
          text: `I'm watching ${currentProgram?.title || cleanedName}`,
          url: window.location.href,
        })
        .catch((err) => console.error("Error sharing:", err))
    } else {
      // Fallback for browsers that don't support Web Share API
      navigator.clipboard
        .writeText(window.location.href)
        .then(() => alert("Link copied to clipboard!"))
        .catch((err) => console.error("Error copying link:", err))
    }
    setShowShareOptions(false)
  }

  // Ensure standby video is always ready
  useEffect(() => {
    if (standbyVideoRef.current) {
      console.log("Initializing standby video")
      standbyVideoRef.current.src = standbyVideoUrl
      standbyVideoRef.current.load()
      standbyVideoRef.current.preload = "auto"
    }
  }, [standbyVideoUrl])

  // Save watch progress periodically
  useEffect(() => {
    if (!currentProgram) return

    // Try to restore previous watch position
    const loadSavedProgress = async () => {
      if (videoRef.current && currentProgram) {
        try {
          const savedProgressValue = await getWatchProgress(currentProgram.id)
          if (
            savedProgressValue &&
            savedProgressValue > 10 &&
            videoRef.current.duration &&
            savedProgressValue < videoRef.current.duration - 30
          ) {
            // Only restore if we have a meaningful position (not at the very beginning or end)
            videoRef.current.currentTime = savedProgressValue
            setSavedProgress(savedProgressValue)
            console.log(`Restored watch progress: ${savedProgressValue}s`)
          }
        } catch (err) {
          console.error("Error loading saved progress:", err)
        }
      }
    }

    loadSavedProgress()

    // Set up interval to save progress
    progressSaveIntervalRef.current = setInterval(() => {
      if (videoRef.current && currentProgram && videoRef.current.currentTime > 0) {
        saveWatchProgress(currentProgram.id, videoRef.current.currentTime).catch((err) =>
          console.error("Error saving watch progress:", err),
        )
      }
    }, 10000) // Save every 10 seconds

    return () => {
      if (progressSaveIntervalRef.current) {
        clearInterval(progressSaveIntervalRef.current)
      }
    }
  }, [currentProgram])

  // Prevent context menu on video (right-click)
  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault()
    return false
  }

  // Handle mouse movement to show/hide controls
  const handleMouseMove = () => {
    setShowControls(true)

    // Clear any existing timeout
    if (controlsTimeout) {
      clearTimeout(controlsTimeout)
    }

    // Set a new timeout to hide controls after 3 seconds of inactivity
    const timeout = setTimeout(() => {
      if (isPlaying) {
        setShowControls(false)
      }
    }, 3000)

    setControlsTimeout(timeout)
  }

  // Clean up the timeout when component unmounts
  useEffect(() => {
    return () => {
      if (controlsTimeout) {
        clearTimeout(controlsTimeout)
      }
    }
  }, [controlsTimeout])

  // Toggle play/pause
  const togglePlay = () => {
    if (!videoRef.current) return

    if (videoRef.current.paused) {
      videoRef.current.play().catch((err) => {
        console.error("Error playing video:", err)
        setLoadError(`Error playing video: ${err.message || "Unknown error"}`)
      })
      setIsPlaying(true)
    } else {
      videoRef.current.pause()
      setIsPlaying(false)
    }
  }

  // Toggle mute
  const toggleMute = () => {
    if (!videoRef.current) return

    const newMutedState = !videoRef.current.muted
    videoRef.current.muted = newMutedState
    setIsMuted(newMutedState)
  }

  // Handle volume change
  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!videoRef.current) return

    const newVolume = Number.parseFloat(e.target.value)
    videoRef.current.volume = newVolume
    setVolume(newVolume)

    if (newVolume === 0) {
      videoRef.current.muted = true
      setIsMuted(true)
    } else if (isMuted) {
      videoRef.current.muted = false
      setIsMuted(false)
    }
  }

  // Toggle fullscreen
  const toggleFullscreen = () => {
    if (!videoContainerRef.current) return

    if (!document.fullscreenElement) {
      videoContainerRef.current.requestFullscreen().catch((err) => {
        console.error(`Error attempting to enable fullscreen: ${err.message}`)
      })
    } else {
      document.exitFullscreen()
    }
  }

  // Toggle Picture-in-Picture
  const togglePictureInPicture = async () => {
    if (!videoRef.current) return

    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture()
      } else {
        await videoRef.current.requestPictureInPicture()
      }
    } catch (err) {
      console.error("Error toggling picture-in-picture:", err)
    }
  }

  // Change playback speed
  const changePlaybackSpeed = (rate: number) => {
    if (!videoRef.current) return

    videoRef.current.playbackRate = rate
    setPlaybackRate(rate)
  }

  // Skip forward/backward
  const skipTime = (seconds: number) => {
    if (!videoRef.current) return

    const newTime = videoRef.current.currentTime + seconds
    videoRef.current.currentTime = Math.max(0, Math.min(newTime, videoRef.current.duration))
  }

  // Update fullscreen state when it changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement)
    }

    document.addEventListener("fullscreenchange", handleFullscreenChange)
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange)
    }
  }, [])

  // Handle keyboard shortcuts
  useEffect(() => {
    if (!keyboardShortcutsEnabled) return

    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger shortcuts if user is typing in an input field
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return

      if (!videoRef.current || showStandby) return

      switch (e.key.toLowerCase()) {
        case " ":
        case "k":
          e.preventDefault()
          togglePlay()
          break
        case "m":
          e.preventDefault()
          toggleMute()
          break
        case "f":
          e.preventDefault()
          toggleFullscreen()
          break
        case "p":
          e.preventDefault()
          togglePictureInPicture()
          break
        case "arrowleft":
          e.preventDefault()
          skipTime(-10)
          break
        case "arrowright":
          e.preventDefault()
          skipTime(10)
          break
        case "arrowup":
          e.preventDefault()
          if (videoRef.current.volume < 0.9) {
            videoRef.current.volume += 0.1
            setVolume(videoRef.current.volume)
          }
          break
        case "arrowdown":
          e.preventDefault()
          if (videoRef.current.volume > 0.1) {
            videoRef.current.volume -= 0.1
            setVolume(videoRef.current.volume)
          }
          break
        case "0":
        case "1":
        case "2":
        case "3":
        case "4":
        case "5":
        case "6":
        case "7":
        case "8":
        case "9":
          // Jump to percentage of video
          const percent = Number.parseInt(e.key) * 10
          if (videoRef.current.duration) {
            videoRef.current.currentTime = (percent / 100) * videoRef.current.duration
          }
          break
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => {
      window.removeEventListener("keydown", handleKeyDown)
    }
  }, [showStandby, keyboardShortcutsEnabled])

  // Handle seeking
  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!videoRef.current || !videoMetadata.loaded) return

    const seekTime = (Number.parseFloat(e.target.value) / 100) * videoMetadata.duration
    videoRef.current.currentTime = seekTime
  }

  // Handle video error with improved error reporting
  const handleVideoError = async (e: React.SyntheticEvent<HTMLVideoElement, Event>) => {
    const target = e.target as HTMLVideoElement
    let errorMessage = "Unknown error"

    console.log(`Video error for channel ${channel.id}, currentProgram:`, currentProgram)

    if (target.error) {
      switch (target.error.code) {
        case MediaError.MEDIA_ERR_ABORTED:
          errorMessage = "The fetching process was aborted by the user"
          break
        case MediaError.MEDIA_ERR_NETWORK:
          errorMessage = "Network error - video download failed"
          break
        case MediaError.MEDIA_ERR_DECODE:
          errorMessage = "Video decoding failed - format may be unsupported"
          break
        case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED:
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
    if (target.src) {
      console.error("Failed URL:", target.src)
    }

    // Store error details for display
    setErrorDetails(errorMessage)

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

  // New function to check if the scheduled program has changed
  const checkProgramSchedule = async () => {
    if (programSwitchInProgress) {
      console.log("Program switch already in progress, skipping check")
      return
    }

    try {
      const now = Date.now()
      const timeSinceLastCheck = now - lastProgramCheck

      // Only check every 30 seconds to avoid too many API calls
      if (timeSinceLastCheck < 30000) {
        return
      }

      setLastProgramCheck(now)

      const { program } = await getCurrentProgram(channel.id)

      if (!program) {
        console.log("No program found in schedule check")
        return
      }

      // If the scheduled program has changed
      if (program.id !== scheduledProgramId) {
        console.log(`Schedule change detected: Current ID=${scheduledProgramId}, New ID=${program.id}`)
        console.log(`Current program: ${currentProgram?.title}, New program: ${program.title}`)

        // Save current playback position before switching
        if (currentProgram && videoRef.current) {
          await saveWatchProgress(currentProgram.id, videoRef.current.currentTime)
        }

        // Update the scheduled program ID
        setScheduledProgramId(program.id)

        // Switch to the new program
        setProgramSwitchInProgress(true)
        await switchToProgram(program)
        setProgramSwitchInProgress(false)
      }
    } catch (error) {
      console.error("Error checking program schedule:", error)
    }
  }

  // New function to switch to a specific program
  const switchToProgram = async (program: Program) => {
    console.log(`Switching to program: ${program.title} (ID: ${program.id})`)

    if (!videoRef.current) return

    setIsLoading(true)
    setCurrentProgram(program)
    setFormatFallbackAttempted(false)

    try {
      const url = await getDirectDownloadUrl(program.mp4_url, channel.id)

      if (url) {
        console.log(`Found direct URL for new program: ${url}`)
        setDirectUrl(url)

        // Detect video format
        const format = detectVideoFormat(url)
        setVideoFormat(format)
        console.log(`Detected video format: ${format}`)

        // Add cache-busting parameter
        const urlWithCacheBust = `${url}?t=${Date.now()}`

        // Update video source and load the new video
        videoRef.current.src = urlWithCacheBust
        videoRef.current.load()
        setVideoUrl(urlWithCacheBust)
        setShowStandby(false)

        // Auto-play the new program
        try {
          await videoRef.current.play()
          setIsPlaying(true)
        } catch (playError) {
          console.error("Error auto-playing new program:", playError)
          // Don't throw an error here, just log it and continue
        }
      } else {
        console.error("Could not find a working URL for new program")
        setErrorDetails("Could not find a working URL for this video")
        setShowStandby(true)

        // Try to play standby video
        if (standbyVideoRef.current) {
          standbyVideoRef.current.play().catch((e) => {
            console.error("Failed to play standby video:", e)
          })
        }
      }
    } catch (error) {
      console.error("Error switching to new program:", error)
      setShowStandby(true)

      // Try to play standby video
      if (standbyVideoRef.current) {
        standbyVideoRef.current.play().catch((e) => {
          console.error("Failed to play standby video:", e)
        })
      }
    } finally {
      setIsLoading(false)
    }
  }

  // Update the refreshCurrentProgram function to handle errors better and provide fallbacks
  const refreshCurrentProgram = async (forceRefresh = false) => {
    const now = Date.now()
    const timeSinceLastRefresh = now - lastRefreshTime

    // If a refresh was recently performed, don't do it again
    if (!forceRefresh && timeSinceLastRefresh < 10000) {
      console.log("Skipping refresh - too soon since last refresh")
      return
    }

    setIsLoading(true)
    setError(null)
    setLastRefreshTime(now)

    try {
      const { program } = await getCurrentProgram(channel.id)
      const { programs } = await getUpcomingPrograms(channel.id)

      // Update the scheduled program ID
      if (program) {
        setScheduledProgramId(program.id)
      }

      // Only update the current program if it's different or this is a forced refresh
      if (forceRefresh || program?.id !== currentProgram?.id) {
        console.log(`Program change: ${currentProgram?.title} -> ${program?.title}`)
        setCurrentProgram(program)
        programChangeTimeRef.current = now
      }

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
        setFormatFallbackAttempted(false)

        try {
          // First, try to get a direct URL
          const url = await getDirectDownloadUrl(program.mp4_url, channel.id)

          if (url) {
            console.log(`Found direct URL: ${url}`)
            setDirectUrl(url)
            setAttemptedUrls([url])

            // Detect video format
            const format = detectVideoFormat(url)
            setVideoFormat(format)
            console.log(`Detected video format: ${format}`)

            // Add cache-busting parameter
            const urlWithCacheBust = `${url}?t=${Date.now()}`

            videoRef.current.src = urlWithCacheBust
            videoRef.current.load()
            setShowStandby(false)
            setVideoUrl(urlWithCacheBust)
          } else {
            // If we couldn't get a direct URL, try using the raw mp4_url as a fallback
            console.log(`No direct URL found, trying raw mp4_url as fallback: ${program.mp4_url}`)

            // Check if mp4_url is a valid URL or path
            if (program.mp4_url && (program.mp4_url.startsWith("http") || program.mp4_url.includes("/"))) {
              setDirectUrl(program.mp4_url)
              setAttemptedUrls([program.mp4_url])

              // Detect video format
              const format = detectVideoFormat(program.mp4_url)
              setVideoFormat(format)
              console.log(`Detected video format: ${format}`)

              // Add cache-busting parameter if it's a URL
              const urlWithCacheBust = program.mp4_url.startsWith("http")
                ? `${program.mp4_url}?t=${Date.now()}`
                : program.mp4_url

              videoRef.current.src = urlWithCacheBust
              videoRef.current.load()
              setShowStandby(false)
              setVideoUrl(urlWithCacheBust)
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
            setShowStandby(false)
            setVideoUrl(program.mp4_url)
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
    setPlaybackStartTime(Date.now())
    setShowStandby(false)
  }

  const handleVideoStarted = () => {
    console.log("Video started playback")
    setPlaybackStartTime(Date.now())
    setIsPlaying(true)
  }

  const handleVideoPaused = () => {
    setIsPlaying(false)
    setShowControls(true) // Always show controls when paused
  }

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      const currentTime = videoRef.current.currentTime
      const duration = videoRef.current.duration

      // Update progress percentage for the progress bar
      if (duration) {
        const newProgress = (currentTime / duration) * 100
        setProgress(newProgress)
        setProgressPercent(newProgress)
      }

      // Only update if time has actually advanced (prevents false stall detection)
      if (currentTime > lastPlaybackTime) {
        setLastPlaybackTime(currentTime)
      }
    }
  }

  // Find the handleMetadataLoaded function and replace the playback monitoring part with this:
  const handleMetadataLoaded = () => {
    if (videoRef.current) {
      console.log(`Video metadata loaded. Duration: ${videoRef.current.duration}s`)
      setVideoMetadata({
        duration: videoRef.current.duration,
        loaded: true,
      })

      // Set up playback monitoring to detect stalls, but with less aggressive checking
      if (playbackCheckRef.current) {
        clearInterval(playbackCheckRef.current)
      }

      playbackCheckRef.current = setInterval(() => {
        if (videoRef.current && !videoRef.current.paused) {
          const currentTime = videoRef.current.currentTime
          // Only consider it stalled if it hasn't moved for 20 seconds (increased from 10)
          // and we're not at the end of the video
          if (currentTime === lastPlaybackTime && currentTime < videoRef.current.duration - 10) {
            console.log("Playback appears stalled, attempting to resume")
            // Try to nudge playback forward
            videoRef.current.currentTime += 0.1
            videoRef.current.play().catch((e) => {
              console.error("Failed to resume stalled playback:", e)
            })
          }
        }
      }, 20000) // Check every 20 seconds (increased from 10 seconds)
    }
  }

  // Handle video end event - load next program if available
  const handleVideoEnded = () => {
    console.log("Video ended, checking for next program")
    setIsPlaying(false)
    // Force refresh to get the next program
    refreshCurrentProgram(true)
  }

  // Format time for display (MM:SS)
  const formatTime = (timeInSeconds: number): string => {
    const minutes = Math.floor(timeInSeconds / 60)
    const seconds = Math.floor(timeInSeconds % 60)
    return `${minutes}:${seconds < 10 ? "0" : ""}${seconds}`
  }

  // Try alternative format when a format error occurs
  const tryFormatFallback = async () => {
    if (!videoUrl || !videoRef.current || formatFallbackAttempted) return false

    setFormatFallbackAttempted(true)
    console.log("Trying format fallback for video URL:", videoUrl)

    try {
      const alternativeUrl = await tryAlternativeFormat(videoUrl)
      if (alternativeUrl) {
        console.log("Found alternative format URL:", alternativeUrl)

        // Detect video format
        const format = detectVideoFormat(alternativeUrl)
        setVideoFormat(format)
        console.log(`Detected alternative video format: ${format}`)

        // Add cache-busting parameter
        const urlWithCacheBust = `${alternativeUrl}?t=${Date.now()}`

        videoRef.current.src = urlWithCacheBust
        videoRef.current.load()
        setVideoUrl(urlWithCacheBust)
        return true
      }
    } catch (error) {
      console.error("Error trying format fallback:", error)
    }

    return false
  }

  // Update the loadInitialProgram logic in the useEffect
  // Effect to handle initial setup and periodic refresh
  useEffect(() => {
    let initialLoad = false // Flag to track initial load

    // Initial setup
    if (!currentProgram) {
      console.log(`No initial program for channel ${channel.id}, refreshing...`)
      refreshCurrentProgram(true)
      initialLoad = true
    } else {
      // If we have an initial program, try to load it
      const loadInitialProgram = async () => {
        if (videoRef.current) {
          loadAttemptRef.current = 0
          setAttemptedUrls([])
          setFormatFallbackAttempted(false)

          try {
            // First try to get a direct URL
            const url = await getDirectDownloadUrl(currentProgram.mp4_url, channel.id)

            if (url) {
              console.log(`Found direct URL for initial program: ${url}`)
              setDirectUrl(url)
              setAttemptedUrls([url])

              // Detect video format
              const format = detectVideoFormat(url)
              setVideoFormat(format)
              console.log(`Detected video format: ${format}`)

              // Add cache-busting parameter
              const urlWithCacheBust = `${url}?t=${Date.now()}`

              videoRef.current.src = urlWithCacheBust
              videoRef.current.load()
              setShowStandby(false)

              // Set the videoUrl state so it's available for the render
              setVideoUrl(urlWithCacheBust)
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

                // Detect video format
                const format = detectVideoFormat(currentProgram.mp4_url)
                setVideoFormat(format)
                console.log(`Detected video format: ${format}`)

                videoRef.current.src = currentProgram.mp4_url
                videoRef.current.load()
                setShowStandby(false)

                // Set the videoUrl state so it's available for the render
                setVideoUrl(currentProgram.mp4_url)
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

              // Set the videoUrl state so it's available for the render
              setVideoUrl(currentProgram.mp4_url)
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
      initialLoad = true
    }

    // Set up program schedule checking at regular intervals (every 2 minutes)
    programCheckIntervalRef.current = setInterval(() => {
      checkProgramSchedule()
    }, 120000) // 2 minutes = 120,000 ms

    // Set up periodic refresh, but at a lower frequency (every 10 minutes)
    // This is a backup in case the program schedule check fails
    refreshTimerRef.current = setInterval(() => {
      refreshCurrentProgram(false)
    }, 600000) // 10 minutes = 600,000 ms

    return () => {
      if (refreshTimerRef.current) {
        clearInterval(refreshTimerRef.current)
      }
      if (programCheckIntervalRef.current) {
        clearInterval(programCheckIntervalRef.current)
      }
      if (errorTimerRef.current) {
        clearTimeout(errorTimerRef.current)
      }
      if (playbackCheckRef.current) {
        clearInterval(playbackCheckRef.current)
      }
      if (controlsTimeout) {
        clearTimeout(controlsTimeout)
      }
      if (sleepTimerRef.current) {
        clearTimeout(sleepTimerRef.current)
      }
      if (progressSaveIntervalRef.current) {
        clearInterval(progressSaveIntervalRef.current)
      }
      if (loadTimeout) {
        clearTimeout(loadTimeout)
      }
    }
  }, [channel.id, currentProgram])

  // Effect to update progress for current program
  useEffect(() => {
    if (!currentProgram) return

    const progressTimer = setInterval(() => {
      if (videoRef.current) {
        // Calculate progress based on video element's currentTime and duration
        // This is more accurate than using the database duration
        const { currentTime, duration } = videoRef.current

        if (duration > 0) {
          const progressPercent = (currentTime / duration) * 100
          setProgress(progressPercent)

          // Only check for program completion if we're near the end
          // This prevents unnecessary refreshes
          if (progressPercent > 98) {
            console.log("Near end of video, preparing to check for next program")
          }
        }
      } else {
        // Fallback to using the database duration if video isn't playing
        const { progressPercent, isFinished } = calculateProgramProgress(currentProgram)

        if (isFinished) {
          // Time to refresh and get the next program
          console.log("Program finished based on scheduled time, refreshing...")
          refreshCurrentProgram(true)
        } else {
          setProgress(progressPercent)
        }
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
      setFormatFallbackAttempted(false)

      // Don't reload the video if we're actively playing and the program just changed
      // (prevent interruptions during viewing)
      const isActivelyPlaying = !videoRef.current.paused && videoRef.current.currentTime > 0

      // Only reload if:
      // 1. Not actively playing, OR
      // 2. This is a forced program change (programChangeTimeRef was just updated)
      const shouldReload =
        !isActivelyPlaying || (programChangeTimeRef.current && Date.now() - programChangeTimeRef.current < 2000)

      if (!shouldReload) {
        console.log("Program changed but keeping current video playback to avoid interruption")
        return
      }

      const loadProgram = async () => {
        try {
          const url = await getDirectDownloadUrl(currentProgram.mp4_url, channel.id)

          if (url) {
            console.log(`Found direct URL for program: ${url}`)
            setDirectUrl(url)
            setAttemptedUrls([url])

            // Detect video format
            const format = detectVideoFormat(url)
            setVideoFormat(format)
            console.log(`Detected video format: ${format}`)

            // Add cache-busting parameter
            const urlWithCacheBust = `${url}?t=${Date.now()}`

            videoRef.current!.src = urlWithCacheBust
            videoRef.current!.load()
            setShowStandby(false)

            // Set the videoUrl state so it's available for the render
            setVideoUrl(urlWithCacheBust)
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

  // Try fallback videos if all else fails
  const tryFallbackVideo = () => {
    if (!videoRef.current) return

    setRetryCount((prev) => prev + 1)
    const fallbackIndex = retryCount % fallbackVideoUrls.length
    const fallbackUrl = fallbackVideoUrls[fallbackIndex]

    console.log(`Trying fallback video #${fallbackIndex + 1}: ${fallbackUrl}`)

    videoRef.current.src = fallbackUrl
    videoRef.current.load()
    setVideoUrl(fallbackUrl)
    setFallbackMode(true)
    setLoadError(`Using fallback video while we try to fix the issue. (Attempt ${retryCount + 1})`)
  }

  const handleBack = () => {
    router.back()
  }

  const togglePlayPause = () => {
    if (videoRef.current) {
      if (videoRef.current.paused) {
        videoRef.current.play().catch((err) => {
          console.error("Error playing video:", err)
          setLoadError(`Error playing video: ${err.message || "Unknown error"}`)
        })
        setIsPlaying(true)
      } else {
        videoRef.current.pause()
        setIsPlaying(false)
      }
    }
  }

  // Render both videos but control visibility with CSS
  return (
    <div className="relative bg-black" ref={videoContainerRef}>
      {/* Video container */}
      <div className="relative w-full aspect-video">
        {/* Back button */}
        <button
          onClick={handleBack}
          className="absolute top-4 left-4 z-10 bg-black/50 p-2 rounded-full hover:bg-black/70 transition-colors"
        >
          <ChevronLeft className="h-6 w-6" />
        </button>

        {/* Loading state */}
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black">
            <div className="flex flex-col items-center">
              <Loader2 className="h-12 w-12 text-red-600 animate-spin mb-2" />
              <p className="text-white">Loading video...</p>
            </div>
          </div>
        )}

        {/* Error state */}
        {error && (
          <div className="absolute inset-0 flex items-center justify-center bg-black">
            <div className="text-center p-4">
              <p className="text-red-500 mb-4">{error}</p>
              <button
                onClick={() => {
                  setError(null)
                  setIsLoading(true)

                  // Try reloading the video
                  if (videoRef.current && videoUrl) {
                    videoRef.current.load()
                    videoRef.current.play().catch((err) => {
                      console.error("Error during retry:", err)
                      setError("Unable to play this video. Please try again later.")
                      setIsLoading(false)
                    })
                  }
                }}
                className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 transition-colors"
              >
                Try Again
              </button>
            </div>
          </div>
        )}

        {/* Video element */}
        <div className="relative w-full aspect-video bg-black" onMouseMove={handleMouseMove} onClick={togglePlayPause}>
          <video
            ref={videoRef}
            className="w-full h-full"
            autoPlay
            playsInline
            onContextMenu={handleContextMenu}
            onLoadStart={() => {
              console.log("Video load started")
              setIsLoading(true)
            }}
            onCanPlay={() => {
              console.log("Video can play now")
              setIsLoading(false)
              setLoadError(null)

              // If we have saved progress, seek to it
              if (savedProgress && videoRef.current) {
                console.log(`Seeking to saved position: ${savedProgress}s`)
                videoRef.current.currentTime = savedProgress
              }
            }}
            onError={() => {
              // Safely extract error details from the video element
              let errorMessage = "Unknown error"

              if (videoRef.current && videoRef.current.error) {
                const videoError = videoRef.current.error
                console.error("Video error details:", {
                  code: videoError.code,
                  message: videoError.message,
                  name: videoError.name,
                })

                // Map error codes to human-readable messages
                switch (videoError.code) {
                  case MediaError.MEDIA_ERR_ABORTED:
                    errorMessage = "Playback aborted by the user"
                    break
                  case MediaError.MEDIA_ERR_NETWORK:
                    errorMessage = "Network error occurred while loading"
                    break
                  case MediaError.MEDIA_ERR_DECODE:
                    errorMessage = "Media decoding error - format may be unsupported"
                    break
                  case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED:
                    errorMessage = "Video format not supported"
                    break
                  default:
                    errorMessage = videoError.message || `Error code: ${videoError.code}`
                }

                // For format errors, try alternative format
                if (
                  videoError.code === MediaError.MEDIA_ERR_DECODE ||
                  videoError.code === MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED
                ) {
                  console.log("Format error detected, trying alternative format")
                  tryFormatFallback().then((success) => {
                    if (!success) {
                      console.log("Format fallback failed, trying fallback video")
                      tryFallbackVideo()
                    }
                  })
                  return
                }
              }

              console.error("Video error:", errorMessage)
              setLoadError(`Error loading video: ${errorMessage}`)

              // If we've tried a few times with the normal URLs, try a fallback
              if (retryCount < 3) {
                setRetryCount((prev) => prev + 1)
                console.log(`Retrying video load (attempt ${retryCount + 1})`)

                if (videoRef.current) {
                  // Try reloading with a cache buster
                  const currentSrc = videoRef.current.src.split("?")[0]
                  videoRef.current.src = `${currentSrc}?t=${Date.now()}`
                  videoRef.current.load()
                }
              } else {
                // After 3 retries, try a fallback video
                tryFallbackVideo()
              }
            }}
            onTimeUpdate={handleTimeUpdate}
            onLoadedMetadata={handleMetadataLoaded}
            onPlay={handleVideoStarted}
            onPause={handleVideoPaused}
            onEnded={handleVideoEnded}
            onWaiting={() => {
              console.log("Video is waiting/buffering")
            }}
            onStalled={() => {
              console.log("Video playback has stalled")
            }}
          >
            {videoUrl && <source src={videoUrl} type={getMimeType(videoUrl)} />}
            Your browser does not support the video tag.
          </video>

          {/* Standby video (hidden until needed) */}
          <video
            ref={standbyVideoRef}
            className={`w-full h-full absolute inset-0 ${showStandby ? "block" : "hidden"}`}
            autoPlay
            loop
            muted
            playsInline
          >
            <source src={standbyVideoUrl} type="video/mp4" />
          </video>

          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50">
              <div className="flex flex-col items-center">
                <Loader2 className="h-12 w-12 text-red-600 animate-spin mb-2" />
                <p className="text-white">Loading video...</p>
              </div>
            </div>
          )}

          {loadError && !isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-70">
              <div className="bg-gray-900 p-4 rounded-lg max-w-md text-center">
                <AlertTriangle className="h-8 w-8 text-yellow-500 mx-auto mb-2" />
                <p className="text-white mb-4">{loadError}</p>
                <div className="flex justify-center space-x-3">
                  <button
                    className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded flex items-center"
                    onClick={() => {
                      if (videoRef.current) {
                        setIsLoading(true)
                        setLoadError(null)
                        videoRef.current.load()
                      }
                    }}
                  >
                    <RefreshCw className="h-4 w-4 mr-2" /> Try Again
                  </button>
                  <button
                    className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded"
                    onClick={tryFallbackVideo}
                  >
                    Try Fallback Video
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Video controls overlay */}
        <div
          className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4"
          style={{ zIndex: 10 }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Progress bar for non-live videos */}
          {!isLive && currentProgram && videoMetadata.loaded && (
            <div className="mb-4">
              <input
                type="range"
                min="0"
                max="100"
                value={progress}
                onChange={handleSeek}
                className="w-full h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer"
                style={{
                  background: `linear-gradient(to right, #ef4444 0%, #ef4444 ${progress}%, #4b5563 ${progress}%, #4b5563 100%)`,
                }}
              />
              {videoRef.current && (
                <div className="flex justify-between text-xs text-gray-300 mt-1">
                  <span>{formatTime(videoRef.current.currentTime || 0)}</span>
                  <span>{formatTime(videoRef.current.duration || 0)}</span>
                </div>
              )}
            </div>
          )}

          {/* Control buttons */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button
                onClick={togglePlayPause}
                className="hover:text-red-500 transition-colors bg-black/30 p-2 rounded-full"
              >
                {isPlaying ? <Pause className="h-6 w-6" /> : <Play className="h-6 w-6" />}
              </button>
              <button
                onClick={toggleMute}
                className="hover:text-red-500 transition-colors bg-black/30 p-2 rounded-full"
              >
                {isMuted ? <VolumeX className="h-6 w-6" /> : <Volume2 className="h-6 w-6" />}
              </button>

              {/* Volume slider */}
              <div className="hidden md:flex items-center">
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={volume}
                  onChange={handleVolumeChange}
                  className="w-20 h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer"
                />
              </div>

              {isLive && <span className="text-red-500 text-sm font-medium bg-black/30 px-2 py-1 rounded">LIVE</span>}
              {fallbackMode && (
                <span className="text-yellow-500 text-sm font-medium bg-black/30 px-2 py-1 rounded">FALLBACK</span>
              )}
            </div>

            <div className="flex items-center space-x-2">
              {/* Playback speed (desktop only) */}
              <div className="hidden md:block">
                <select
                  value={playbackRate}
                  onChange={(e) => changePlaybackSpeed(Number(e.target.value))}
                  className="bg-black/30 text-white text-sm rounded px-2 py-1"
                >
                  <option value="0.5">0.5x</option>
                  <option value="1">1x</option>
                  <option value="1.5">1.5x</option>
                  <option value="2">2x</option>
                </select>
              </div>

              <button
                onClick={toggleFullscreen}
                className="hover:text-red-500 transition-colors bg-black/30 p-2 rounded-full"
              >
                <Maximize className="h-6 w-6" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Current program info */}
      {currentProgram && (
        <div className="bg-black p-4">
          <h2 className="text-xl font-bold">{currentProgram.title}</h2>
          {videoFormat && <p className="text-gray-400 text-sm mt-1">Format: {videoFormat}</p>}
          {scheduledProgramId !== currentProgram.id && (
            <p className="text-yellow-500 text-sm mt-1">New program scheduled. Will update shortly.</p>
          )}
          {fallbackMode && (
            <p className="text-yellow-500 text-sm mt-1">
              Using fallback video. The original content will be restored when available.
            </p>
          )}
        </div>
      )}
    </div>
  )
}
