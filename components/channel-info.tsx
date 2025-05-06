import React from 'react'
import type { Channel, Program } from '@/types'

interface ChannelInfoProps {
  channel: Channel
  currentProgram?: Program | null
}

export const ChannelInfo: React.FC<ChannelInfoProps> = ({ channel, currentProgram }) => {
  return (
    <div className="bg-gray-900 text-white p-4 rounded-md">
      <h2 className="text-2xl font-bold mb-2">About {channel.name}</h2>
      {channel.description && <p className="mb-4 text-gray-300">{channel.description}</p>}

      {currentProgram ? (
        <div className="bg-gray-800 p-4 rounded">
          <h3 className="text-lg font-semibold mb-1">Now Playing:</h3>
          <p className="text-gray-100">{currentProgram.title}</p>
          <p className="text-gray-400 text-sm">
            Start: {new Date(currentProgram.start_time).toLocaleTimeString()} | Duration: {currentProgram.duration} seconds
          </p>
        </div>
      ) : (
        <p className="text-gray-400">No program is currently playing.</p>
      )}
    </div>
  )
}
