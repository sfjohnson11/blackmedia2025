// app/watch/[channelId]/page.tsx
import { supabase } from "@/lib/supabase"
import VideoPlayer from "@/components/video-player"
import { notFound } from "next/navigation"

export default async function WatchPage({ params }: { params: { channelId: string } }) {
  const channelId = params.channelId

  // Get the most recent or upcoming program
  const { data: program, error } = await supabase
    .from("programs")
    .select("*")
    .eq("channel_id", channelId)
    .order("start_time", { ascending: true })
    .limit(1)
    .single()

  if (error || !program) {
    return (
      <div className="p-10 text-center text-red-500">
        No video is currently scheduled for this channel.
      </div>
    )
  }

  const videoUrl = `https://msllqpnxwbugvkpnquwx.supabase.co/storage/v1/object/public/channel${program.channel_id}/${program.mp4_url}`

  return (
    <div className="pt-20 px-4">
      <h1 className="text-2xl font-bold mb-4 text-white">{program.title}</h1>
      <VideoPlayer src={videoUrl} poster={program.poster_url} />
    </div>
  )
}
