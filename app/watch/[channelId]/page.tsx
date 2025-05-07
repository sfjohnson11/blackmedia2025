'use client'

import { useState, useEffect } from 'react'
import VideoPlayer from '@/components/video-player'
import { ChannelInfo } from '@/components/channel-info'
import { ChannelPassword } from '@/components/channel-password'
import {
  supabase,
  getCurrentProgram,
  getUpcomingPrograms,
  forceRefreshAllData,
} from '@/lib/supabase'
import {
  isPasswordProtected,
  hasChannelAccess,
} from '@/lib/channel-access'
import type { Channel, Program } from '@/types'
import Link from 'next/link'
import { Loader2 } from 'lucide-react'

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

  const videoPath = currentProgram?.mp4_url
    ? `https://msllqpnxwbugvkpnquwx.supabase.co/storage/v1/object/public/channel${params.channelId}/${currentProgram.mp4_url}`
    : `https://msllqpnxwbugvkpnquwx.supabase.co/storage/v1/object/public/channel${params.channelId}/standby_blacktruthtv.mp4`

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)
        setError(null)

        const { data, error } = await supabase
          .from('channels')
          .select('*')
          .eq('id', params.channelId)
          .single()

        if (error) throw error
        setChannel(data as Channel)

        const needsPassword = isPasswordProtected(params.channelId)
        const userHasAccess = hasChannelAccess(params.channelId)
        setHasAccess(!needsPassword || userHasAccess)

        if (!needsPassword || userHasAccess) {
          const { program } = await getCurrentProgram(params.channelId)
          const { programs } = await getUpcomingPrograms(params.channelId)

          setCurrentProgram(program)
          setUpcomingPrograms(programs)
        }
      } catch (err) {
        console.error('Failed to load channel:', err)
        setError('Failed to load channel data')
      } finally {
        setLoading(false)
      }
    }

    fetchData()

    // Poll for next program every 30 seconds
    const interval = setInterval(async () => {
      const { program } = await getCurrentProgram(params.channelId)
      if (program && program.id !== currentProgram?.id) {
        setCurrentProgram(program)
        const { programs } = await getUpcomingPrograms(params.channelId)
        setUpcomingPrograms(programs)
      }
    }, 30000)

    return () => clearInterval(interval)
  }, [params.channelId, currentProgram?.id])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[80vh]">
        <Loader2 className="h-10 w-10 text-red-600 animate-spin" />
        <span className="ml-4 text-white text-lg">Loading channel...</span>
      </div>
    )
  }

  if (error || !channel) {
    return (
      <div className="text-center p-10 text-white">
        <h2 className="text-2xl font-bold mb-2">Channel Not Found</h2>
        <p>{error || 'The requested channel does not exist.'}</p>
        <Link href="/" className="text-red-500 underline mt-4 block">
          Go back home
        </Link>
      </div>
    )
  }

  return (
    <div>
      {hasAccess ? (
        <>
          <VideoPlayer src={videoPath} poster={currentProgram?.poster_url} />

          <div className="px-4 md:px-10 py-6">
            <h1 className="text-2xl font-bold mb-4">
              Channel {channel.id}: {channel.name}
            </h1>

            <ChannelInfo channel={channel} currentProgram={currentProgram} />

            {upcomingPrograms.length > 0 && (
              <div className="mt-8">
                <h2 className="text-xl font-bold mb-4">Upcoming Programs</h2>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {upcomingPrograms.map((program, index) => (
                    <div
                      key={index}
                      className="bg-gray-800 p-4 rounded-lg text-white"
                    >
                      <h3 className="font-bold mb-1">{program.title}</h3>
                      <p className="text-sm text-gray-400">
                        {new Date(program.start_time).toLocaleString()}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </>
      ) : (
        <ChannelPassword
          channel={channel}
          onAccessGranted={() => setHasAccess(true)}
        />
      )}
    </div>
  )
}
