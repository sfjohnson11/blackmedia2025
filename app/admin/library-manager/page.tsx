"use client"

import type React from "react"
import { useState, useEffect, useCallback } from "react"
import { supabase } from "@/lib/supabase"
import type { Channel, LibraryItemData } from "@/types"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { AlertCircle, CheckCircle2, Upload, Loader2, ArrowLeft, ListChecks, PlusCircle } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Progress } from "@/components/ui/progress"
import Link from "next/link"

const MEDIA_BUCKET = "library-media"
const THUMBNAIL_BUCKET = "library-thumbnails"

export default function LibraryManagerPage() {
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [type, setType] = useState<"document" | "audio" | "video">("video")
  const [mediaFile, setMediaFile] = useState<File | null>(null)
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null)
  const [mediaUrl, setMediaUrl] = useState("") // For manually entering URL
  const [thumbnailUrl, setThumbnailUrl] = useState("") // For manually entering URL
  const [content, setContent] = useState("") // For document text
  const [channels, setChannels] = useState<Channel[]>([])
  const [selectedChannelId, setSelectedChannelId] = useState<string | null>("") // Updated default value

  const [loading, setLoading] = useState<boolean>(false)
  const [progress, setProgress] = useState<number>(0)
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)

  const [libraryItems, setLibraryItems] = useState<LibraryItemData[]>([])
  const [view, setView] = useState<"form" | "list">("list")

  const fetchChannels = useCallback(async () => {
    const { data, error } = await supabase.from("channels").select("id, name").order("name")
    if (error) {
      console.error("Error fetching channels:", error)
      setMessage({ type: "error", text: "Failed to load channels." })
    } else {
      setChannels((data as Channel[]) || [])
    }
  }, [])

  const fetchLibraryItems = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase.from("library_items").select("*").order("created_at", { ascending: false })

    if (error) {
      console.error("Error fetching library items:", error)
      setMessage({ type: "error", text: "Failed to load library items." })
    } else {
      setLibraryItems((data as LibraryItemData[]) || [])
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchChannels()
    fetchLibraryItems()
  }, [fetchChannels, fetchLibraryItems])

  const resetForm = () => {
    setTitle("")
    setDescription("")
    setType("video")
    setMediaFile(null)
    setThumbnailFile(null)
    setMediaUrl("")
    setThumbnailUrl("")
    setContent("")
    setSelectedChannelId("") // Updated default value
    setMessage(null)
    setProgress(0)
    // Clear file inputs
    const mediaInput = document.getElementById("mediaFile") as HTMLInputElement
    if (mediaInput) mediaInput.value = ""
    const thumbInput = document.getElementById("thumbnailFile") as HTMLInputElement
    if (thumbInput) thumbInput.value = ""
  }

  const handleFileUpload = async (file: File, bucket: string): Promise<string | null> => {
    const fileExt = file.name.split(".").pop()
    const fileName = `${Date.now()}.${fileExt}`
    const filePath = `${fileName}` // Store at root of bucket for simplicity

    setProgress((prev) => prev + 10)
    const { error: uploadError, data: uploadData } = await supabase.storage.from(bucket).upload(filePath, file, {
      cacheControl: "3600",
      upsert: false, // Don't upsert to avoid accidental overwrites if names collide, though unlikely with timestamp
    })

    if (uploadError) {
      throw new Error(`Failed to upload ${file.name} to ${bucket}: ${uploadError.message}`)
    }

    // Construct public URL. Assumes getFullUrl can handle paths that already include the bucket if needed,
    // or we can construct it manually. For storage, it's usually base_url/storage/v1/object/public/bucket_name/file_path
    const { data: publicUrlData } = supabase.storage.from(bucket).getPublicUrl(filePath)
    if (!publicUrlData?.publicUrl) {
      throw new Error(`Could not get public URL for ${filePath} in ${bucket}.`)
    }
    return publicUrlData.publicUrl
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage(null)
    setProgress(10)

    let finalMediaUrl = mediaUrl
    let finalThumbnailUrl = thumbnailUrl
    let fileSizeMb: number | undefined = undefined
    const durationSeconds: number | undefined = undefined // You might need a way to get this, e.g. from video metadata

    try {
      // 1. Upload Media File (if provided)
      if (mediaFile) {
        if (
          type === "video" ||
          type === "audio" ||
          (type === "document" && mediaFile.type.startsWith("application/pdf"))
        ) {
          // Example for PDF documents
          finalMediaUrl = await handleFileUpload(mediaFile, MEDIA_BUCKET)
          if (!finalMediaUrl) throw new Error("Media file upload failed to return a URL.")
          fileSizeMb = Number.parseFloat((mediaFile.size / (1024 * 1024)).toFixed(2))
          // For duration, you'd typically need to process the file or use a library
          // For now, we'll leave it undefined or you can add a manual input field
        } else if (type === "document" && !mediaFile.type.startsWith("application/pdf")) {
          // Handle other document types if needed, e.g. read text content
          setMessage({ type: "error", text: "For document type, please upload PDF or fill text content." })
          setLoading(false)
          return
        }
        setProgress(40)
      } else if (!finalMediaUrl && (type === "video" || type === "audio")) {
        throw new Error("Media file or URL is required for video/audio types.")
      }

      // 2. Upload Thumbnail File (if provided)
      if (thumbnailFile) {
        finalThumbnailUrl = await handleFileUpload(thumbnailFile, THUMBNAIL_BUCKET)
        if (!finalThumbnailUrl) throw new Error("Thumbnail file upload failed to return a URL.")
        setProgress(70)
      }

      // 3. Prepare data for Supabase table
      const newItem: Omit<LibraryItemData, "id" | "date_added" | "created_at"> = {
        title,
        description,
        type,
        url: finalMediaUrl || null,
        thumbnail_url: finalThumbnailUrl || null,
        content: type === "document" && !finalMediaUrl ? content : null, // Store text content if document and no file URL
        channel_id: selectedChannelId || null,
        file_size_mb: fileSizeMb,
        duration_seconds: durationSeconds,
      }

      // 4. Insert into Supabase table
      setProgress(90)
      const { data, error: insertError } = await supabase.from("library_items").insert(newItem).select().single()

      if (insertError) {
        throw new Error(`Failed to add library item: ${insertError.message}`)
      }

      setProgress(100)
      setMessage({ type: "success", text: `Successfully added "${data.title}" to the library!` })
      setLibraryItems((prev) => [data as LibraryItemData, ...prev]) // Add to local list
      resetForm()
      setView("list") // Switch back to list view
    } catch (err: any) {
      console.error("Error submitting library item:", err)
      setMessage({ type: "error", text: err.message || "An unknown error occurred." })
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (itemId: string) => {
    if (!confirm("Are you sure you want to delete this library item? This action cannot be undone.")) {
      return
    }
    setLoading(true)
    // Note: This doesn't delete files from storage. You'd need to implement that separately if desired.
    const { error } = await supabase.from("library_items").delete().eq("id", itemId)
    if (error) {
      setMessage({ type: "error", text: `Failed to delete item: ${error.message}` })
    } else {
      setMessage({ type: "success", text: "Item deleted successfully." })
      setLibraryItems((prev) => prev.filter((item) => item.id !== itemId))
    }
    setLoading(false)
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center">
          <Link href="/admin" className="mr-4">
            <Button variant="outline" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <h1 className="text-3xl font-bold">Library Manager</h1>
        </div>
        <div>
          <Button onClick={() => setView(view === "form" ? "list" : "form")} variant="outline">
            {view === "form" ? (
              <>
                <ListChecks className="mr-2 h-4 w-4" /> View List
              </>
            ) : (
              <>
                <PlusCircle className="mr-2 h-4 w-4" /> Add New Item
              </>
            )}
          </Button>
        </div>
      </div>

      {message && (
        <Alert
          className={`mb-6 ${message.type === "success" ? "border-green-500 text-green-700 dark:text-green-400" : "border-red-500 text-red-700 dark:text-red-400"}`}
          variant={message.type === "error" ? "destructive" : undefined}
        >
          {message.type === "success" ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
          <AlertTitle>{message.type === "success" ? "Success" : "Error"}</AlertTitle>
          <AlertDescription>{message.text}</AlertDescription>
        </Alert>
      )}

      {view === "form" && (
        <Card>
          <CardHeader>
            <CardTitle>Add New Library Item</CardTitle>
            <CardDescription>Fill in the details and upload media for the library.</CardDescription>
          </CardHeader>
          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <Label htmlFor="title">
                    Title <span className="text-red-500">*</span>
                  </Label>
                  <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} required />
                </div>
                <div>
                  <Label htmlFor="type">
                    Type <span className="text-red-500">*</span>
                  </Label>
                  <Select value={type} onValueChange={(v) => setType(v as any)} required>
                    <SelectTrigger>
                      <SelectValue placeholder="Select media type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="video">Video</SelectItem>
                      <SelectItem value="audio">Audio</SelectItem>
                      <SelectItem value="document">Document</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} />
              </div>

              <div>
                <Label htmlFor="channel">Associated Channel (Optional)</Label>
                <Select value={selectedChannelId || ""} onValueChange={(v) => setSelectedChannelId(v || null)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a channel" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">None</SelectItem>
                    {channels.map((channel) => (
                      <SelectItem key={channel.id} value={channel.id}>
                        {channel.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {type === "document" && (
                <div>
                  <Label htmlFor="content">Document Text Content (if not uploading a file)</Label>
                  <Textarea
                    id="content"
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    placeholder="Paste or type document text here..."
                  />
                  <p className="text-xs text-gray-500 mt-1">Alternatively, upload a PDF file below.</p>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="mediaFile">Media File (Video, Audio, or PDF Document)</Label>
                <Input
                  id="mediaFile"
                  type="file"
                  onChange={(e) => setMediaFile(e.target.files ? e.target.files[0] : null)}
                />
                <p className="text-xs text-gray-500">Or provide a direct URL below.</p>
                <Input
                  id="mediaUrl"
                  value={mediaUrl}
                  onChange={(e) => setMediaUrl(e.target.value)}
                  placeholder="https://example.com/media.mp4"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="thumbnailFile">Thumbnail Image</Label>
                <Input
                  id="thumbnailFile"
                  type="file"
                  accept="image/*"
                  onChange={(e) => setThumbnailFile(e.target.files ? e.target.files[0] : null)}
                />
                <p className="text-xs text-gray-500">Or provide a direct URL below.</p>
                <Input
                  id="thumbnailUrl"
                  value={thumbnailUrl}
                  onChange={(e) => setThumbnailUrl(e.target.value)}
                  placeholder="https://example.com/thumbnail.jpg"
                />
              </div>

              {loading && <Progress value={progress} className="w-full" />}
            </CardContent>
            <CardFooter className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={resetForm} disabled={loading}>
                Reset
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                Add Item
              </Button>
            </CardFooter>
          </form>
        </Card>
      )}

      {view === "list" && (
        <Card>
          <CardHeader>
            <CardTitle>Existing Library Items</CardTitle>
            <CardDescription>Manage items currently in the library. Found: {libraryItems.length}</CardDescription>
          </CardHeader>
          <CardContent>
            {loading && libraryItems.length === 0 ? (
              <div className="flex justify-center items-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
              </div>
            ) : libraryItems.length === 0 ? (
              <p className="text-center text-gray-500 py-8">
                No library items found. Click "Add New Item" to get started.
              </p>
            ) : (
              <div className="space-y-4">
                {libraryItems.map((item) => (
                  <div key={item.id} className="border p-4 rounded-lg bg-gray-900/50 flex justify-between items-start">
                    <div className="flex-grow">
                      <h3 className="font-semibold text-lg">{item.title}</h3>
                      <p className="text-sm text-gray-400 capitalize">
                        {item.type} {item.channel_id ? `| Channel ID: ${item.channel_id}` : ""}
                      </p>
                      <p className="text-xs text-gray-500 break-all">Media URL: {item.url || "N/A"}</p>
                      <p className="text-xs text-gray-500 break-all">Thumbnail URL: {item.thumbnail_url || "N/A"}</p>
                      <p className="text-xs text-gray-500">Added: {new Date(item.date_added).toLocaleDateString()}</p>
                    </div>
                    <div className="ml-4 flex-shrink-0">
                      <Button variant="destructive" size="sm" onClick={() => handleDelete(item.id)} disabled={loading}>
                        Delete
                      </Button>
                      {/* Add Edit button later */}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
