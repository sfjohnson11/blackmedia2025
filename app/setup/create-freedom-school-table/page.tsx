"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { supabase } from "@/lib/supabase"
import { AlertCircle, CheckCircle } from "lucide-react"

export default function CreateFreedomSchoolTablePage() {
  const [isLoading, setIsLoading] = useState(false)
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null)

  const createTable = async () => {
    setIsLoading(true)
    setResult(null)

    try {
      // Create the freedom_school_videos table
      const { error: tableError } = await supabase.rpc("create_freedom_school_table")

      if (tableError) {
        throw new Error(`Failed to create table: ${tableError.message}`)
      }

      // Insert a placeholder video
      const sampleVideos = [
        {
          title: "Placeholder Video",
          description: "This is a placeholder. Please upload your own content.",
          video_url: "freedom-school/placeholder.mp4",
          thumbnail_url: "freedom-school/thumbnails/placeholder.jpg",
          duration: 10,
          category: "General",
          is_featured: true,
          sort_order: 1,
        },
      ]

      const { error: insertError } = await supabase.from("freedom_school_videos").insert(sampleVideos)

      if (insertError) {
        throw new Error(`Failed to insert placeholder video: ${insertError.message}`)
      }

      setResult({
        success: true,
        message: "Freedom School table created successfully with placeholder data.",
      })
    } catch (error) {
      setResult({
        success: false,
        message: `Error: ${error instanceof Error ? error.message : String(error)}`,
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Create Freedom School Table</h1>
      <p className="mb-6 text-gray-400">
        This will create the freedom_school_videos table and insert placeholder data.
      </p>

      <Button onClick={createTable} disabled={isLoading} className="mb-4">
        {isLoading ? "Creating..." : "Create Table"}
      </Button>

      {result && (
        <div className={`p-4 rounded ${result.success ? "bg-green-900/50" : "bg-red-900/50"}`}>
          <div className="flex items-center gap-2">
            {result.success ? (
              <CheckCircle className="text-green-500" size={20} />
            ) : (
              <AlertCircle className="text-red-500" size={20} />
            )}
            <span className={result.success ? "text-green-500" : "text-red-500"}>{result.message}</span>
          </div>
        </div>
      )}
    </div>
  )
}
