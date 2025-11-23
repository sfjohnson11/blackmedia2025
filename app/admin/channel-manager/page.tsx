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
  slug?: string | null
  description?: string | null
  logo_url?: string | null
  password_protected?: boolean | null
  youtube_channel_id?: string | null
}

export default function ChannelManager() {
  const [channels, setChannels] = useState<Channel[]>([])
  const [editedChannels, setEditedChannels] = useState<Record<string, Channel>>({})
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
        data.sort((a: any, b: any) => {
          const aNum = Number.parseInt(String(a.id), 10)
          const bNum = Number.parseInt(String(b.id), 10)
          return aNum - bNum
        })

        const typed = (data || []) as Channel[]
        setChannels(typed)

        // Initialize edited channels as a full copy of each row
        const initialEdited: Record<string, Channel> = {}
        typed.forEach((channel) => {
          initialEdited[channel.id] = { ...channel }
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

  // Generic field change helper
  const handleFieldChange = <K extends keyof Channel>(
    channelId: string,
    field: K,
    value: Channel[K],
  ) => {
    setEditedChannels((prev) => ({
      ...prev,
      [channelId]: {
        ...(prev[channelId] || ({} as Channel)),
        [field]: value,
      },
    }))
  }

  // Save changes
  const saveChanges = async () => {
    setIsSaving(true)
    setMessage(null)

    try {
      // Find which channels have changed (any relevant field)
      const changedChannels = channels.filter((channel) => {
        const edited = editedChannels[channel.id]
        if (!edited) return false

        return (
          edited.name !== channel.name ||
          (edited.slug || "") !== (channel.slug || "") ||
          (edited.description || "") !== (channel.description || "") ||
          (edited.logo_url || "") !== (channel.logo_url || "") ||
          (edited.youtube_channel_id || "") !== (channel.youtube_channel_id || "") ||
          (edited.password_protected ?? false) !== (channel.password_protected ?? false)
        )
      })

      if (changedChannels.length === 0) {
        setMessage({ type: "success", text: "No changes to save." })
        setIsSaving(false)
        return
      }

      // Update each changed channel with all editable fields
      const updates = changedChannels.map((channel) => {
        const edited = editedChannels[channel.id]
        return supabase
          .from("channels")
          .update({
            name: edited.name,
            slug: edited.slug ?? null,
            description: edited.description ?? null,
            logo_url: edited.logo_url ?? null,
            youtube_channel_id: edited.youtube_channel_id ?? null,
            password_protected: edited.password_protected ?? false,
          })
          .eq("id", channel.id)
      })

      await Promise.all(updates)

      // Refresh channel list
      const { data, error } = await supabase.from("channels").select("*").order("id")
      if (error) throw error

      data.sort((a: any, b: any) => {
        const aNum = Number.parseInt(String(a.id), 10)
        const bNum = Number.parseInt(String(b.id), 10)
        return aNum - bNum
      })

      const refreshed = (data || []) as Channel[]
      setChannels(refreshed)

      // Re-sync editedChannels with fresh data
      const newEdited: Record<string, Channel> = {}
      refreshed.forEach((channel) => {
        newEdited[channel.id] = { ...channel }
      })
      setEditedChannels(newEdited)

      setMessage({
        type: "success",
        text: `Successfully updated ${changedChannels.length} channel${
          changedChannels.length !== 1 ? "s" : ""
        }.`,
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
    const initialEdited: Record<string, Channel> = {}
    channels.forEach((channel) => {
      initialEdited[channel.id] = { ...channel }
    })
    setEditedChannels(initialEdited)
    setMessage(null)
  }

  // Check if any changes have been made
  const hasChanges = channels.some((channel) => {
    const edited = editedChannels[channel.id]
    if (!edited) return false
    return (
      edited.name !== channel.name ||
      (edited.slug || "") !== (channel.slug || "") ||
      (edited.description || "") !== (channel.description || "") ||
      (edited.logo_url || "") !== (channel.logo_url || "") ||
      (edited.youtube_channel_id || "") !== (channel.youtube_channel_id || "") ||
      (edited.password_protected ?? false) !== (channel.password_protected ?? false)
    )
  })

  return {
    /* outer wrapper */
  } (
    <div className="container mx-auto py-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">Channel Manager</h1>
          <p className="text-gray-400">Update channel names, slugs, logos, and other info</p>
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
          <CardTitle>Channels</CardTitle>
          <CardDescription>
            Edit channel display names, slugs, descriptions, thumbnails, and YouTube IDs.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <RefreshCw className="h-8 w-8 animate-spin text-gray-400" />
            </div>
          ) : (
            <div className="space-y-6">
              {channels.map((channel) => {
                const edited = editedChannels[channel.id] || channel
                return (
                  <div
                    key={channel.id}
                    className="rounded-md border border-slate-700 bg-slate-900/60 p-4 space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <Label className="font-bold">
                        Channel {channel.id}
                      </Label>
                      <span className="text-xs text-gray-400">
                        ID: {channel.id}
                      </span>
                    </div>

                    <div className="grid gap-3 md:grid-cols-2">
                      {/* Name */}
                      <div className="space-y-1">
                        <Label htmlFor={`name-${channel.id}`}>Name</Label>
                        <Input
                          id={`name-${channel.id}`}
                          value={edited.name || ""}
                          onChange={(e) =>
                            handleFieldChange(channel.id, "name", e.target.value)
                          }
                          className={
                            edited.name !== channel.name ? "border-yellow-500" : ""
                          }
                        />
                      </div>

                      {/* Slug */}
                      <div className="space-y-1">
                        <Label htmlFor={`slug-${channel.id}`}>Slug</Label>
                        <Input
                          id={`slug-${channel.id}`}
                          value={edited.slug || ""}
                          onChange={(e) =>
                            handleFieldChange(channel.id, "slug", e.target.value)
                          }
                          placeholder="music-only, resistance-tv, etc."
                          className={
                            (edited.slug || "") !== (channel.slug || "")
                              ? "border-yellow-500"
                              : ""
                          }
                        />
                      </div>

                      {/* Logo URL */}
                      <div className="space-y-1">
                        <Label htmlFor={`logo-${channel.id}`}>Logo URL (thumbnail)</Label>
                        <Input
                          id={`logo-${channel.id}`}
                          value={edited.logo_url || ""}
                          onChange={(e) =>
                            handleFieldChange(channel.id, "logo_url", e.target.value)
                          }
                          placeholder="https://.../object/public/channel31/..."
                          className={
                            (edited.logo_url || "") !== (channel.logo_url || "")
                              ? "border-yellow-500"
                              : ""
                          }
                        />
                        {edited.logo_url && (
                          <div className="mt-2 text-xs text-gray-400">
                            Preview:
                            <div className="mt-1 h-20 w-36 overflow-hidden rounded border border-slate-700 bg-black">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={edited.logo_url}
                                alt={edited.name || `Channel ${channel.id}`}
                                className="h-full w-full object-cover"
                              />
                            </div>
                          </div>
                        )}
                      </div>

                      {/* YouTube Channel ID */}
                      <div className="space-y-1">
                        <Label htmlFor={`yt-${channel.id}`}>YouTube Channel ID (optional)</Label>
                        <Input
                          id={`yt-${channel.id}`}
                          value={edited.youtube_channel_id || ""}
                          onChange={(e) =>
                            handleFieldChange(
                              channel.id,
                              "youtube_channel_id",
                              e.target.value,
                            )
                          }
                          placeholder="UCxxxxxxxxx…"
                          className={
                            (edited.youtube_channel_id || "") !==
                            (channel.youtube_channel_id || "")
                              ? "border-yellow-500"
                              : ""
                          }
                        />
                      </div>

                      {/* Description */}
                      <div className="space-y-1 md:col-span-2">
                        <Label htmlFor={`desc-${channel.id}`}>Description</Label>
                        <textarea
                          id={`desc-${channel.id}`}
                          value={edited.description || ""}
                          onChange={(e) =>
                            handleFieldChange(
                              channel.id,
                              "description",
                              e.target.value,
                            )
                          }
                          className="w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-sm"
                          rows={2}
                        />
                      </div>

                      {/* Password Protected */}
                      <div className="space-y-1">
                        <Label>Password Protected?</Label>
                        <div className="flex items-center gap-2 text-sm">
                          <input
                            id={`protected-${channel.id}`}
                            type="checkbox"
                            checked={!!edited.password_protected}
                            onChange={(e) =>
                              handleFieldChange(
                                channel.id,
                                "password_protected",
                                e.target.checked,
                              )
                            }
                          />
                          <span className="text-gray-300">
                            Require channel-level password
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
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
          <li>Channel IDs cannot be changed, only display name, slug, logo, etc.</li>
          <li>Use this to set channel 31’s thumbnail and any custom slugs.</li>
        </ul>
      </div>
    </div>
  )
}
