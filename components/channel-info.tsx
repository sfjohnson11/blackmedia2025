import type { Channel, Program } from "@/types"
import { cleanChannelName, cleanChannelDescription } from "@/lib/utils"
import { isLiveChannel } from "@/lib/supabase"

interface ChannelInfoProps {
  channel: Channel
  currentProgram?: Program | null
}

export function ChannelInfo({ channel, currentProgram }: ChannelInfoProps) {
  const cleanedName = cleanChannelName(channel.name)

  return (
    <div className="max-w-4xl">
      <h1 className="text-3xl font-bold mb-2">
        {cleanedName}
        {isLiveChannel(channel.id) && (
          <span className="ml-3 bg-red-600 text-white text-xs px-2 py-1 rounded inline-flex items-center align-middle">
            <span className="w-2 h-2 bg-white rounded-full mr-1 animate-pulse"></span>
            LIVE
          </span>
        )}
      </h1>
      {channel.description && <p className="text-gray-300 mb-4">{cleanChannelDescription(channel.description)}</p>}

      {currentProgram && (
        <div className="bg-gray-800 p-4 rounded-lg mb-4">
          <h2 className="text-xl font-semibold mb-2">{isLiveChannel(channel.id) ? "Live Broadcast" : "Now Playing"}</h2>
          <h3 className="font-bold">{currentProgram.title}</h3>
          <div className="flex items-center text-sm text-gray-400 mt-1">
            {isLiveChannel(channel.id) ? (
              <span className="flex items-center">
                <span className="w-2 h-2 bg-red-500 rounded-full mr-2 animate-pulse"></span>
                Live from desktop
              </span>
            ) : (
              <span>
                Started at{" "}
                {new Date(currentProgram.start_time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </span>
            )}
          </div>
        </div>
      )}

      <div className="flex items-center space-x-2 text-sm text-gray-400">
        <span>24/7 Streaming</span>
        <span>•</span>
        <span>Channel {channel.id}</span>
      </div>
    </div>
  )
}
