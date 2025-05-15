'use client'

import { useState, useEffect, useMemo } from 'react'
import VideoPlayer from '@/components/video-player'
import { ChannelInfo } from '@/components/channel-info'
import { ChannelPassword } from '@/components/channel-password'
import {
  supabase,
  getCurrentProgram,
  getUpcomingPrograms,
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

  const videoPath = useMemo(() => {
    return currentProgram?.mp4_url
      ? `https://msllqpnxwbugvkpnquwx.supabase.co/storage/v1/object/public/channel${params.channelId}/${currentProgram.mp4_url}`
      : `https://msllqpnxwbugvkpnquwx.supabase.co/storage/v1/object/public/channel${params.channelId}/standby_blacktruthtv.mp4`
  }, [currentProgram, params.channelId])

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

    const interval = setInterval(async () => {
      const { program } = await getCurrentProgram(params.channelId)

      if (
        (program && program.id !== currentProgram?.id) ||
        (!program && currentProgram !== null)
      ) {
        setCurrentProgram(program)
        const { programs } = await getUpcomingPrograms(params.channelId)
        setUpcomingPrograms(programs)
      }
    }, 30000)

    return () => clearInterval(interval)
  }, [params.channelId, currentProgram?.id])

  useEffect(() => {
    console.log('🎯 currentProgram:', currentProgram?.title || 'STANDBY')
    console.log('🎬 videoPath:', videoPath)
  }, [currentProgram, videoPath])

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
        <p>{error ||
