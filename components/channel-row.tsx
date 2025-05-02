import type { Channel } from "@/types"
import { ChannelCard } from "@/components/channel-card"

interface ChannelRowProps {
  channels: Channel[]
}

export function ChannelRow({ channels }: ChannelRowProps) {
  return (
    <div className="netflix-row">
      <div className="flex space-x-4 overflow-x-scroll scrollbar-hide pb-4">
        {channels.map((channel) => (
          <ChannelCard key={channel.id} channel={channel} />
        ))}
      </div>
    </div>
  )
}
