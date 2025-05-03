"use client"

import { useState } from "react"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { ArrowLeft, CheckCircle, XCircle, ImageIcon, Upload } from "lucide-react"

export default function UploadChannelImagePage() {
  const [isLoading, setIsLoading] = useState(false)
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null)
  const [channelId, setChannelId] = useState("")
  const [channelName, setChannelName] = useState("")
  const [uploadStep, setUploadStep] = useState<string | null>(null)

  const uploadAndUpdateChannel = async () => {
    if (!channelId) {
      setResult({
        success: false,
        message: "Please enter a channel ID",
      })
      return
    }

    setIsLoading(true)
    setResult(null)

    try {
      // Step 1: Check if the channel exists
      setUploadStep("Checking channel...")
      const { data: channel, error: channelError } = await supabase
        .from("channels")
        .select("*")
        .eq("id", channelId)
        .single()

      if (channelError || !channel) {
        throw new Error(`Channel with ID ${channelId} not found`)
      }

      setChannelName(channel.name)

      // Step 2: Check if the bucket exists, create if not
      setUploadStep("Checking storage bucket...")
      const bucketName = `channel${channelId}`

      // List buckets to check if it exists
      const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets()

      if (bucketsError) {
        throw new Error(`Error checking buckets: ${bucketsError.message}`)
      }

      const bucketExists = buckets.some((bucket) => bucket.name === bucketName)

      // Create bucket if it doesn't exist
      if (!bucketExists) {
        setUploadStep("Creating storage bucket...")
        const { error: createBucketError } = await supabase.storage.createBucket(bucketName, {
          public: true,
        })

        if (createBucketError) {
          throw new Error(`Error creating bucket: ${createBucketError.message}`)
        }
      }

      // Step 3: Fetch the image from the public folder
      setUploadStep("Preparing image...")
      const imageResponse = await fetch("/images/panthers-vanguard.jpeg")
      const imageBlob = await imageResponse.blob()

      // Step 4: Upload the image to Supabase storage
      setUploadStep("Uploading image to Supabase...")
      const fileName = "panthers-vanguard.jpeg"
      const { error: uploadError } = await supabase.storage.from(bucketName).upload(fileName, imageBlob, {
        upsert: true,
        contentType: "image/jpeg",
      })

      if (uploadError) {
        throw new Error(`Error uploading image: ${uploadError.message}`)
      }

      // Step 5: Get the public URL
      const { data: publicUrlData } = supabase.storage.from(bucketName).getPublicUrl(fileName)

      const imageUrl = publicUrlData.publicUrl

      // Step 6: Update the channel with the new image URL
      setUploadStep("Updating channel record...")
      const { error: updateError } = await supabase.from("channels").update({ logo_url: imageUrl }).eq("id", channelId)

      if (updateError) {
        throw new Error(`Error updating channel: ${updateError.message}`)
      }

      setResult({
        success: true,
        message: `Successfully uploaded image and updated channel ${channelId}: ${channel.name}`,
      })
    } catch (error) {
      console.error("Error in upload process:", error)
      setResult({
        success: false,
        message: error instanceof Error ? error.message : "An unknown error occurred",
      })
    } finally {
      setIsLoading(false)
      setUploadStep(null)
    }
  }

  return (
    <div className="pt-24 px-4 md:px-10 flex flex-col items-center justify-center min-h-[80vh]">
      <div className="bg-gray-800 p-6 rounded-lg max-w-2xl w-full">
        <div className="flex items-center mb-6">
          <Link href="/" className="mr-4">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
          </Link>
          <h1 className="text-2xl font-bold">Upload Channel Image to Supabase</h1>
        </div>

        <div className="mb-6">
          <p className="mb-4">
            This tool will upload the Black Panthers image to a Supabase storage bucket for your channel and update the
            channel record.
          </p>

          <div className="bg-gray-900 p-4 rounded mb-6">
            <h3 className="font-semibold mb-2 flex items-center">
              <ImageIcon className="h-4 w-4 mr-2" />
              Image to Upload
            </h3>
            <div className="aspect-video bg-black rounded overflow-hidden">
              <img src="/images/panthers-vanguard.jpeg" alt="Black Panthers" className="w-full h-full object-cover" />
            </div>
          </div>

          <div className="mb-4">
            <label htmlFor="channelId" className="block text-sm font-medium mb-1">
              Enter the Channel ID for Resistance TV:
            </label>
            <input
              id="channelId"
              type="text"
              value={channelId}
              onChange={(e) => setChannelId(e.target.value)}
              placeholder="Enter channel ID (e.g., 5)"
              className="w-full p-2 bg-gray-900 border border-gray-700 rounded-md"
            />
            <p className="text-xs text-gray-400 mt-1">
              This is usually a number like 1, 2, 3, etc. Check your channels page to find the correct ID.
            </p>
          </div>

          <div className="flex justify-center">
            <Button
              onClick={uploadAndUpdateChannel}
              disabled={isLoading}
              className="bg-red-600 hover:bg-red-700 w-full max-w-xs"
            >
              {isLoading ? (
                <>
                  <Upload className="h-4 w-4 mr-2 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Upload to Supabase
                </>
              )}
            </Button>
          </div>

          {uploadStep && (
            <div className="mt-4 p-3 bg-blue-900/30 text-blue-400 rounded-md">
              <div className="flex items-center">
                <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-blue-400 mr-2"></div>
                <p>{uploadStep}</p>
              </div>
            </div>
          )}

          {result && (
            <div
              className={`mt-6 p-4 rounded-md ${
                result.success ? "bg-green-900/30 text-green-400" : "bg-red-900/30 text-red-400"
              }`}
            >
              <div className="flex items-center gap-2">
                {result.success ? <CheckCircle className="h-5 w-5" /> : <XCircle className="h-5 w-5" />}
                <p>{result.message}</p>
              </div>
              {result.success && (
                <div className="mt-4 text-center">
                  <p className="mb-2">
                    The image has been uploaded to Supabase and linked to channel: <strong>{channelName}</strong>
                  </p>
                  <Link href="/">
                    <Button className="bg-green-600 hover:bg-green-700">Return to Home</Button>
                  </Link>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
