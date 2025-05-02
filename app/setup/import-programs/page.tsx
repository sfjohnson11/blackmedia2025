"use client"

import { useState } from "react"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { CheckCircle, XCircle, ArrowLeft, Calendar } from "lucide-react"

interface ProgramData {
  channel_id: string
  title: string
  mp4_url: string
  start_time: string
}

export default function ImportProgramsPage() {
  const [isLoading, setIsLoading] = useState(false)
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null)
  const [programs, setPrograms] = useState<ProgramData[]>([])

  const fetchPrograms = async () => {
    setIsLoading(true)
    setResult(null)

    try {
      const response = await fetch(
        "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/BlackTruthTV_Programs_3Day_29Channels%20-%20May%202025-xL9rDOXQK8N6rz4wDwIfY4AdeunVVZ.csv",
      )

      if (!response.ok) {
        throw new Error(`Failed to fetch CSV: ${response.status} ${response.statusText}`)
      }

      const csvText = await response.text()
      const lines = csvText.split("\n")
      const headers = lines[0].split(",").map((h) => h.trim())

      const parsedPrograms: ProgramData[] = []
      for (let i = 1; i < lines.length; i++) {
        if (!lines[i].trim()) continue // Skip empty lines

        const values = lines[i].split(",")
        const program: any = {}

        headers.forEach((header, index) => {
          program[header] = values[index] ? values[index].trim() : ""
        })

        parsedPrograms.push(program)
      }

      setPrograms(parsedPrograms)
      setResult({
        success: true,
        message: `Successfully fetched ${parsedPrograms.length} programs from CSV.`,
      })
    } catch (error) {
      console.error("Error fetching programs:", error)
      setResult({
        success: false,
        message: error instanceof Error ? error.message : "An unknown error occurred",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const importPrograms = async () => {
    if (programs.length === 0) {
      setResult({
        success: false,
        message: "Please fetch programs first before importing.",
      })
      return
    }

    setIsLoading(true)
    setResult(null)

    try {
      // Format programs for import
      const programsToImport = programs.map((program) => ({
        channel_id: program.channel_id,
        title: program.title,
        mp4_url: program.mp4_url,
        start_time: program.start_time,
        duration: 3600, // Default to 1 hour if not specified
      }))

      // Clear existing programs first
      const { error: deleteError } = await supabase.from("programs").delete().gt("id", "0")

      if (deleteError) {
        throw new Error(`Error clearing existing programs: ${deleteError.message}`)
      }

      // Insert programs in batches to avoid payload size limits
      const batchSize = 100
      for (let i = 0; i < programsToImport.length; i += batchSize) {
        const batch = programsToImport.slice(i, i + batchSize)
        const { error: insertError } = await supabase.from("programs").insert(batch)

        if (insertError) {
          throw new Error(`Error importing programs batch ${i / batchSize + 1}: ${insertError.message}`)
        }
      }

      setResult({
        success: true,
        message: `Successfully imported ${programs.length} programs to Supabase.`,
      })
    } catch (error) {
      console.error("Error importing programs:", error)
      setResult({
        success: false,
        message: error instanceof Error ? error.message : "An unknown error occurred",
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="pt-24 px-4 md:px-10 flex flex-col items-center justify-center min-h-[80vh]">
      <div className="bg-gray-800 p-6 rounded-lg max-w-2xl w-full">
        <div className="flex items-center mb-6">
          <Link href="/setup" className="mr-4">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
          </Link>
          <h1 className="text-2xl font-bold">Import Program Schedule</h1>
        </div>

        <div className="mb-6">
          <p className="mb-4">
            Import your program schedule from the provided CSV file. This will replace any existing program schedule in
            your database.
          </p>

          <div className="flex flex-col gap-4 mt-6">
            <Button onClick={fetchPrograms} disabled={isLoading} className="bg-blue-600 hover:bg-blue-700 w-full">
              <Calendar className="h-4 w-4 mr-2" />
              {isLoading ? "Fetching..." : "Fetch Program Schedule from CSV"}
            </Button>

            {programs.length > 0 && (
              <div className="bg-gray-900 p-4 rounded mb-4">
                <h3 className="font-semibold mb-2">Programs Found: {programs.length}</h3>
                <div className="max-h-60 overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-700">
                        <th className="text-left py-2">Channel</th>
                        <th className="text-left py-2">Title</th>
                        <th className="text-left py-2">Start Time</th>
                      </tr>
                    </thead>
                    <tbody>
                      {programs.slice(0, 20).map((program, index) => (
                        <tr key={index} className="border-b border-gray-800">
                          <td className="py-2">{program.channel_id}</td>
                          <td className="py-2">{program.title}</td>
                          <td className="py-2">{new Date(program.start_time).toLocaleString()}</td>
                        </tr>
                      ))}
                      {programs.length > 20 && (
                        <tr>
                          <td colSpan={3} className="py-2 text-center text-gray-400">
                            ... and {programs.length - 20} more programs
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <Button
              onClick={importPrograms}
              disabled={isLoading || programs.length === 0}
              className="bg-red-600 hover:bg-red-700 w-full"
            >
              {isLoading ? "Importing..." : "Import Program Schedule to Database"}
            </Button>
          </div>

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
              {result.success && result.message.includes("imported") && (
                <div className="mt-4 text-center">
                  <Link href="/">
                    <Button className="bg-green-600 hover:bg-green-700">Go to Home Page</Button>
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
