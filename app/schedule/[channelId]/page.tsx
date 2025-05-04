import { createClient } from "@supabase/supabase-js"
import { notFound } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { ArrowLeft, Calendar, Clock } from "lucide-react"
import { formatTimeToLocal } from "@/lib/time-utils"

export const revalidate = 3600 // Revalidate every hour

export default async function ChannelSchedulePage({ params }: { params: { channelId: string } }) {
  const channelId = Number.parseInt(params.channelId)

  if (isNaN(channelId)) {
    notFound()
  }

  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

  // Get channel details
  const { data: channel, error: channelError } = await supabase
    .from("channels")
    .select("*")
    .eq("id", channelId)
    .single()

  if (channelError || !channel) {
    notFound()
  }

  // Get programs for this channel
  const { data: programs, error: programsError } = await supabase
    .from("programs")
    .select("*")
    .eq("channel_id", channelId)
    .order("start_time")

  if (programsError) {
    console.error("Error fetching programs:", programsError)
  }

  // Group programs by day
  const programsByDay: Record<string, any[]> = {}

  if (programs) {
    programs.forEach((program) => {
      const date = new Date(program.start_time)
      const dayKey = date.toISOString().split("T")[0]

      if (!programsByDay[dayKey]) {
        programsByDay[dayKey] = []
      }

      programsByDay[dayKey].push(program)
    })
  }

  // Format day for display
  const formatDay = (dayKey: string) => {
    const date = new Date(dayKey)
    return date.toLocaleDateString(undefined, {
      weekday: "long",
      month: "long",
      day: "numeric",
    })
  }

  return (
    <div className="min-h-screen bg-black text-white pt-24 pb-16 px-4 md:px-8">
      <div className="max-w-5xl mx-auto">
        <div className="mb-8">
          <Link href={`/watch/${channelId}`} className="inline-flex items-center text-gray-400 hover:text-white mb-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to channel
          </Link>

          <div className="flex flex-col md:flex-row md:items-center gap-6">
            <div className="w-24 h-24 relative rounded-lg overflow-hidden flex-shrink-0">
              <Image
                src={channel.image_url || "/placeholder.svg?height=96&width=96&query=channel"}
                alt={channel.name}
                fill
                className="object-cover"
              />
            </div>

            <div>
              <h1 className="text-3xl font-bold">{channel.name}</h1>
              <p className="text-gray-400 mt-2">{channel.description}</p>
            </div>
          </div>
        </div>

        <div className="flex items-center mb-6">
          <Calendar className="h-5 w-5 text-blue-500 mr-2" />
          <h2 className="text-xl font-semibold">Channel Schedule</h2>
        </div>

        {Object.keys(programsByDay).length === 0 ? (
          <div className="text-center py-16 bg-gray-900/50 rounded-lg">
            <Clock className="h-16 w-16 text-gray-700 mx-auto mb-4" />
            <h2 className="text-2xl font-medium text-gray-300 mb-2">No schedule available</h2>
            <p className="text-gray-400 max-w-md mx-auto">
              The schedule for this channel is not available at the moment
            </p>
          </div>
        ) : (
          Object.entries(programsByDay).map(([day, dayPrograms]) => (
            <div key={day} className="mb-10">
              <h3 className="text-lg font-medium text-blue-400 mb-4">{formatDay(day)}</h3>

              <div className="bg-gray-900 rounded-lg overflow-hidden">
                {dayPrograms.map((program, index) => {
                  const startTime = new Date(program.start_time)
                  const endTime = new Date(program.end_time || startTime.getTime() + 3600000) // Default 1 hour

                  return (
                    <div
                      key={program.id}
                      className={`flex flex-col md:flex-row md:items-center p-4 ${
                        index !== dayPrograms.length - 1 ? "border-b border-gray-800" : ""
                      }`}
                    >
                      <div className="md:w-32 flex-shrink-0 font-medium">{formatTimeToLocal(startTime)}</div>

                      <div className="flex-grow">
                        <h4 className="font-medium">{program.name}</h4>
                        {program.description && <p className="text-sm text-gray-400 mt-1">{program.description}</p>}
                      </div>

                      <div className="mt-2 md:mt-0 text-sm text-gray-500">
                        {Math.round((endTime.getTime() - startTime.getTime()) / 60000)} min
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
