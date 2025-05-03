"use client"

import { useState, useEffect } from "react"
import { VideoPlayer } from "@/components/video-player"
import { ChannelInfo } from "@/components/channel-info"
import { ChannelPassword } from "@/components/channel-password"
import { supabase, getCurrentProgram, getUpcomingPrograms } from "@/lib/supabase"
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

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true)

        // Fetch channel data
        const { data, error } = await supabase.from("channels").select("*").eq("id", params.channelId).single()

        if (error) {
          throw error
        }

        const channelData = data as Channel
        setChannel(channelData)

        // Check if channel is password protected and if user has access
        const needsPassword = isPasswordProtected(params.channelId)
        const userHasAccess = hasChannelAccess(params.channelId)

        setHasAccess(!needsPassword || userHasAccess)

        // If user has access, fetch program data
        if (!needsPassword || userHasAccess) {
          const { program } = await getCurrentProgram(params.channelId)
          const { programs } = await getUpcomingPrograms(params.channelId)

          setCurrentProgram(program)
          setUpcomingPrograms(programs)
        }
      } catch (err) {
        console.error("Error fetching channel:", err)
        setError("Failed to load channel data")
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [params.channelId])

  const handleAccessGranted = async () => {
    setHasAccess(true)

    // Fetch program data now that access is granted
    try {
      const { program } = await getCurrentProgram(params.channelId)
      const { programs } = await getUpcomingPrograms(params.channelId)

      setCurrentProgram(program)
      setUpcomingPrograms(programs)
    } catch (err) {
      console.error("Error fetching programs after access granted:", err)
    }
  }

  if (loading) {
    return (
      <div className="pt-4 px-4 md:px-10 flex items-center justify-center min-h-[80vh]">
        <div className="flex flex-col items-center">
          <Loader2 className="h-12 w-12 text-red-600 animate-spin mb-4" />
          <p className="text-xl">Loading channel...</p>
        </div>
      </div>
    )
  }

  if (error || !channel) {
    return (
      <div className="pt-4 px-4 md:px-10 flex items-center justify-center min-h-[80vh]">
        <div className="bg-gray-800 p-6 rounded-lg max-w-md w-full text-center">
          <h2 className="text-xl font-semibold mb-4">Channel Not Found</h2>
          <p className="mb-4">
            The channel you're looking for doesn't exist or the database tables haven't been set up.
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
          <VideoPlayer channel={channel} initialProgram={currentProgram} upcomingPrograms={upcomingPrograms} />
          <div className="px-4 md:px-10 py-6">
            <ChannelInfo channel={channel} currentProgram={currentProgram} />

            {!currentProgram && upcomingPrograms.length === 0 && (
              <div className="mt-6 bg-gray-800 p-4 rounded-lg">
                <h2 className="text-xl font-semibold mb-2">No Programs Scheduled</h2>
                <p className="text-gray-300">
                  There are currently no programs scheduled for this channel. Please check back later or watch another
                  channel.
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
                      <div className="flex items-center text-sm text-gray-400">
                        <span className="mr-2">{new Date(program.start_time).toLocaleDateString()}</span>
                        <span>
                          {new Date(program.start_time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </span>
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
