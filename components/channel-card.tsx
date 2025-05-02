import Link from "next/link"
import Image from "next/image"
import type { Channel } from "@/types"

interface ChannelCardProps {
  channel: Channel
}

export function ChannelCard({ channel }: ChannelCardProps) {
  return (
    <Link href={`/watch/${channel.id}`} className="netflix-card min-w-[200px] h-[120px]">
      <div className="relative w-full h-full">
        {channel.logo_url ? (
          <Image
            src={channel.logo_url || "/placeholder.svg"}
            alt={channel.name}
            fill
            className="object-cover rounded-md"
          />
        ) : (
          <div className="w-full h-full bg-gray-800 rounded-md flex items-center justify-center">
            <span className="text-lg font-bold text-center px-2">{channel.name}</span>
          </div>
        )}

        <div className="absolute inset-0 bg-black/40 opacity-0 hover:opacity-100 transition-opacity duration-300 flex items-center justify-center rounded-md">
          <span className="text-lg font-bold text-center px-2">{channel.name}</span>
        </div>
      </div>
    </Link>
  )
}
