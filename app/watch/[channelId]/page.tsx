// app/watch/[channelId]/page.tsx
'use client'

import { supabase } from "@/lib/supabase"
import VideoPlayer from "@/components/VideoPlayer"
import { notFound } from "next/navigation"
import { FavoriteToggle } from "@/components/favorite-toggle"

export default async function WatchPage({
  params,
  searchParams,
}: {
  params: { channelId: string }
  searchParams?: { video?: string }
}) {
  const channelId = params.channelId
  const override = searchParams?.video
  const now = new Date().toISOString()

  const { data: allPrograms, error } = await supabase
    .from("programs")
    .select("*")
    .eq("channel_id", channelId)

  if (error || !allPrograms) {
    return (
      <div className="p-10 text-center text-red-500">
        Failed to load programs.
      </div>
    )
  }

  let program = null

  if (override) {
    program = allPrograms.find((p) => p.mp4_url === override)
  } else {
    const nowISO = new Date().toISOString()
    program = allPrograms.find((p) => p.start_time <= nowISO && p.end_time >= nowISO)
  }

  if (!program) {
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
      <div className="mt-6">
        <FavoriteToggle programId={program.id} />
      </div>
    </div>
  )
}
