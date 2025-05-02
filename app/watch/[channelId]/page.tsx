import { VideoPlayer } from "@/components/video-player"
import { ChannelInfo } from "@/components/channel-info"
import { supabase, getCurrentProgram, getUpcomingPrograms } from "@/lib/supabase"
import type { Channel } from "@/types"
import Link from "next/link"

interface WatchPageProps {
  params: {
    channelId: string
  }
}

async function getChannel(channelId: string) {
  try {
    const { data, error } = await supabase.from("channels").select("*").eq("id", channelId).single()

    if (error) {
      console.error("Error fetching channel:", error)
      return null
    }

    return data as Channel
  } catch (error) {
    console.error("Error fetching channel:", error)
    return null
  }
}

export default async function WatchPage({ params }: WatchPageProps) {
  const channel = await getChannel(params.channelId)

  if (!channel) {
    return (
      <div className="pt-24 px-4 md:px-10 flex items-center justify-center min-h-[80vh]">
        <div className="bg-gray-800 p-6 rounded-lg max-w-md w-full text-center">
          <h2 className="text-xl font-semibold mb-4">Channel Not Found</h2>
          <p className="mb-4">
            The channel you're looking for doesn't exist or the database tables haven't been set up.
          </p>
          <Link href="/" className="text-red-500 hover:underline">
            Return to Home
          </Link>
        </div>
      </div>
    )
  }

  // Get current program and upcoming programs
  const { program: currentProgram } = await getCurrentProgram(params.channelId)
  const { programs: upcomingPrograms } = await getUpcomingPrograms(params.channelId)

  return (
    <div className="pt-16">
      <VideoPlayer channel={channel} initialProgram={currentProgram} upcomingPrograms={upcomingPrograms} />
      <div className="px-4 md:px-10 py-6">
        <ChannelInfo channel={channel} currentProgram={currentProgram} />

        {!currentProgram && upcomingPrograms.length === 0 && (
          <div className="mt-6 bg-gray-800 p-4 rounded-lg">
            <h2 className="text-xl font-semibold mb-2">No Programs Scheduled</h2>
            <p className="text-gray-300">
              There are currently no programs scheduled for this channel. Please check back later or watch another
              channel.
            </p>
          </div>
        )}

        {upcomingPrograms.length > 0 && (
          <div className="mt-8">
            <h2 className="text-xl font-bold mb-4">Upcoming Programs</h2>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {upcomingPrograms.map((program, index) => (
                <div key={index} className="bg-gray-800 p-4 rounded-lg">
                  <h3 className="font-bold mb-2">{program.title}</h3>
                  <div className="flex items-center text-sm text-gray-400">
                    <span className="mr-2">{new Date(program.start_time).toLocaleDateString()}</span>
                    <span>
                      {new Date(program.start_time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
