// watch.tsx — Clean version with Upcoming and Daily Guide (no countdown)
"use client"

import { type ReactNode, useEffect, useState, useCallback } from "react"
import { useParams, useRouter } from "next/navigation"
import VideoPlayer from "@/components/video-player"
import { getVideoUrlForProgram, fetchChannelDetails, supabase, STANDBY_PLACEHOLDER_ID } from "@/lib/supabase"
import type { Program, Channel } from "@/types"
import { ChevronLeft, Loader2 } from "lucide-react"

const HLS_LIVE_STREAM_URL_CH21 = "https://cdn.livepush.io/hls/fe96095a2d2b4314aa1789fb309e48f8/index.m3u8"
const CH21_ID_NUMERIC = 21

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
  const [dailySchedule, setDailySchedule] = useState<Program[]>([])

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

        if (activeProgram) {
          setCurrentProgram({ ...activeProgram, channel_id: numericChannelId })
          if (numericChannelId === CH21_ID_NUMERIC) setHlsStreamFailedForCh21(false)
        } else if (numericChannelId === CH21_ID_NUMERIC) {
          setCurrentProgram(
            hlsStreamFailedForCh21
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
          )
        } else {
          setCurrentProgram({
            id: STANDBY_PLACEHOLDER_ID,
            title: "Standby Programming",
            description: "Programming will resume shortly.",
            channel_id: numericChannelId,
            mp4_url: `channel${numericChannelId}/standby_blacktruthtv.mp4`,
            duration: 300,
            start_time: now.toISOString(),
            poster_url: channelDetails?.image_url || null,
          })
        }
      } catch (e: any) {
        setError(e.message)
        setCurrentProgram(getCh21StandbyMp4Program(now))
      } finally {
        setIsLoading(false)
      }
    },
    [hlsStreamFailedForCh21, getCh21StandbyMp4Program, channelDetails]
  )

  const fetchDailySchedule = useCallback(async (channelId: number) => {
    const now = new Date()
    const midnight = new Date(now)
    midnight.setUTCHours(0, 0, 0, 0)
    const nextMidnight = new Date(midnight)
    nextMidnight.setUTCDate(midnight.getUTCDate() + 1)

    const { data, error } = await supabase
      .from("programs")
      .select("*")
      .eq("channel_id", channelId)
      .gte("start_time", midnight.toISOString())
      .lt("start_time", nextMidnight.toISOString())
      .order("start_time", { ascending: true })

    if (!error && data) setDailySchedule(data as Program[])
  }, [])

  useEffect(() => {
    let pollingInterval: NodeJS.Timeout | undefined
    if (validatedNumericChannelId !== null) {
      fetchCurrentProgram(validatedNumericChannelId)
      fetchDailySchedule(validatedNumericChannelId)
      pollingInterval = setInterval(() => {
        if (document.visibilityState === "visible") {
          fetchCurrentProgram(validatedNumericChannelId)
          fetchDailySchedule(validatedNumericChannelId)
        }
      }, 60000)
    }
    return () => pollingInterval && clearInterval(pollingInterval)
  }, [validatedNumericChannelId, fetchCurrentProgram, fetchDailySchedule])

  const handleProgramEnded = useCallback(() => {
    if (validatedNumericChannelId !== null) {
      fetchCurrentProgram(validatedNumericChannelId)
    }
  }, [validatedNumericChannelId, fetchCurrentProgram])

  const videoSrc = currentProgram ? getVideoUrlForProgram(currentProgram) : undefined
  const posterSrc = currentProgram?.poster_url || channelDetails?.image_url || undefined
  const isStandby = currentProgram?.id === STANDBY_PLACEHOLDER_ID

  return (
    <div className="bg-black min-h-screen flex flex-col text-white">
      <div className="p-4 flex items-center justify-between bg-gray-900/50 sticky top-0 z-10">
        <button onClick={() => router.back()} className="p-2 rounded-full hover:bg-gray-700" aria-label="Go back">
          <ChevronLeft className="h-6 w-6" />
        </button>
        <h1 className="text-xl font-semibold truncate px-2">{channelDetails?.name || `Channel ${channelIdString}`}</h1>
        <div className="w-10 h-10" />
      </div>

      <div className="w-full aspect-video bg-black flex items-center justify-center">
        {isLoading ? (
          <Loader2 className="h-10 w-10 animate-spin text-red-500" />
        ) : (
          <VideoPlayer
            key={videoPlayerKey}
            src={videoSrc!}
            poster={posterSrc}
            isStandby={isStandby}
            programTitle={currentProgram?.title}
            onVideoEnded={handleProgramEnded}
          />
        )}
      </div>

      <div className="p-4 space-y-4">
        {currentProgram && (
          <div>
            <h2 className="text-2xl font-bold">{currentProgram.title}</h2>
            <p className="text-sm text-gray-400">
              Start Time: {new Date(currentProgram.start_time).toLocaleString()}
            </p>
            <p className="text-xs text-gray-300 mt-1">{currentProgram.description}</p>
          </div>
        )}

        {dailySchedule.length > 0 && (
          <div>
            <h3 className="text-lg font-semibold text-white mb-2">📅 Today's Schedule</h3>
            <ul className="text-sm text-gray-300 space-y-1">
              {dailySchedule.map((program) => (
                <li key={program.id}>
                  <span className="font-medium">{program.title}</span> — {new Date(program.start_time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  )
}
