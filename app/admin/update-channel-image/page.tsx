"use client"

import type React from "react"

import { useState } from "react"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/components/ui/use-toast"

export default function UpdateChannelImage() {
  const [channelId, setChannelId] = useState("")
  const [file, setFile] = useState<File | null>(null)
  const [channels, setChannels] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [loadingChannels, setLoadingChannels] = useState(true)
  const { toast } = useToast()

  // Fetch channels on component mount
  useState(() => {
    async function fetchChannels() {
      try {
        const { data, error } = await supabase.from("channels").select("id, name").order("id")
        if (error) throw error
        setChannels(data || [])
      } catch (error) {
        console.error("Error fetching channels:", error)
        toast({
          title: "Error",
          description: "Failed to load channels",
          variant: "destructive",
        })
      } finally {
        setLoadingChannels(false)
      }
    }

    fetchChannels()
  }, [])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0])
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!channelId) {
      toast({
        title: "Error",
        description: "Please select a channel",
        variant: "destructive",
      })
      return
    }

    if (!file) {
      toast({
        title: "Error",
        description: "Please select an image file",
        variant: "destructive",
      })
      return
    }

    setLoading(true)

    try {
      // Upload file to Supabase Storage
      const fileExt = file.name.split(".").pop()
      const fileName = `channel-${channelId}-${Date.now()}.${fileExt}`
      const filePath = `channel-images/${fileName}`

      const { error: uploadError } = await supabase.storage.from("channel-images").upload(filePath, file)

      if (uploadError) throw uploadError

      // Get public URL
      const { data } = supabase.storage.from("channel-images").getPublicUrl(filePath)

      // Update channel record with new image URL
      const { error: updateError } = await supabase
        .from("channels")
        .update({ logo_url: data.publicUrl })
        .eq("id", channelId)

      if (updateError) throw updateError

      toast({
        title: "Success",
        description: "Channel image updated successfully",
      })

      // Reset form
      setFile(null)
      setChannelId("")

      // Reset file input
      const fileInput = document.getElementById("image-upload") as HTMLInputElement
      if (fileInput) fileInput.value = ""
    } catch (error) {
      console.error("Error updating channel image:", error)
      toast({
        title: "Error",
        description: "Failed to update channel image",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="container mx-auto py-8">
      <h1 className="text-2xl font-bold mb-6">Update Channel Image</h1>

      <form onSubmit={handleSubmit} className="space-y-6 max-w-md">
        <div className="space-y-2">
          <Label htmlFor="channel">Select Channel</Label>
          <Select value={channelId} onValueChange={setChannelId}>
            <SelectTrigger id="channel" className="w-full">
              <SelectValue placeholder="Select a channel" />
            </SelectTrigger>
            <SelectContent>
              {loadingChannels ? (
                <SelectItem value="loading" disabled>
                  Loading channels...
                </SelectItem>
              ) : channels.length > 0 ? (
                channels.map((channel) => (
                  <SelectItem key={channel.id} value={channel.id}>
                    Channel {channel.id}: {channel.name}
                  </SelectItem>
                ))
              ) : (
                <SelectItem value="none" disabled>
                  No channels found
                </SelectItem>
              )}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="image-upload">Upload Image</Label>
          <Input
            id="image-upload"
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            className="cursor-pointer"
          />
          <p className="text-sm text-gray-400">Recommended: 16:9 aspect ratio, at least 1280x720px</p>
        </div>

        {file && (
          <div className="mt-4">
            <p className="text-sm mb-2">Preview:</p>
            <div className="aspect-video bg-gray-800 rounded-md overflow-hidden">
              <img
                src={URL.createObjectURL(file) || "/placeholder.svg"}
                alt="Preview"
                className="w-full h-full object-cover"
              />
            </div>
          </div>
        )}

        <Button type="submit" disabled={loading || !channelId || !file} className="w-full">
          {loading ? "Uploading..." : "Update Channel Image"}
        </Button>
      </form>
    </div>
  )
}
