"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { AlertCircle, CheckCircle2, ImageIcon, Upload } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Progress } from "@/components/ui/progress"

export default function EasyImageUploader() {
  const [channels, setChannels] = useState<any[]>([])
  const [selectedChannel, setSelectedChannel] = useState<string>("")
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [imageUrl, setImageUrl] = useState<string>("")
  const [loading, setLoading] = useState<boolean>(false)
  const [success, setSuccess] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)
  const [progress, setProgress] = useState<number>(0)
  const [activeTab, setActiveTab] = useState<string>("upload")
  const [previewUrl, setPreviewUrl] = useState<string>("")

  // Fetch channels on component mount
  useEffect(() => {
    async function fetchChannels() {
      try {
        setLoading(true)
        const { data, error } = await supabase.from("channels").select("id, name, logo_url").order("id")

        if (error) throw error

        setChannels(data || [])
      } catch (err) {
        console.error("Error fetching channels:", err)
        setError("Failed to load channels. Please refresh the page.")
      } finally {
        setLoading(false)
      }
    }

    fetchChannels()
  }, [])

  // Update preview when channel or file changes
  useEffect(() => {
    if (selectedFile) {
      setPreviewUrl(URL.createObjectURL(selectedFile))
      return () => URL.revokeObjectURL(previewUrl)
    } else if (selectedChannel) {
      const channel = channels.find((c) => c.id === selectedChannel)
      if (channel?.logo_url) {
        setPreviewUrl(channel.logo_url)
      } else {
        setPreviewUrl("")
      }
    }
  }, [selectedFile, selectedChannel, channels])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setSelectedFile(e.target.files[0])
      setActiveTab("upload") // Switch to upload tab when file is selected
    }
  }

  const handleUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setImageUrl(e.target.value)
  }

  const handleChannelChange = (value: string) => {
    setSelectedChannel(value)
    setSelectedFile(null)
    setSuccess(false)
    setError(null)

    // Reset file input
    const fileInput = document.getElementById("image-upload") as HTMLInputElement
    if (fileInput) fileInput.value = ""

    // Show current image if available
    const channel = channels.find((c) => c.id === value)
    if (channel?.logo_url) {
      setImageUrl(channel.logo_url)
    } else {
      setImageUrl("")
    }
  }

  const uploadFile = async () => {
    if (!selectedChannel) {
      setError("Please select a channel first")
      return
    }

    if (!selectedFile) {
      setError("Please select an image file")
      return
    }

    try {
      setLoading(true)
      setProgress(10)
      setError(null)

      // Create a unique filename
      const fileExt = selectedFile.name.split(".").pop()
      const fileName = `channel-${selectedChannel}-${Date.now()}.${fileExt}`
      const filePath = `channel-images/${fileName}`

      // Upload to Supabase Storage
      setProgress(30)
      const { error: uploadError } = await supabase.storage.from("channel-images").upload(filePath, selectedFile, {
        cacheControl: "3600",
        upsert: true,
      })

      if (uploadError) throw uploadError
      setProgress(60)

      // Get the public URL
      const { data } = supabase.storage.from("channel-images").getPublicUrl(filePath)
      const publicUrl = data.publicUrl

      // Update the channel record
      setProgress(80)
      const { error: updateError } = await supabase
        .from("channels")
        .update({ logo_url: publicUrl })
        .eq("id", selectedChannel)

      if (updateError) throw updateError

      // Update local state
      setProgress(100)
      setSuccess(true)

      // Update the channels list with the new image
      setChannels(
        channels.map((channel) => (channel.id === selectedChannel ? { ...channel, logo_url: publicUrl } : channel)),
      )

      // Reset file input but keep channel selected
      setSelectedFile(null)
      const fileInput = document.getElementById("image-upload") as HTMLInputElement
      if (fileInput) fileInput.value = ""
    } catch (err: any) {
      console.error("Error uploading image:", err)
      setError(err.message || "Failed to upload image. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  const updateWithUrl = async () => {
    if (!selectedChannel) {
      setError("Please select a channel first")
      return
    }

    if (!imageUrl) {
      setError("Please enter an image URL")
      return
    }

    try {
      setLoading(true)
      setProgress(20)
      setError(null)

      // Validate URL
      try {
        new URL(imageUrl)
      } catch (e) {
        throw new Error("Please enter a valid URL")
      }

      // Check if image exists
      setProgress(40)
      const imgCheck = new Image()
      imgCheck.onload = async () => {
        try {
          // Update the channel record
          setProgress(80)
          const { error: updateError } = await supabase
            .from("channels")
            .update({ logo_url: imageUrl })
            .eq("id", selectedChannel)

          if (updateError) throw updateError

          // Update local state
          setProgress(100)
          setSuccess(true)

          // Update the channels list with the new image
          setChannels(
            channels.map((channel) => (channel.id === selectedChannel ? { ...channel, logo_url: imageUrl } : channel)),
          )

          setLoading(false)
        } catch (err: any) {
          setLoading(false)
          setError(err.message || "Failed to update channel. Please try again.")
        }
      }

      imgCheck.onerror = () => {
        setLoading(false)
        setError("The image URL is not valid or the image cannot be accessed")
      }

      imgCheck.src = imageUrl
    } catch (err: any) {
      setLoading(false)
      setError(err.message || "Failed to update channel. Please try again.")
    }
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <h1 className="text-3xl font-bold mb-2">Easy Channel Image Uploader</h1>
      <p className="text-gray-400 mb-8">Quickly add images to your channel cards</p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <Card>
          <CardHeader>
            <CardTitle>1. Select a Channel</CardTitle>
            <CardDescription>Choose which channel you want to update</CardDescription>
          </CardHeader>
          <CardContent>
            <Select value={selectedChannel} onValueChange={handleChannelChange}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select a channel" />
              </SelectTrigger>
              <SelectContent>
                {channels.map((channel) => (
                  <SelectItem key={channel.id} value={channel.id}>
                    Channel {channel.id}: {channel.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {selectedChannel && (
          <Card>
            <CardHeader>
              <CardTitle>2. Add Your Image</CardTitle>
              <CardDescription>Upload a file or use an image URL</CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="upload">Upload File</TabsTrigger>
                  <TabsTrigger value="url">Use URL</TabsTrigger>
                </TabsList>
                <TabsContent value="upload" className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="image-upload">Select Image File</Label>
                    <Input
                      id="image-upload"
                      type="file"
                      accept="image/*"
                      onChange={handleFileChange}
                      className="cursor-pointer"
                      disabled={loading}
                    />
                    <p className="text-xs text-gray-400">Recommended: JPG or PNG, 16:9 aspect ratio</p>
                  </div>
                  <Button onClick={uploadFile} disabled={!selectedFile || loading} className="w-full">
                    <Upload className="mr-2 h-4 w-4" />
                    {loading ? "Uploading..." : "Upload Image"}
                  </Button>
                </TabsContent>
                <TabsContent value="url" className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="image-url">Image URL</Label>
                    <Input
                      id="image-url"
                      type="url"
                      placeholder="https://example.com/image.jpg"
                      value={imageUrl}
                      onChange={handleUrlChange}
                      disabled={loading}
                    />
                    <p className="text-xs text-gray-400">
                      Enter a direct link to an image (must end with .jpg, .png, etc.)
                    </p>
                  </div>
                  <Button onClick={updateWithUrl} disabled={!imageUrl || loading} className="w-full">
                    <ImageIcon className="mr-2 h-4 w-4" />
                    {loading ? "Updating..." : "Use This Image"}
                  </Button>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        )}
      </div>

      {loading && (
        <Card className="mt-8">
          <CardContent className="pt-6">
            <p className="text-center mb-2">Updating channel image...</p>
            <Progress value={progress} className="h-2" />
          </CardContent>
        </Card>
      )}

      {error && (
        <Alert variant="destructive" className="mt-8">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert className="mt-8 bg-green-900/20 border-green-800 text-green-400">
          <CheckCircle2 className="h-4 w-4" />
          <AlertTitle>Success!</AlertTitle>
          <AlertDescription>
            Channel image updated successfully. The changes will be visible on your channel cards.
          </AlertDescription>
        </Alert>
      )}

      {selectedChannel && (
        <Card className="mt-8">
          <CardHeader>
            <CardTitle>Preview</CardTitle>
            <CardDescription>
              {previewUrl ? "This is how your channel card will look" : "No image selected yet"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="netflix-card bg-gray-800 rounded-lg overflow-hidden border border-gray-700">
                <div className="relative aspect-video">
                  {previewUrl ? (
                    <img
                      src={previewUrl || "/placeholder.svg"}
                      alt="Channel preview"
                      className="object-cover w-full h-full"
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-gray-700 to-gray-900 flex items-center justify-center">
                      <span className="text-2xl font-bold">
                        {channels.find((c) => c.id === selectedChannel)?.name?.charAt(0) || "?"}
                      </span>
                    </div>
                  )}
                </div>
                <div className="p-3">
                  <h3 className="font-bold text-white truncate">
                    {channels.find((c) => c.id === selectedChannel)?.name || "Channel Name"}
                  </h3>
                  <p className="text-xs text-gray-400 mt-1">Channel {selectedChannel}</p>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="font-semibold">Current Status:</h3>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Channel:</span>
                    <span>{channels.find((c) => c.id === selectedChannel)?.name || "Unknown"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Has Image:</span>
                    <span>{previewUrl ? "Yes" : "No"}</span>
                  </div>
                  {previewUrl && (
                    <div className="flex justify-between">
                      <span className="text-gray-400">Image Source:</span>
                      <span className="truncate max-w-[200px]">{selectedFile ? "Uploaded File" : "URL"}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
          <CardFooter className="bg-gray-900/50 border-t border-gray-800">
            <p className="text-xs text-gray-400">
              After updating, your changes will be visible on all channel cards throughout the app.
            </p>
          </CardFooter>
        </Card>
      )}
    </div>
  )
}
