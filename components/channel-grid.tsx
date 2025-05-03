import type { Channel } from "@/types"
import { ChannelCard } from "@/components/channel-card"

interface ChannelGridProps {
  channels: Channel[]
}

export function ChannelGrid({ channels }: ChannelGridProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
      {channels.map((channel) => (
        <ChannelCard key={channel.id} channel={channel} />
      ))}
    </div>
  )
}
