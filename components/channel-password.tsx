"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Lock, AlertCircle } from "lucide-react"
import { verifyChannelPassword, storeChannelAccess } from "@/lib/channel-access"
import type { Channel } from "@/types"
import { cleanChannelName } from "@/lib/utils"

interface ChannelPasswordProps {
  channel: Channel
  onAccessGranted: () => void
}

export function ChannelPassword({ channel, onAccessGranted }: ChannelPasswordProps) {
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const cleanedName = cleanChannelName(channel.name)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setError(null)

    // Verify password
    if (verifyChannelPassword(channel.id, password)) {
      // Store access in localStorage
      storeChannelAccess(channel.id)
      // Notify parent component
      onAccessGranted()
    } else {
      setError("Incorrect password. Please try again.")
    }

    setIsSubmitting(false)
  }

  return (
    <div className="w-full aspect-video bg-gray-900 flex items-center justify-center">
      <div className="bg-black/70 p-8 rounded-lg max-w-md w-full">
        <div className="flex flex-col items-center mb-6">
          <div className="w-16 h-16 bg-red-600 rounded-full flex items-center justify-center mb-4">
            <Lock className="h-8 w-8 text-white" />
          </div>
          <h2 className="text-2xl font-bold mb-2">Protected Channel</h2>
          <p className="text-gray-400 text-center">
            Channel {channel.id}: {cleanedName} requires a password to view.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="bg-red-900/30 text-red-400 p-3 rounded-md flex items-center">
              <AlertCircle className="h-5 w-5 mr-2 flex-shrink-0" />
              <p>{error}</p>
            </div>
          )}

          <div>
            <label htmlFor="channel-password" className="block text-sm font-medium mb-1">
              Enter Password
            </label>
            <input
              id="channel-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
              placeholder="Enter channel password"
              required
            />
          </div>

          <Button type="submit" className="w-full bg-red-600 hover:bg-red-700" disabled={isSubmitting}>
            {isSubmitting ? "Verifying..." : "Access Channel"}
          </Button>
        </form>

        <p className="mt-4 text-xs text-gray-500 text-center">
          If you don't have the password, please contact the channel administrator.
        </p>
      </div>
    </div>
  )
}
