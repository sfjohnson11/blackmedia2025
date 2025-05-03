import Link from "next/link"
import { Play, Info } from "lucide-react"
import type { Channel } from "@/types"
import { Button } from "@/components/ui/button"
import { cleanChannelName, cleanChannelDescription } from "@/lib/utils"

interface FeaturedChannelProps {
  channel: Channel
}

export function FeaturedChannel({ channel }: FeaturedChannelProps) {
  const cleanedName = cleanChannelName(channel.name)

  return (
    <div className="relative h-[80vh] w-full">
      {/* Background image */}
      <div className="absolute inset-0">
        {channel.logo_url ? (
          <img src={channel.logo_url || "/placeholder.svg"} alt={cleanedName} className="object-cover w-full h-full" />
        ) : (
          <div className="w-full h-full bg-gradient-to-b from-gray-900 to-black" />
        )}
        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/60 to-transparent" />
      </div>

      {/* Content */}
      <div className="relative h-full flex flex-col justify-end pb-20 px-4 md:px-10">
        <h1 className="text-4xl md:text-6xl font-bold mb-4">{cleanedName}</h1>
        <p className="text-lg max-w-2xl mb-6">
          {channel.description ? cleanChannelDescription(channel.description) : `Watch ${cleanedName} 24/7 streaming.`}
        </p>

        <div className="flex space-x-4">
          <Link href={`/watch/${channel.id}`}>
            <Button className="bg-white hover:bg-gray-200 text-gray-900 flex items-center gap-2 px-6 py-2 rounded">
              <Play className="h-5 w-5" />
              <span>Play</span>
            </Button>
          </Link>
          <Link href={`/browse`}>
            <Button
              variant="outline"
              className="bg-gray-800/80 text-white border-gray-600 hover:bg-gray-700 flex items-center gap-2 px-6 py-2 rounded"
            >
              <Info className="h-5 w-5" />
              <span>More Info</span>
            </Button>
          </Link>
        </div>
      </div>
    </div>
  )
}
