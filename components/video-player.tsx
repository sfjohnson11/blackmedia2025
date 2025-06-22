"use client"

import type React from "react"
import { useRef, useEffect, useState } from "react"
// getFullUrl should construct the direct public Supabase URL
import { getFullUrl, STANDBY_PLACEHOLDER_ID } from "@/lib/supabase"
import type { Program } from "@/types"
import { AlertTriangle } from "lucide-react" // For basic feedback

// This player is based on your "05-15-25 working playercode"
// It will attempt to play DIRECTLY from Supabase.
// If CORS issues arise, they will need to be handled at the Supabase bucket level.

interface VideoPlayerProps {
  initialProgram: Program | null
  // onProgramEnd and onError are not strictly used by your original player logic
  // but are kept for potential future compatibility if needed.
  onProgramEnd?: () => void
  onError?: (error: string) => void
}

export default function VideoPlayer({ initialProgram }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [currentVideoUrl, setCurrentVideoUrl] = useState<string>("")
  const [currentPosterUrl, setCurrentPosterUrl] = useState<string | undefined>(undefined)
  const [error, setError] = useState<string | null>(null)
  const [isStandby, setIsStandby] = useState(false)

  useEffect(() => {
    console.log("RevertedPlayer: initialProgram changed", initialProgram)
    setError(null) // Clear previous errors

    if (initialProgram && initialProgram.mp4_url) {
      const directSupabaseUrl = getFullUrl(initialProgram.mp4_url)
      console.log(`RevertedPlayer: New direct video URL: ${directSupabaseUrl}`)

      if (!directSupabaseUrl || !directSupabaseUrl.startsWith("http")) {
        console.error("RevertedPlayer: Invalid direct Supabase URL:", directSupabaseUrl)
        setError("Invalid video URL configuration.")
        setCurrentVideoUrl("") // Clear URL to stop playback
        return
      }

      // Update state if the URL has actually changed
      if (directSupabaseUrl !== currentVideoUrl) {
        setCurrentVideoUrl(directSupabaseUrl)
      }
      setCurrentPosterUrl(initialProgram.poster_url ? getFullUrl(initialProgram.poster_url) : undefined)
      setIsStandby(initialProgram.channel_id === STANDBY_PLACEHOLDER_ID)
    } else {
      console.log("RevertedPlayer: No initialProgram or mp4_url, clearing video URL.")
      setCurrentVideoUrl("") // Clear URL if no program
      setCurrentPosterUrl(undefined)
    }
  }, [initialProgram, currentVideoUrl]) // Rerun if initialProgram changes or if we need to re-evaluate currentVideoUrl

  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    if (currentVideoUrl) {
      console.log(`RevertedPlayer: Applying src: ${currentVideoUrl} to video element.`)
      // Only set src if it's different to avoid unnecessary reloads
      if (video.currentSrc !== currentVideoUrl) {
        video.src = currentVideoUrl
        video.load() // Load the new source
      }
      // Your original code set volume and controls here, and called play.
      video.volume = 1 // As per your original code
      video.controls = true // As per your original code
      video.crossOrigin = "anonymous" // Good practice for cross-origin media

      video
        .play()
        .then(() => {
          console.log("RevertedPlayer: Play initiated.")
          setError(null) // Clear error on successful play
        })
        .catch((playError) => {
          console.warn("RevertedPlayer: Autoplay failed. User interaction might be needed.", playError)
          // This could be due to browser autoplay policies or CORS if not configured on Supabase
          // We won't set a visible error for this, user can use controls.
          // If it's a deeper error, onError event will catch it.
        })
    } else {
      // No video URL, so pause and clear src
      console.log("RevertedPlayer: No currentVideoUrl, pausing and removing src.")
      video.pause()
      video.removeAttribute("src")
      video.load() // Clear buffer
    }
  }, [currentVideoUrl]) // This effect runs when currentVideoUrl changes

  const handleVideoError = (e: React.SyntheticEvent<HTMLVideoElement, Event>) => {
    const video = e.currentTarget
    let errorMsg = "Video playback error."
    const rawErrorObject = video.error

    if (rawErrorObject) {
      // Log the full error object for more details
      console.error("RevertedPlayer: Raw VideoError Object:", rawErrorObject)
      switch (rawErrorObject.code) {
        case MediaError.MEDIA_ERR_ABORTED:
          errorMsg = "Playback aborted."
          break
        case MediaError.MEDIA_ERR_NETWORK:
          errorMsg = "Network error fetching video."
          break
        case MediaError.MEDIA_ERR_DECODE:
          errorMsg = "Video decoding error (e.g., DEMUXER_ERROR_COULD_NOT_OPEN)."
          break
        case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED:
          errorMsg = "Video format/source not supported (check URL and CORS on Supabase)."
          break
        default:
          errorMsg = `Unknown video error (code ${rawErrorObject.code}). Message: ${rawErrorObject.message}`
      }
    }
    console.error("RevertedPlayer: VideoError event:", errorMsg, "Src:", video.currentSrc)
    setError(errorMsg)
  }

  if (!currentVideoUrl && !error) {
    // If there's no URL and no error yet, it might be loading or no program
    return (
      <div className="w-full aspect-video bg-black flex items-center justify-center text-white">
        {initialProgram === null ? "No program scheduled." : "Preparing video..."}
      </div>
    )
  }

  return (
    <div
      style={{
        backgroundColor: "black",
        width: "100%",
        // height: "auto", // Let aspect-video handle height
        // padding: "10px", // Consider if this padding is desired
        position: "relative",
        // zIndex: 0, // Usually not needed unless specific stacking issues
      }}
      className="w-full aspect-video" // Added aspect-video for consistency
    >
      <video
        ref={videoRef}
        // src={currentVideoUrl} // src is set in useEffect
        poster={currentPosterUrl}
        controls // From your original code
        playsInline // Good practice
        autoPlay // From your original code
        muted // IMPORTANT: Start muted for higher chance of autoplay success
        loop={isStandby} // Loop if it's a standby video
        className="w-full h-full object-contain" // max-h-[90vh] from your original, using h-full with aspect-video
        crossOrigin="anonymous" // For direct Supabase access
        onError={handleVideoError}
        onCanPlay={() => setError(null)} // Clear error if it becomes playable
      >
        Your browser does not support the video tag.
      </video>
      {error && (
        <div className="absolute inset-0 bg-black bg-opacity-75 flex flex-col items-center justify-center text-white p-4 z-20">
          <AlertTriangle className="h-10 w-10 text-yellow-400 mb-3" />
          <p className="text-center text-sm">Video Error:</p>
          <p className="text-center text-xs mt-1">{error}</p>
          <p className="text-center text-xs mt-2">URL: {currentVideoUrl}</p>
        </div>
      )}
    </div>
  )
}
