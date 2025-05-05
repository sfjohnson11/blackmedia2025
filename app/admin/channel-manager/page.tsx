"use client"

import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { AlertCircle, CheckCircle, RefreshCw, Save } from "lucide-react"
import Link from "next/link"

type Channel = {
  id: string
  name: string
  slug?: string
  description?: string
  logo_url?: string
  password_protected?: boolean
}

export default function ChannelManager() {
  const [channels, setChannels] = useState<Channel[]>([])
  const [editedChannels, setEditedChannels] = useState<Record<string, string>>({})
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)

  // Load all channels
  useEffect(() => {
    async function loadChannels() {
      setIsLoading(true)
      try {
        const { data, error } = await supabase.from("channels").select("*").order("id")

        if (error) throw error

        // Sort channels by ID numerically
        data.sort((a, b) => {
          const aNum = Number.parseInt(a.id, 10)
          const bNum = Number.parseInt(b.id, 10)
          return aNum - bNum
        })

        setChannels(data || [])

        // Initialize edited channels with current names
        const initialEdited: Record<string, string> = {}
        data?.forEach((channel) => {
          initialEdited[channel.id] = channel.name
        })
        setEditedChannels(initialEdited)
      } catch (error) {
        console.error("Error loading channels:", error)
        setMessage({
          type: "error",
          text: "Failed to load channels. Please try again.",
        })
      } finally {
        setIsLoading(false)
      }
    }

    loadChannels()
  }, [])

  // Handle input change
  const handleNameChange = (channelId: string, newName: string) => {
    setEditedChannels((prev) => ({
      ...prev,
      [channelId]: newName,
    }))
  }

  // Save changes
  const saveChanges = async () => {
    setIsSaving(true)
    setMessage(null)

    try {
      // Find which channels have changed
      const changedChannels = channels.filter((channel) => editedChannels[channel.id] !== channel.name)

      if (changedChannels.length === 0) {
        setMessage({ type: "success", text: "No changes to save." })
        setIsSaving(false)
        return
      }

      // Update each changed channel
      const updates = changedChannels.map((channel) =>
        supabase.from("channels").update({ name: editedChannels[channel.id] }).eq("id", channel.id),
      )

      await Promise.all(updates)

      // Refresh channel list
      const { data, error } = await supabase.from("channels").select("*").order("id")

      if (error) throw error

      // Sort channels by ID numerically
      data.sort((a, b) => {
        const aNum = Number.parseInt(a.id, 10)
        const bNum = Number.parseInt(b.id, 10)
        return aNum - bNum
      })

      setChannels(data || [])
      setMessage({
        type: "success",
        text: `Successfully updated ${changedChannels.length} channel${changedChannels.length !== 1 ? "s" : ""}.`,
      })

      // Force refresh cache to ensure changes are visible
      try {
        await fetch("/api/refresh-cache", {
          method: "GET",
          headers: {
            "Cache-Control": "no-cache, no-store, must-revalidate",
          },
        })
      } catch (e) {
        console.warn("Failed to refresh cache, changes may not be immediately visible")
      }
    } catch (error) {
      console.error("Error saving changes:", error)
      setMessage({
        type: "error",
        text: "Failed to save changes. Please try again.",
      })
    } finally {
      setIsSaving(false)
    }
  }

  // Reset changes
  const resetChanges = () => {
    const initialEdited: Record<string, string> = {}
    channels.forEach((channel) => {
      initialEdited[channel.id] = channel.name
    })
    setEditedChannels(initialEdited)
    setMessage(null)
  }

  // Check if any changes have been made
  const hasChanges = channels.some((channel) => editedChannels[channel.id] !== channel.name)

  return (
    <div className="container mx-auto py-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">Channel Manager</h1>
          <p className="text-gray-400">Update channel names and information</p>
        </div>
        <Link href="/admin">
          <Button variant="outline">Back to Admin</Button>
        </Link>
      </div>

      {message && (
        <div
          className={`mb-6 p-4 rounded-md flex items-center gap-2 ${
            message.type === "success" ? "bg-green-900/20 text-green-400" : "bg-red-900/20 text-red-400"
          }`}
        >
          {message.type === "success" ? <CheckCircle className="h-5 w-5" /> : <AlertCircle className="h-5 w-5" />}
          {message.text}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Channel Names</CardTitle>
          <CardDescription>
            Edit channel names below. Changes will be applied throughout the application.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <RefreshCw className="h-8 w-8 animate-spin text-gray-400" />
            </div>
          ) : (
            <div className="space-y-4">
              {channels.map((channel) => (
                <div key={channel.id} className="grid grid-cols-[100px_1fr] gap-4 items-center">
                  <Label htmlFor={`channel-${channel.id}`} className="text-right font-bold">
                    Channel {channel.id}
                  </Label>
                  <Input
                    id={`channel-${channel.id}`}
                    value={editedChannels[channel.id] || ""}
                    onChange={(e) => handleNameChange(channel.id, e.target.value)}
                    className={editedChannels[channel.id] !== channel.name ? "border-yellow-500" : ""}
                  />
                </div>
              ))}
            </div>
          )}
        </CardContent>
        <CardFooter className="flex justify-between">
          <Button variant="outline" onClick={resetChanges} disabled={isLoading || isSaving || !hasChanges}>
            Reset Changes
          </Button>
          <Button
            onClick={saveChanges}
            disabled={isLoading || isSaving || !hasChanges}
            className="flex items-center gap-2"
          >
            {isSaving ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4" />
                Save Changes
              </>
            )}
          </Button>
        </CardFooter>
      </Card>

      <div className="mt-8">
        <h2 className="text-xl font-bold mb-4">Tips</h2>
        <ul className="list-disc pl-5 space-y-2 text-gray-300">
          <li>Changes will be applied immediately after saving</li>
          <li>You may need to refresh the browser to see changes on other pages</li>
          <li>Channel IDs cannot be changed, only the display names</li>
          <li>For more advanced changes, use the SQL Query Tool in the admin panel</li>
        </ul>
      </div>
    </div>
  )
}
