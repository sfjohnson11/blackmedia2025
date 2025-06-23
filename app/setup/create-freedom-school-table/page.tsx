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
      // Create the freedom_school_videos table by calling the RPC
      // This RPC now includes the 'published' column in its table definition
      const { error: tableError } = await supabase.rpc("create_freedom_school_table")

      if (tableError) {
        throw new Error(`Failed to create table: ${tableError.message}`)
      }

      // Clear existing data before inserting new sample data to prevent duplicates if run multiple times
      const { error: deleteError } = await supabase.from("freedom_school_videos").delete().neq("id", 0) // delete all rows
      if (deleteError) {
        console.warn("Could not clear existing freedom school videos, continuing with insert:", deleteError.message)
        // Not throwing an error here, as the main goal is to ensure the table exists and has the sample.
        // If deletion fails, insertion might create duplicates or fail due to constraints if any were added.
      }

      // Insert a placeholder video
      const sampleVideos = [
        {
          title: "Placeholder Video",
          description: "This is a placeholder. Please upload your own content.",
          video_url: "freedom-school/placeholder.mp4", // Relative path
          thumbnail_url: "freedom-school/thumbnails/placeholder.jpg", // Relative path
          duration: 10,
          category: "General",
          is_featured: true,
          published: true, // Added published field and set to true for the placeholder
          sort_order: 1,
        },
      ]

      const { error: insertError } = await supabase.from("freedom_school_videos").insert(sampleVideos)

      if (insertError) {
        throw new Error(`Failed to insert placeholder video: ${insertError.message}`)
      }

      setResult({
        success: true,
        message: "Freedom School table created/updated successfully with placeholder data.",
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
      <h1 className="text-2xl font-bold mb-4">Create/Update Freedom School Table</h1>
      <p className="mb-6 text-gray-400">
        This will ensure the freedom_school_videos table exists with the correct schema (including the 'published'
        column) and insert fresh placeholder data. It first calls an RPC to create/update the table structure, then
        clears existing videos, and finally inserts a sample video.
      </p>

      <Button onClick={createTable} disabled={isLoading} className="mb-4">
        {isLoading ? "Processing..." : "Create/Update Table & Add Sample"}
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
