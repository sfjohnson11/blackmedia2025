"use client"

import { useEffect, useState, useCallback, useRef } from "react"
import { useParams, useRouter } from "next/navigation"
import VideoPlayer from "@/components/video-player" // This will now import the simple diagnostic player
import { getCurrentProgram, getChannelById, STANDBY_PLACEHOLDER_ID } from "@/lib/supabase"
import type { Program, Channel } from "@/types"
import { ChevronLeft, RefreshCw, AlertTriangle, Loader2 } from "lucide-react"
import Link from "next/link"

export default function WatchPage() {
  const params = useParams()
  const router = useRouter()
  const channelId = params.channelId as string

  const [currentProgram, setCurrentProgram] = useState<Program | null>(null)
  const [upcomingPrograms, setUpcomingPrograms] = useState<Program[]>([])
  const [channel, setChannel] = useState<Channel | null>(null)
  const [isLoadingPage, setIsLoadingPage] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastProgramCheck, setLastProgramCheck] = useState(Date.now())

  const isInitialFetchRef = useRef(true)
  const lastProgramStringRef = useRef<string | null>(null)

  const fetchProgramData = useCallback(
    async (isManualRefresh = false) => {
      if (!channelId) return

      if (isManualRefresh || isInitialFetchRef.current) {
        setIsLoadingPage(true)
      }
      setError(null)

      try {
        const channelData = await getChannelById(channelId)
        if (!channelData) {
          setError(`Channel with ID ${channelId} not found.`)
          setIsLoadingPage(false)
          isInitialFetchRef.current = false
          return
        }
        setChannel(channelData)

        const { program: newProgramData, error: progError } = await getCurrentProgram(channelId)
        if (progError) {
          console.error("Error fetching current program:", progError)
        }

        const newProgramString = JSON.stringify(newProgramData)
        if (newProgramString !== lastProgramStringRef.current) {
          setCurrentProgram(newProgramData)
          lastProgramStringRef.current = newProgramString
        }
      } catch (e: any) {
        console.error("Failed to fetch program data:", e)
        setError(e.message || "Failed to load channel data.")
      } finally {
        setIsLoadingPage(false)
        if (isInitialFetchRef.current) {
          isInitialFetchRef.current = false
        }
        setLastProgramCheck(Date.now())
      }
    },
    [channelId],
  )

  useEffect(() => {
    if (channelId) {
      isInitialFetchRef.current = true
      lastProgramStringRef.current = null
      fetchProgramData()
    }
  }, [channelId, fetchProgramData])

  useEffect(() => {
    const interval = setInterval(() => {
      if (!isLoadingPage && Date.now() - lastProgramCheck > 25000) {
        console.log("Scheduled check for program updates...")
        fetchProgramData()
      }
    }, 30000)
    return () => clearInterval(interval)
  }, [fetchProgramData, lastProgramCheck, isLoadingPage])

  const handleProgramEnd = () => {
    console.log("WatchPage: Program ended, fetching next program...")
    fetchProgramData(true)
  }

  const handlePlayerError = (playerError: string) => {
    console.warn("WatchPage: Player reported an error:", playerError)
  }

  if (isLoadingPage && isInitialFetchRef.current) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-black text-white">
        <Loader2 className="h-12 w-12 animate-spin text-red-600 mb-4" />
        <p>Loading Channel...</p>
      </div>
    )
  }

  if (error && !channel) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-black text-white p-4">
        <AlertTriangle className="h-12 w-12 text-yellow-400 mb-4" />
        <p className="text-xl mb-2">Error</p>
        <p className="text-center mb-6">{error}</p>
        <Link href="/" className="px-6 py-2 bg-red-600 hover:bg-red-700 rounded text-white">
          Go Home
        </Link>
      </div>
    )
  }

  return (
    <div className="bg-black min-h-screen flex flex-col text-white">
      <div className="p-4 flex items-center justify-between bg-gray-900/50 sticky top-0 z-10">
        <button
          onClick={() => router.back()}
          className="p-2 rounded-full hover:bg-gray-700 transition-colors"
          aria-label="Go back"
        >
          <ChevronLeft className="h-6 w-6" />
        </button>
        <h1 className="text-xl font-semibold truncate px-2">{channel?.name || "Channel"}</h1>
        <button
          onClick={() => fetchProgramData(true)}
          className="p-2 rounded-full hover:bg-gray-700 transition-colors"
          aria-label="Refresh"
          disabled={isLoadingPage}
        >
          {isLoadingPage ? <Loader2 className="h-5 w-5 animate-spin" /> : <RefreshCw className="h-5 w-5" />}
        </button>
      </div>

      <div className="w-full aspect-video bg-black">
        {currentProgram ? (
          <VideoPlayer initialProgram={currentProgram} />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            {!isLoadingPage && <p className="text-gray-400">Checking for scheduled programs...</p>}
          </div>
        )}
      </div>

      <div className="p-4 flex-grow">
        {currentProgram ? (
          <>
            <h2 className="text-2xl font-bold">{currentProgram.title}</h2>
            <p className="text-sm text-gray-400">
              Channel: {channel?.name}
              {currentProgram.channel_id === STANDBY_PLACEHOLDER_ID && " (Standby)"}
            </p>
            {currentProgram.start_time && currentProgram.channel_id !== STANDBY_PLACEHOLDER_ID && (
              <p className="text-sm text-gray-400">
                Started: {new Date(currentProgram.start_time).toLocaleTimeString()}
              </p>
            )}
          </>
        ) : null}

        {upcomingPrograms.length > 0 && (
          <div className="mt-6">
            <h3 className="text-xl font-semibold mb-2">Up Next</h3>
            <ul className="space-y-2">
              {upcomingPrograms.map((prog) => (
                <li key={prog.id} className="p-3 bg-gray-800 rounded-lg shadow">
                  <p className="font-medium text-white">{prog.title}</p>
                  <p className="text-xs text-gray-400">
                    Starts at:{" "}
                    {new Date(prog.start_time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  )
}
