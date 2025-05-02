import Image from "next/image"
import { Play, Info } from "lucide-react"
import type { Channel } from "@/types"
import { Button } from "@/components/ui/button"

interface FeaturedChannelProps {
  channel: Channel
}

export function FeaturedChannel({ channel }: FeaturedChannelProps) {
  return (
    <div className="relative h-[80vh] w-full">
      {/* Background image */}
      <div className="absolute inset-0">
        {channel.logo_url ? (
          <Image
            src={channel.logo_url || "/placeholder.svg"}
            alt={channel.name}
            fill
            className="object-cover"
            priority
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-b from-gray-900 to-black" />
        )}
        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/60 to-transparent" />
      </div>

      {/* Content */}
      <div className="relative h-full flex flex-col justify-end pb-20 px-4 md:px-10">
        <h1 className="text-4xl md:text-6xl font-bold mb-4">{channel.name}</h1>
        <p className="text-lg max-w-2xl mb-6">{channel.description || `Watch ${channel.name} 24/7 streaming.`}</p>

        <div className="flex space-x-4">
          <Button className="bg-white text-black hover:bg-gray-200 flex items-center gap-2 px-6 py-2 rounded">
            <Play className="h-5 w-5" />
            <span>Play</span>
          </Button>
          <Button variant="outline" className="flex items-center gap-2 px-6 py-2 rounded">
            <Info className="h-5 w-5" />
            <span>More Info</span>
          </Button>
        </div>
      </div>
    </div>
  )
}
