// watch.tsx — With safe guide, video playback logic, and password protection for channels 23–30
"use client"

import { type ReactNode, useEffect, useState, useCallback } from "react"
import { useParams, useRouter } from "next/navigation"
import VideoPlayer from "@/components/video-player"
import {
  getVideoUrlForProgram,
  fetchChannelDetails,
  supabase,
  STANDBY_PLACEHOLDER_ID,
} from "@/lib/supabase"
import type { Program, Channel } from "@/types"
import { ChevronLeft, Loader2 } from "lucide-react"

const HLS_LIVE_STREAM_URL_CH21 =
  "https://cdn.livepush.io/hls/fe96095a2d2b4314aa1789fb309e48f8/index.m3u8"
const CH21_ID_NUMERIC = 21
const PASSWORD_PROTECTED_CHANNELS = [23, 24, 25, 26, 27, 28, 29, 30]

export default function WatchPage() {
  const params = useParams()
  const router = useRouter()
  const channelIdString = params.channelId as string

  const [validatedNumericChannelId, setValidatedNumericChannelId] = useState<number | null>(null)
  const [currentProgram, setCurrentProgram] = useState<Program | null>(null)
  const [upcomingPrograms, setUpcomingPrograms] = useState<Program[]>([])
  const [channelDetails, setChannelDetails] = useState<Channel | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [videoPlayerKey, setVideoPlayerKey] = useState(Date.now())
  const [hlsStreamFailedForCh21, setHlsStreamFailedForCh21] = useState(false)
  const [passwordInput, setPasswordInput] = useState("")
  const [isPasswordValid, setIsPasswordValid] = useState(false)

  useEffect(() => {
    if (!channelIdString) {
      setError("Channel ID is missing in URL.")
      setIsLoading(false)
      return
    }
    const numericId = Number.parseInt(channelIdString, 10)
    if (isNaN(numericId)) {
      setError("Invalid channel ID format in URL.")
      setIsLoading(false)
      return
    }
    setValidatedNumericChannelId(numericId)
    setError(null)
    if (numericId !== CH21_ID_NUMERIC) setHlsStreamFailedForCh21(false)

    const loadChannelDetails = async () => {
      setIsLoading(true)
      const details = await fetchChannelDetails(channelIdString)
      setChannelDetails(details)
      if (!details) setError("Could not load channel details.")
    }
    loadChannelDetails()
  }, [channelIdString])

  useEffect(() => {
    if (validatedNumericChannelId !== null) {
      const key = `channel_password_${validatedNumericChannelId}`
      const saved = localStorage.getItem(key)
      if (saved === `channel${validatedNumericChannelId}`) {
        setIsPasswordValid(true)
      }
    }
  }, [validatedNumericChannelId])

  const handlePasswordSubmit = () => {
    if (
      validatedNumericChannelId &&
      passwordInput === `channel${validatedNumericChannelId}`
    ) {
      localStorage.setItem(
        `channel_password_${validatedNumericChannelId}`,
        passwordInput
      )
      setIsPasswordValid(true)
    } else {
      alert("Incorrect password")
    }
  }

  const getCh21StandbyMp4Program = useCallback(
    (now: Date): Program => ({
      id: STANDBY_PLACEHOLDER_ID,
      title: "Channel 21 - Standby",
      description: "Live stream currently unavailable. Standby programming will play.",
      channel_id: CH21_ID_NUMERIC,
      mp4_url: `channel${CH21_ID_NUMERIC}/standby_blacktruthtv.mp4`,
      duration: 300,
      start_time: now.toISOString(),
      poster_url: null,
    }),
    []
  )

  const fetchCurrentProgram = useCallback(
    async (numericChannelId: number) => {
      setIsLoading(true)
      const now = new Date()
      try {
        const { data: programsData, error: dbError } = await supabase
          .from("programs")
          .select("*, duration")
          .eq("channel_id", numericChannelId)
          .order("start_time", { ascending: true })

        if (dbError) throw new Error(`Database error: ${dbError.message}`)

        const programs = programsData as Program[]
        const activeProgram = programs?.find((p) => {
          if (!p.start_time || typeof p.duration !== "number" || p.duration <= 0) return false
          const start = new Date(p.start_time)
          const end = new Date(start.getTime() + p.duration * 1000)
          return now >= start && now < end
        })

        let programToSet: Program | null = null

        if (activeProgram) {
          programToSet = { ...activeProgram, channel_id: numericChannelId }
          if (numericChannelId === CH21_ID_NUMERIC) setHlsStreamFailedForCh21(false)
        } else if (numericChannelId === CH21_ID_NUMERIC) {
          programToSet = hlsStreamFailedForCh21
            ? getCh21StandbyMp4Program(now)
            : {
                id: "live-ch21-hls",
                title: "Live Broadcast (Channel 21)",
                description: "Currently broadcasting live.",
                channel_id: CH21_ID_NUMERIC,
                mp4_url: `/api/cors-proxy?url=${encodeURIComponent(HLS_LIVE_STREAM_URL_CH21)}`,
                duration: 86400 * 7,
                start_time: new Date(Date.now() - 3600000).toISOString(),
                poster_url: channelDetails?.image_url || null,
              }
        } else {
          programToSet = {
            id: STANDBY_PLACEHOLDER_ID,
            title: "Standby Programming",
            description: "Programming will resume shortly.",
            channel_id: numericChannelId,
            mp4_url: `channel${numericChannelId}/standby_blacktruthtv.mp4`,
            duration: 300,
            start_time: now.toISOString(),
            poster_url: channelDetails?.image_url || null,
          }
        }

        setCurrentProgram((prev) => {
          if (
            prev?.id !== programToSet!.id ||
            prev?.start_time !== programToSet!.start_time ||
            prev?.mp4_url !== programToSet!.mp4_url
          ) {
            setVideoPlayerKey(Date.now())
          }
          return programToSet
        })
      } catch (e: any) {
        setError(e.message)
        if (numericChannelId === CH21_ID_NUMERIC) {
          setCurrentProgram(getCh21StandbyMp4Program(now))
        } else {
          setCurrentProgram({
            id: STANDBY_PLACEHOLDER_ID,
            title: "Standby Programming - Error",
            description: "Error loading schedule. Standby content will play.",
            channel_id: numericChannelId,
            mp4_url: `channel${numericChannelId}/standby_blacktruthtv.mp4`,
            duration: 300,
            start_time: now.toISOString(),
            poster_url: channelDetails?.image_url || null,
          })
        }
      } finally {
        setIsLoading(false)
      }
    },
    [hlsStreamFailedForCh21, getCh21StandbyMp4Program, channelDetails]
  )

  const fetchUpcomingPrograms = useCallback(async (numericChannelId: number) => {
    try {
      const now = new Date().toISOString()
      const { data, error } = await supabase
        .from("programs")
        .select("*")
        .eq("channel_id", numericChannelId)
        .gt("start_time", now)
        .order("start_time", { ascending: true })
        .limit(6)

      if (!error && data) setUpcomingPrograms(data as Program[])
    } catch (e) {
      console.warn("Error loading upcoming programs", e)
    }
  }, [])

  useEffect(() => {
    let pollingInterval: NodeJS.Timeout | undefined
    if (validatedNumericChannelId !== null && isPasswordValid) {
      fetchCurrentProgram(validatedNumericChannelId)
      fetchUpcomingPrograms(validatedNumericChannelId)
      pollingInterval = setInterval(() => {
        if (document.visibilityState === "visible") {
          fetchCurrentProgram(validatedNumericChannelId)
          fetchUpcomingPrograms(validatedNumericChannelId)
        }
      }, 60000)
    }
    return () => pollingInterval && clearInterval(pollingInterval)
  }, [validatedNumericChannelId, fetchCurrentProgram, fetchUpcomingPrograms, isPasswordValid])

  const handlePrimaryLiveStreamError = useCallback(() => {
    if (validatedNumericChannelId === CH21_ID_NUMERIC && !hlsStreamFailedForCh21) {
      setHlsStreamFailedForCh21(true)
      setCurrentProgram(getCh21StandbyMp4Program(new Date()))
      setVideoPlayerKey(Date.now())
    }
  }, [validatedNumericChannelId, hlsStreamFailedForCh21, getCh21StandbyMp4Program])

  const videoSrc = currentProgram ? getVideoUrlForProgram(currentProgram) : undefined
  const posterSrc = currentProgram?.poster_url || channelDetails?.image_url || undefined
  const shouldLoopInPlayer = currentProgram?.id === STANDBY_PLACEHOLDER_ID
  const isPrimaryHLS = currentProgram?.id === "live-ch21-hls"
  const showNoLiveNoticeForCh21 =
    validatedNumericChannelId === CH21_ID_NUMERIC &&
    hlsStreamFailedForCh21 &&
    currentProgram?.id === STANDBY_PLACEHOLDER_ID

  const handleProgramEnded = useCallback(() => {
    if (validatedNumericChannelId !== null) {
      fetchCurrentProgram(validatedNumericChannelId)
    }
  }, [validatedNumericChannelId, fetchCurrentProgram])

  if (
    validatedNumericChannelId !== null &&
    PASSWORD_PROTECTED_CHANNELS.includes(validatedNumericChannelId) &&
    !isPasswordValid
  ) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center text-white px-4">
        <h1 className="text-xl font-bold mb-4">Enter Password for Channel {validatedNumericChannelId}</h1>
        <input
          type="password"
          value={passwordInput}
          onChange={(e) => setPasswordInput(e.target.value)}
          className="mb-4 p-2 rounded text-black"
          placeholder="Enter password"
        />
        <button
          onClick={handlePasswordSubmit}
          className="bg-blue-600 px-4 py-2 rounded text-white hover:bg-blue-500"
        >
          Submit
        </button>
      </div>
    )
  }

  let content: ReactNode
  if (error) {
    content = <p className="text-red-400 p-4 text-center">Error: {error}</p>
  } else if (isLoading && !currentProgram) {
    content = (
      <div className="flex flex-col items-center justify-center h-full">
        <Loader2 className="h-10 w-10 animate-spin text-red-500 mb-2" />
        <p>Loading Channel...</p>
      </div>
    )
  } else if (currentProgram && videoSrc) {
    content = (
      <VideoPlayer
        key={videoPlayerKey}
        src={videoSrc}
        poster={posterSrc}
        isStandby={shouldLoopInPlayer}
        programTitle={currentProgram?.title}
        onVideoEnded={handleProgramEnded}
        isPrimaryLiveStream={isPrimaryHLS && validatedNumericChannelId === CH21_ID_NUMERIC}
        onPrimaryLiveStreamError={handlePrimaryLiveStreamError}
        showNoLiveNotice={showNoLiveNoticeForCh21}
      />
    )
  } else {
    content = <p className="text-gray-400 p-4 text-center">Initializing channel...</p>
  }

  return (
    <div className="bg-black min-h-screen flex flex-col text-white">
      <div className="p-4 flex items-center justify-between bg-gray-900/50 sticky top-0 z-10">
        <button onClick={() => router.back()} className="p-2 rounded-full hover:bg-gray-700" aria-label="Go back">
          <ChevronLeft className="h-6 w-6" />
        </button>
        <h1 className="text-xl font-semibold truncate px-2">{channelDetails?.name || `Channel ${channelIdString}`}</h1>
        <div className="w-10 h-10" />
      </div>
      <div className="w-full aspect-video bg-black flex items-center justify-center">{content}</div>
      <div className="p-4 flex-grow">
        {currentProgram && !isLoading && (
          <>
            <h2 className="text-2xl font-bold">{currentProgram.title}</h2>
            <p className="text-sm text-gray-400">Channel: {channelDetails?.name || `Channel ${channelIdString}`}</p>
            {currentProgram.id !== STANDBY_PLACEHOLDER_ID &&
              currentProgram.id !== "live-ch21-hls" &&
              currentProgram.start_time && (
                <p className="text-sm text-gray-400">
                  Scheduled Start: {new Date(currentProgram.start_time).toLocaleString()}
                </p>
              )}
            <p className="text-xs text-gray-300 mt-1">{currentProgram.description}</p>

            {upcomingPrograms.length > 0 && (
              <div className="mt-6">
                <h3 className="text-lg font-semibold text-white mb-2">Upcoming Programs</h3>
                <ul className="text-sm text-gray-300 space-y-1">
                  {upcomingPrograms.map((program) => (
                    <li key={program.id}>
                      <span className="font-medium">{program.title}</span>{" "}
                      <span className="text-gray-400">
                        — {new Date(program.start_time).toLocaleTimeString("en-US", {
                          hour: "2-digit",
                          minute: "2-digit",
                          timeZoneName: "short",
                        })}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
