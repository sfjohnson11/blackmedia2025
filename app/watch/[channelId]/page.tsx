// watch.tsx — Full page with Video Player, Countdown & TV Guide (LOCAL TIME)
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

const HLS_LIVE_STREAM_URL_CH21 = "https://cdn.livepush.io/hls/fe96095a2d2b4314aa1789fb309e48f8/index.m3u8"
const CH21_ID_NUMERIC = 21

export default function WatchPage() {
  const params = useParams()
  const router = useRouter()
  const channelIdString = params.channelId as string

  const [validatedNumericChannelId, setValidatedNumericChannelId] = useState<number | null>(null)
  const [currentProgram, setCurrentProgram] = useState<Program | null>(null)
  const [channelDetails, setChannelDetails] = useState<Channel | null>(null)
  const [upcomingPrograms, setUpcomingPrograms] = useState<Program[]>([])
  const [dailySchedule, setDailySchedule] = useState<Program[]>([])
  const [nextCountdown, setNextCountdown] = useState<string>("")
  const [isLoading, setIsLoading] = useState(true)
  const [videoPlayerKey, setVideoPlayerKey] = useState(Date.now())
  const [hlsStreamFailedForCh21, setHlsStreamFailedForCh21] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const getCh21StandbyMp4Program = useCallback((now: Date): Program => ({
    id: STANDBY_PLACEHOLDER_ID,
    title: "Channel 21 - Standby",
    description: "Live stream currently unavailable. Standby programming will play.",
    channel_id: CH21_ID_NUMERIC,
    mp4_url: `channel${CH21_ID_NUMERIC}/standby_blacktruthtv.mp4`,
    duration: 300,
    start_time: now.toISOString(),
    poster_url: null,
  }), [])

  const fetchSchedule = useCallback(async (channelId: number) => {
    const { data, error } = await supabase
      .from("programs")
      .select("*")
      .eq("channel_id", channelId)
      .order("start_time")

    if (data && !error) {
      const now = new Date()
      const upcoming = data.filter(p => new Date(p.start_time) > now)
      setUpcomingPrograms(upcoming.slice(0, 5))

      // Daily TV Guide (limit to next 24 hrs)
      const endOfDay = new Date()
      endOfDay.setHours(23, 59, 59, 999)
      const todayOnly = data.filter(p => {
        const start = new Date(p.start_time)
        return start >= now && start <= endOfDay
      })

      // Remove exact duplicates by mp4_url + start_time
      const seen = new Set()
      const unique = todayOnly.filter(p => {
        const key = `${p.mp4_url}-${p.start_time}`
        if (seen.has(key)) return false
        seen.add(key)
        return true
      })
      setDailySchedule(unique)

      // Countdown setup
      if (upcoming.length > 0) {
        const nextStart = new Date(upcoming[0].start_time).getTime()
        const tick = () => {
          const now = Date.now()
          const diff = Math.max(0, nextStart - now)
          const mins = Math.floor(diff / 60000)
          const secs = Math.floor((diff % 60000) / 1000)
          setNextCountdown(`${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`)
        }
        tick()
        const interval = setInterval(tick, 1000)
        return () => clearInterval(interval)
      }
    }
  }, [])

  const fetchCurrentProgram = useCallback(async (channelId: number) => {
    setIsLoading(true)
    const now = new Date()
    try {
      const { data, error } = await supabase
        .from("programs")
        .select("*")
        .eq("channel_id", channelId)
        .order("start_time")

      if (error) throw new Error(error.message)

      const program = (data as Program[]).find(p => {
        const start = new Date(p.start_time).getTime()
        const end = start + p.duration * 1000
        return now.getTime() >= start && now.getTime() < end
      })

      if (program) {
        setCurrentProgram(program)
        if (channelId === CH21_ID_NUMERIC) setHlsStreamFailedForCh21(false)
      } else if (channelId === CH21_ID_NUMERIC) {
        setCurrentProgram({
          id: "live-ch21-hls",
          title: "Live Broadcast (Channel 21)",
          description: "Currently broadcasting live.",
          channel_id: channelId,
          mp4_url: `/api/cors-proxy?url=${encodeURIComponent(HLS_LIVE_STREAM_URL_CH21)}`,
          duration: 86400 * 7,
          start_time: new Date().toISOString(),
          poster_url: channelDetails?.image_url || null,
        })
      } else {
        setCurrentProgram({
          id: STANDBY_PLACEHOLDER_ID,
          title: "Standby Programming",
          description: "No active program.",
          channel_id: channelId,
          mp4_url: `channel${channelId}/standby_blacktruthtv.mp4`,
          duration: 300,
          start_time: now.toISOString(),
          poster_url: channelDetails?.image_url || null,
        })
      }
    } catch (e: any) {
      setError(e.message)
    } finally {
      setIsLoading(false)
    }
  }, [channelDetails])

  useEffect(() => {
    const id = Number(channelIdString)
    if (!id || isNaN(id)) return setError("Invalid channel ID")
    setValidatedNumericChannelId(id)
    fetchCurrentProgram(id)
    fetchSchedule(id)
  }, [channelIdString, fetchCurrentProgram, fetchSchedule])

  const handleEnd = () => {
    if (validatedNumericChannelId) fetchCurrentProgram(validatedNumericChannelId)
  }

  return (
    <div className="bg-black min-h-screen text-white">
      <div className="p-4 bg-gray-900 flex items-center justify-between">
        <button onClick={() => router.back()}><ChevronLeft className="w-6 h-6" /></button>
        <h1 className="text-xl font-bold">{channelDetails?.name || `Channel ${channelIdString}`}</h1>
        <div className="w-6" />
      </div>

      <div className="aspect-video bg-black">{currentProgram && (
        <VideoPlayer
          key={videoPlayerKey}
          src={getVideoUrlForProgram(currentProgram)}
          poster={currentProgram.poster_url}
          programTitle={currentProgram.title}
          isStandby={currentProgram.id === STANDBY_PLACEHOLDER_ID}
          isPrimaryLiveStream={currentProgram.id === "live-ch21-hls"}
          onVideoEnded={handleEnd}
        />
      )}</div>

      <div className="p-4">
        <h2 className="text-lg font-semibold">Upcoming Programs</h2>
        {nextCountdown && (
          <p className="text-sm text-green-400">Next program in: {nextCountdown}</p>
        )}

        <div className="mt-4 border-t border-gray-700 pt-2">
          <h3 className="text-md font-semibold mb-2">📅 Today's TV Guide</h3>
          <ul className="space-y-1 text-sm">
            {dailySchedule.map((prog) => (
              <li key={prog.id}>
                <span className="font-bold">{prog.title}</span> — {new Date(prog.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}
