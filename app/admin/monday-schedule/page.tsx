"use client"

import { useState } from "react"
import Link from "next/link"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { ArrowLeft, Calendar, Clock, RefreshCw, CheckCircle, XCircle, AlertTriangle } from "lucide-react"

export default function MondaySchedulePage() {
  const [targetDate, setTargetDate] = useState<string>("")
  const [isLoading, setIsLoading] = useState(false)
  const [isPreviewLoading, setIsPreviewLoading] = useState(false)
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null)
  const [previewData, setPreviewData] = useState<any[] | null>(null)
  const [affectedPrograms, setAffectedPrograms] = useState<number | null>(null)

  // Get next Monday's date as default
  const getNextMonday = () => {
    const today = new Date()
    const day = today.getDay() // 0 is Sunday, 1 is Monday, etc.
    const daysUntilNextMonday = day === 0 ? 1 : 8 - day // If today is Sunday, next Monday is tomorrow

    const nextMonday = new Date(today)
    nextMonday.setDate(today.getDate() + daysUntilNextMonday)
    nextMonday.setHours(0, 0, 0, 0)

    return nextMonday.toISOString().split("T")[0]
  }

  // Calculate UTC time (7:00 AM) for Sacramento midnight
  const getSacramentoMidnightInUTC = (dateString: string) => {
    // Sacramento is UTC-7 during PDT, so midnight = 7:00 AM UTC
    return `${dateString}T07:00:00Z`
  }

  // Preview the changes
  const previewScheduleChanges = async () => {
    if (!targetDate) {
      setResult({
        success: false,
        message: "Please select a target Monday date",
      })
      return
    }

    setIsPreviewLoading(true)
    setResult(null)
    setPreviewData(null)

    try {
      // Get count of programs that will be affected
      const { count, error: countError } = await supabase.from("programs").select("*", { count: "exact", head: true })

      if (countError) {
        throw new Error(`Error counting programs: ${countError.message}`)
      }

      setAffectedPrograms(count || 0)

      // Get sample of programs for preview
      const { data: samplePrograms, error: sampleError } = await supabase
        .from("programs")
        .select("id, channel_id, title, start_time")
        .order("channel_id", { ascending: true })
        .order("start_time", { ascending: true })
        .limit(10)

      if (sampleError) {
        throw new Error(`Error fetching sample programs: ${sampleError.message}`)
      }

      // Get unique channel IDs
      const { data: channels, error: channelsError } = await supabase
        .from("channels")
        .select("id, name")
        .order("id", { ascending: true })

      if (channelsError) {
        throw new Error(`Error fetching channels: ${channelsError.message}`)
      }

      // Create preview data
      const utcStartTime = getSacramentoMidnightInUTC(targetDate)

      // Create preview of what the schedule will look like
      const preview = channels
        .slice(0, 5)
        .map((channel) => {
          return {
            channel_id: channel.id,
            channel_name: channel.name,
            programs: samplePrograms
              .filter((p) => p.channel_id === channel.id)
              .slice(0, 2)
              .map((program, index) => {
                // Calculate new start time based on position in sequence
                const programStartTime = new Date(utcStartTime)
                programStartTime.setHours(programStartTime.getHours() + index)

                return {
                  ...program,
                  original_start_time: program.start_time,
                  new_start_time: programStartTime.toISOString(),
                }
              }),
          }
        })
        .filter((channel) => channel.programs.length > 0)

      setPreviewData(preview)

      if (preview.length === 0) {
        setResult({
          success: false,
          message: "No programs found to preview. Please make sure you have programs in your database.",
        })
      }
    } catch (error) {
      console.error("Error previewing schedule changes:", error)
      setResult({
        success: false,
        message: error instanceof Error ? error.message : "An unknown error occurred",
      })
    } finally {
      setIsPreviewLoading(false)
    }
  }

  // Apply the schedule changes
  const applyScheduleChanges = async () => {
    if (!targetDate) {
      setResult({
        success: false,
        message: "Please select a target Monday date",
      })
      return
    }

    setIsLoading(true)
    setResult(null)

    try {
      // Get all channels
      const { data: channels, error: channelsError } = await supabase
        .from("channels")
        .select("id")
        .order("id", { ascending: true })

      if (channelsError) {
        throw new Error(`Error fetching channels: ${channelsError.message}`)
      }

      // Process each channel
      for (const channel of channels) {
        // Get all programs for this channel, ordered by their current start time
        const { data: programs, error: programsError } = await supabase
          .from("programs")
          .select("id, title, mp4_url, start_time, duration")
          .eq("channel_id", channel.id)
          .order("start_time", { ascending: true })

        if (programsError) {
          throw new Error(`Error fetching programs for channel ${channel.id}: ${programsError.message}`)
        }

        if (programs.length === 0) {
          continue // Skip channels with no programs
        }

        // Calculate new start times
        const utcStartTime = getSacramentoMidnightInUTC(targetDate)
        let currentStartTime = new Date(utcStartTime)

        for (const program of programs) {
          // Update this program's start time
          const { error: updateError } = await supabase
            .from("programs")
            .update({ start_time: currentStartTime.toISOString() })
            .eq("id", program.id)

          if (updateError) {
            throw new Error(`Error updating program ${program.id}: ${updateError.message}`)
          }

          // Calculate next start time based on duration
          const durationMs = (program.duration || 3600) * 1000 // Default to 1 hour if no duration
          currentStartTime = new Date(currentStartTime.getTime() + durationMs)
        }
      }

      setResult({
        success: true,
        message: `Successfully updated all programs to start from Monday, ${targetDate} at midnight Sacramento time (7:00 AM UTC)`,
      })
    } catch (error) {
      console.error("Error applying schedule changes:", error)
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
      <div className="bg-gray-800 p-6 rounded-lg max-w-4xl w-full">
        <div className="flex items-center mb-6">
          <Link href="/admin" className="mr-4">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Admin
            </Button>
          </Link>
          <h1 className="text-2xl font-bold">Monday Schedule Helper</h1>
        </div>

        <div className="mb-6">
          <p className="mb-4">
            This tool helps you schedule all channels to begin at midnight on Sunday night (Monday morning) in
            Sacramento time. All programs will be rescheduled to start sequentially from this time, maintaining their
            original order and duration.
          </p>

          <div className="bg-blue-900/30 p-4 rounded-md mb-6 flex">
            <Clock className="h-5 w-5 text-blue-400 mr-3 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-blue-400 mb-2">Time Zone Information</h3>
              <p className="text-gray-300">
                Midnight in Sacramento (PDT) is 7:00 AM UTC. This tool will automatically convert your local midnight to
                the correct UTC time for the database.
              </p>
            </div>
          </div>

          <div className="bg-gray-900 p-4 rounded mb-6">
            <h3 className="font-semibold mb-4 flex items-center">
              <Calendar className="h-5 w-5 mr-2 text-red-500" />
              Select Target Monday
            </h3>

            <div className="mb-4">
              <label htmlFor="targetDate" className="block text-sm font-medium mb-1">
                Monday Date:
              </label>
              <input
                id="targetDate"
                type="date"
                value={targetDate || getNextMonday()}
                onChange={(e) => setTargetDate(e.target.value)}
                className="w-full p-2 bg-gray-800 border border-gray-700 rounded-md"
              />
              <p className="text-xs text-gray-400 mt-1">
                Select the Monday you want all channels to start from. Programs will begin at midnight Sacramento time.
              </p>
            </div>

            <div className="flex justify-end">
              <Button
                onClick={previewScheduleChanges}
                disabled={isPreviewLoading}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {isPreviewLoading ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Previewing...
                  </>
                ) : (
                  "Preview Changes"
                )}
              </Button>
            </div>
          </div>

          {previewData && previewData.length > 0 && (
            <div className="bg-gray-900 p-4 rounded mb-6">
              <h3 className="font-semibold mb-4">Preview of Schedule Changes</h3>

              <div className="mb-4 bg-yellow-900/30 p-3 rounded-md flex items-start">
                <AlertTriangle className="h-5 w-5 text-yellow-500 mr-2 mt-0.5 flex-shrink-0" />
                <p className="text-sm">
                  This will update approximately <strong>{affectedPrograms}</strong> programs across all channels. Below
                  is a preview of how the first few programs will be scheduled.
                </p>
              </div>

              <div className="space-y-4 max-h-80 overflow-y-auto">
                {previewData.map((channel, index) => (
                  <div key={index} className="border border-gray-700 rounded-md p-3">
                    <h4 className="font-medium mb-2">
                      Channel {channel.channel_id}: {channel.channel_name}
                    </h4>

                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-700">
                          <th className="text-left py-2">Program</th>
                          <th className="text-left py-2">Original Start</th>
                          <th className="text-left py-2">New Start</th>
                        </tr>
                      </thead>
                      <tbody>
                        {channel.programs.map((program: any, pIndex: number) => (
                          <tr key={pIndex} className="border-b border-gray-800">
                            <td className="py-2">{program.title}</td>
                            <td className="py-2">{new Date(program.original_start_time).toLocaleString()}</td>
                            <td className="py-2 text-green-400">{new Date(program.new_start_time).toLocaleString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ))}
              </div>

              <div className="mt-6">
                <Button
                  onClick={applyScheduleChanges}
                  disabled={isLoading}
                  className="w-full bg-red-600 hover:bg-red-700"
                >
                  {isLoading ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      Updating Schedule...
                    </>
                  ) : (
                    "Apply Schedule Changes"
                  )}
                </Button>
                <p className="text-xs text-center text-gray-400 mt-2">
                  This action will update all programs in your database. It cannot be undone.
                </p>
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
                  <Link href="/admin">
                    <Button className="bg-green-600 hover:bg-green-700">Return to Admin Dashboard</Button>
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
