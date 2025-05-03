import type { Channel } from "@/types"
import { ChannelCard } from "@/components/channel-card"

interface ChannelRowProps {
  channels: Channel[]
}

export function ChannelRow({ channels }: ChannelRowProps) {
  return (
    <div className="netflix-row">
      <div className="flex space-x-5 overflow-x-scroll scrollbar-hide pb-6 pt-2">
        {channels.map((channel) => (
          <div key={channel.id} className="min-w-[220px] flex-shrink-0">
            <ChannelCard channel={channel} />
          </div>
        ))}
      </div>
    </div>
  )
}
