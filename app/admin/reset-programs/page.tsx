"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { supabase } from "@/lib/supabase"
import { AlertCircle, CheckCircle } from "lucide-react"

export default function ResetProgramsPage() {
  const [isLoading, setIsLoading] = useState(false)
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null)

  const resetPrograms = async () => {
    if (!confirm("Are you sure you want to reset all programs? This will delete all existing programs.")) {
      return
    }

    setIsLoading(true)
    setResult(null)

    try {
      // First, delete all existing programs
      const { error: deleteError } = await supabase.from("programs").delete().neq("id", 0)

      if (deleteError) {
        throw new Error(`Failed to delete existing programs: ${deleteError.message}`)
      }

      // Reset the ID sequence
      const { error: resetError } = await supabase.rpc("reset_programs_id_seq")

      if (resetError) {
        throw new Error(`Failed to reset ID sequence: ${resetError.message}`)
      }

      // Create sample programs for testing
      const samplePrograms = [
        {
          channel_id: "1",
          title: "Sample Program 1",
          description: "This is a sample program for testing",
          start_time: new Date(Date.now()).toISOString(),
          duration: 300, // 5 minutes
          mp4_url: "sample/video1.mp4",
        },
        {
          channel_id: "2",
          title: "Sample Program 2",
          description: "Another sample program for testing",
          start_time: new Date(Date.now() + 3600000).toISOString(), // 1 hour from now
          duration: 600, // 10 minutes
          mp4_url: "sample/video2.mp4",
        },
      ]

      const { error: insertError } = await supabase.from("programs").insert(samplePrograms)

      if (insertError) {
        throw new Error(`Failed to insert sample programs: ${insertError.message}`)
      }

      setResult({
        success: true,
        message: "Programs reset successfully. Sample programs created.",
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
      <h1 className="text-2xl font-bold mb-4">Reset Programs</h1>
      <p className="mb-6 text-gray-400">
        This will delete all existing programs and create sample programs for testing.
        <br />
        <span className="text-red-500 font-semibold">Use with caution!</span>
      </p>

      <Button onClick={resetPrograms} disabled={isLoading} variant="destructive" className="mb-4">
        {isLoading ? "Resetting..." : "Reset All Programs"}
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
