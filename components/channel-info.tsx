import type { Channel, Program } from "@/types"

interface ChannelInfoProps {
  channel: Channel
  currentProgram?: Program | null
}

export function ChannelInfo({ channel, currentProgram }: ChannelInfoProps) {
  return (
    <div className="max-w-4xl">
      <h1 className="text-3xl font-bold mb-2">{channel.name}</h1>
      {channel.description && <p className="text-gray-300 mb-4">{channel.description}</p>}

      {currentProgram && (
        <div className="bg-gray-800 p-4 rounded-lg mb-4">
          <h2 className="text-xl font-semibold mb-2">Now Playing</h2>
          <h3 className="font-bold">{currentProgram.title}</h3>
          <div className="flex items-center text-sm text-gray-400 mt-1">
            <span>
              Started at{" "}
              {new Date(currentProgram.start_time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </span>
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
