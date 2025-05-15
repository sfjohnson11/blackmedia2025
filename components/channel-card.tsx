import Link from "next/link"
import type { Channel } from "@/types"
import { cleanChannelName } from "@/lib/utils"
import { isPasswordProtected } from "@/lib/channel-access"
import { Lock } from "lucide-react"

interface ChannelCardProps {
  channel: Channel
}

export function ChannelCard({ channel }: ChannelCardProps) {
  const cleanedName = cleanChannelName(channel.name)
  const needsPassword = isPasswordProtected(channel.id)

  // Generate dynamic placeholder if no logo is set
  const imageUrl =
    channel.logo_url ||
    `https://placehold.co/400x225?text=${encodeURIComponent(channel.name)}`

  return (
    <Link href={`/watch/${channel.id}`} className="block">
      <div className="netflix-card bg-gray-800 rounded-lg overflow-hidden transition-all duration-300 hover:scale-105 hover:shadow-xl border border-gray-700 hover:border-red-500">
        <div className="relative aspect-video">
          <img
            src={imageUrl}
            alt={cleanedName}
            className="object-cover w-full h-full"
          />

          {/* Password protection indicator */}
          {needsPassword && (
            <div className="absolute top-2 right-2 bg-black/70 p-1.5 rounded-full">
              <Lock className="h-4 w-4 text-red-500" />
            </div>
          )}

          {/* Overlay on hover */}
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/60 to-transparent opacity-0 hover:opacity-100 transition-opacity duration-300 flex items-end justify-center p-4">
            <span className="text-lg font-bold text-white">
              {needsPassword ? "Password Protected" : "Watch Now"}
            </span>
          </div>
        </div>

        <div className="p-3">
          <h3 className="font-bold text-white truncate">{cleanedName}</h3>
          <p className="text-xs text-gray-400 mt-1">
            Channel {channel.id}
            {needsPassword && (
              <span className="ml-2 inline-flex items-center">
                <Lock className="h-3 w-3 text-red-500 mr-1" />
                Protected
              </span>
            )}
          </p>
        </div>
      </div>
    </Link>
  )
}
