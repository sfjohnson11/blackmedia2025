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

  useEffect(() => {
    fetchData(true)
  }, [params.channelId])

  const fetchData = async (force = false) => {
    try {
      setLoading(true)
      setError(null)

      if (force) {
        await forceRefreshAllData().catch(() => {})
      }

      const { data, error } = await supabase
        .from("channels")
        .select("*")
        .eq("id", params.channelId)
        .single()

      if (error) throw error

      setChannel(data)

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
      setError("Failed to load channel.")
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleAccessGranted = async () => {
    setHasAccess(true)
    const { program } = await getCurrentProgram(params.channelId)
    const { programs } = await getUpcomingPrograms(params.channelId)

    setCurrentProgram(program)
    setUpcomingPrograms(programs)
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[80vh] px-4">
        <Loader2 className="h-12 w-12 text-red-600 animate-spin mb-4" />
        <p className="text-xl ml-4">Loading channel...</p>
      </div>
    )
  }

  if (error || !channel) {
    return (
      <div className="pt-4 px-4 flex items-center justify-center min-h-[80vh]">
        <div className="bg-gray-800 p-6 rounded-lg text-center max-w-md">
          <h2 className="text-xl font-semibold mb-4">Channel Not Found</h2>
          <p className="mb-4">The channel is missing or not configured correctly.</p>
          <Link href="/" className="text-red-500 hover:underline">
            Return to Home
          </Link>
        </div>
      </div>
    )
  }

  // ✅ Always use this video path logic
  const videoPath = `https://msllqpnxwbugvkpnquwx.supabase.co/storage/v1/object/public/channel${channel.id}/${
    currentProgram?.video_url?.endsWith('.mp4')
      ? currentProgram.video_url
      : currentProgram?.video_url + '.mp4' || 'standby_blacktruthtv.mp4'
  }`

  return (
    <div>
      {hasAccess ? (
        <>
          <VideoPlayer
            src={videoPath}
            poster={currentProgram?.poster_url}
          />

          <div className="px-4 py-6">
            <h1 className="text-2xl font-bold mb-2">
              Channel {channel.id}: {channel.name}
            </h1>
            <p className="text-sm text-gray-400 mb-4">
              Last refreshed: {lastRefresh.toLocaleTimeString()}
            </p>

            <ChannelInfo channel={channel} currentProgram={currentProgram} />

            {!currentProgram && upcomingPrograms.length === 0 && (
              <div className="mt-6 bg-gray-800 p-4 rounded-lg">
                <h2 className="text-xl font-semibold mb-2">No Programs Scheduled</h2>
                <p className="text-gray-300">
                  Standby video is playing until scheduled programming starts.
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
                      <p className="text-sm text-gray-400">
                        {new Date(program.start_time).toLocaleDateString()} @{" "}
                        {new Date(program.start_time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </p>
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
