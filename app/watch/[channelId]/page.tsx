'use client'

import { useState, useEffect } from "react"
import VideoPlayer from "@/components/video-player"
import { ChannelInfo } from "@/components/channel-info"
import { ChannelPassword } from "@/components/channel-password"
import { supabase, getCurrentProgram, getUpcomingPrograms, forceRefreshAllData } from "@/lib/supabase"
import { isPasswordProtected, hasChannelAccess } from "@/lib/channel-access"
import type { Channel, Program } from "@/types"
import Link from "next/link"
import { Loader2 } from "lucide-react"

interface WatchPageProps {
  params: {
    channelId: string
  }
}

export default function WatchPage({ params }: WatchPageProps) {
  const [channel, setChannel] = useState<Channel | null>(null)
  const [currentProgram, setCurrentProgram] = useState<Program | null>(null)
  const [upcomingPrograms, setUpcomingPrograms] = useState<Program[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [hasAccess, setHasAccess] = useState(false)
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date())

  async function fetchData(forceClear = false) {
    try {
      setLoading(true)
      setError(null)

      if (forceClear) {
        try {
          await forceRefreshAllData()
        } catch (refreshError) {
          console.warn("Error during force refresh:", refreshError)
        }
      }

      const { data, error } = await supabase.from("channels").select("*").eq("id", params.channelId).single()
      if (error) throw error

      const channelData = data as Channel
      setChannel(channelData)

      const needsPassword = isPasswordProtected(params.channelId)
      const userHasAccess = hasChannelAccess(params.channelId)

      setHasAccess(!needsPassword || userHasAccess)

      if (!needsPassword || userHasAccess) {
        const { program } = await getCurrentProgram(params.channelId)
        const { programs } = await getUpcomingPrograms(params.channelId)
        setCurrentProgram(program)
        setUpcomingPrograms(programs)
      }

      setLastRefresh(new Date())
    } catch (err) {
      console.error("Error loading channel:", err)
      setError("Failed to load channel")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData(true)
  }, [params.channelId])

  const handleAccessGranted = async () => {
    setHasAccess(true)
    const { program } = await getCurrentProgram(params.channelId)
    const { programs } = await getUpcomingPrograms(params.channelId)
    setCurrentProgram(program)
    setUpcomingPrograms(programs)
  }

  if (loading) {
    return (
      <div className="pt-4 px-4 flex items-center justify-center min-h-[80vh]">
        <div className="flex flex-col items-center">
          <Loader2 className="h-12 w-12 text-red-600 animate-spin mb-4" />
          <p className="text-xl">Loading channel...</p>
        </div>
      </div>
    )
  }

  if (error || !channel) {
    return (
      <div className="pt-4 px-4 flex items-center justify-center min-h-[80vh]">
        <div className="bg-gray-800 p-6 rounded-lg max-w-md w-full text-center">
          <h2 className="text-xl font-semibold mb-4">Channel Not Found</h2>
          <p className="mb-4">
            The channel you're looking for doesn't exist or has not been configured properly.
          </p>
          <Link href="/" className="text-red-500 hover:underline">
            Return to Home
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div>
      {hasAccess ? (
        <>
          {currentProgram?.video_url && channel?.id ? (
            <VideoPlayer
              src={`https://msllqpnxwbugvkpnquwx.supabase.co/storage/v1/object/public/${
                channel.bucket ?? `channel${channel.id}`
              }/${
                currentProgram.video_url.endsWith('.mp4')
                  ? currentProgram.video_url
                  : currentProgram.video_url + '.mp4'
              }`}
              poster={currentProgram?.poster_url}
            />
          ) : (
            <div className="text-yellow-500 text-center p-4">
              ⚠️ Video source is missing or still loading.
            </div>
          )}

          <div className="px-4 py-6">
            <h1 className="text-2xl font-bold mb-2">
              Channel {channel.id}: {channel.name}
            </h1>
            <p className="text-sm text-gray-400 mb-4">Last refreshed: {lastRefresh.toLocaleTimeString()}</p>

            <ChannelInfo channel={channel} currentProgram={currentProgram} />

            {!currentProgram && upcomingPrograms.length === 0 && (
              <div className="mt-6 bg-gray-800 p-4 rounded-lg">
                <h2 className="text-xl font-semibold mb-2">No Programs Scheduled</h2>
                <p className="text-gray-300">
                  There are no current or upcoming programs for this channel.
                </p>
              </div>
            )}

            {upcomingPrograms.length > 0 && (
              <div className="mt-8">
                <h2 className="text-xl font-bold mb-4">Upcoming Programs</h2>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {upcomingPrograms.map((program, index) => (
                    <div key={index} className="bg-gray-800 p-4 rounded-lg">
                      <h3 className="font-bold mb-2">{program.title}</h3>
                      <div className="text-sm text-gray-400">
                        {new Date(program.start_time).toLocaleDateString()} —{" "}
                        {new Date(program.start_time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </>
      ) : (
        <ChannelPassword channel={channel} onAccessGranted={handleAccessGranted} />
      )}
    </div>
  )
}
