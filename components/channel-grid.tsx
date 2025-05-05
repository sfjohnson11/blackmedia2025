"use client"

import type { Channel } from "@/types"
import { ChannelCard } from "@/components/channel-card"
import { useMemo } from "react"

interface ChannelGridProps {
  channels: Channel[]
}

export function ChannelGrid({ channels }: ChannelGridProps) {
  const sortedChannels = useMemo(() => {
    return [...channels].sort((a, b) => {
      const aNum = Number.parseInt(a.id, 10)
      const bNum = Number.parseInt(b.id, 10)
      return aNum - bNum
    })
  }, [channels])

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
      {sortedChannels.map((channel) => (
        <ChannelCard key={channel.id} channel={channel} />
      ))}
    </div>
  )
}
