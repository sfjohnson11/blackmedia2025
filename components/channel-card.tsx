import Link from "next/link"
import type { Channel } from "@/types"
import { cleanChannelName } from "@/lib/utils"

interface ChannelCardProps {
  channel: Channel
}

export function ChannelCard({ channel }: ChannelCardProps) {
  const cleanedName = cleanChannelName(channel.name)

  return (
    <Link href={`/watch/${channel.id}`} className="block">
      <div className="netflix-card bg-gray-800 rounded-lg overflow-hidden transition-all duration-300 hover:scale-105 hover:shadow-xl border border-gray-700 hover:border-red-500">
        <div className="relative aspect-video">
          {channel.logo_url ? (
            <img
              src={channel.logo_url || "/placeholder.svg"}
              alt={cleanedName}
              className="object-cover w-full h-full"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-gray-700 to-gray-900 flex items-center justify-center">
              <span className="text-2xl font-bold">{cleanedName.charAt(0)}</span>
            </div>
          )}

          {/* Overlay on hover */}
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/60 to-transparent opacity-0 hover:opacity-100 transition-opacity duration-300 flex items-end justify-center p-4">
            <span className="text-lg font-bold text-white">Watch Now</span>
          </div>
        </div>

        <div className="p-3">
          <h3 className="font-bold text-white truncate">{cleanedName}</h3>
          <p className="text-xs text-gray-400 mt-1">Channel {channel.id}</p>
        </div>
      </div>
    </Link>
  )
}
