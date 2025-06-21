// No changes to app/page.tsx from the previous version I provided,
// assuming you're still using the workaround version of getFeaturedPrograms
// until the schema issue is resolved.
// If the SQL script (002) runs successfully, you can revert getFeaturedPrograms
// to use the direct `channels(*)` join.

import { supabase } from "@/lib/supabase"
import type { Channel, Program } from "@/types"
import { ChannelCarousel } from "@/components/channel-carousel"
import { FeaturedChannel } from "@/components/featured-channel"
import { BreakingNews } from "@/components/breaking-news"
import Link from "next/link"

async function getChannels() {
  try {
    const { data, error } = await supabase.from("channels").select("*")

    if (error) {
      console.error("Error fetching channels:", error)
      return []
    }

    return (data as Channel[]).sort((a, b) => {
      const aNum = Number.parseInt(a.id, 10)
      const bNum = Number.parseInt(b.id, 10)
      return aNum - bNum
    })
  } catch (error) {
    console.error("Error fetching channels:", error)
    return []
  }
}

// Using the workaround version of getFeaturedPrograms
async function getFeaturedPrograms() {
  try {
    const { data: programsData, error: programsError } = await supabase
      .from("programs")
      .select("*")
      .order("start_time", { ascending: false })
      .limit(5)

    if (programsError) {
      console.error("Error fetching featured programs (step 1):", programsError.message)
      return []
    }
    if (!programsData || programsData.length === 0) {
      return []
    }

    const channelIds = [
      ...new Set(programsData.map((p) => p.channel_id).filter((id) => id !== null && id !== undefined) as string[]),
    ]

    if (channelIds.length === 0) {
      return programsData.map((p) => ({ ...p, channels: null })) as (Program & { channels: Channel | null })[]
    }

    const { data: channelsData, error: channelsError } = await supabase
      .from("channels")
      .select("*")
      .in("id", channelIds)

    if (channelsError) {
      console.error("Error fetching channel details for featured programs (step 2):", channelsError.message)
      return programsData.map((p) => ({ ...p, channels: null })) as (Program & { channels: Channel | null })[]
    }

    if (!channelsData) {
      console.warn("No channel data returned for featured programs channel IDs.")
      return programsData.map((p) => ({ ...p, channels: null })) as (Program & { channels: Channel | null })[]
    }

    const channelsMap = new Map(channelsData.map((c) => [c.id, c]))

    const featuredProgramsWithChannels = programsData.map((program) => ({
      ...program,
      channels: program.channel_id ? channelsMap.get(String(program.channel_id)) || null : null,
    }))

    return featuredProgramsWithChannels as (Program & { channels: Channel | null })[]
  } catch (error) {
    const message = error instanceof Error ? error.message : "An unknown error occurred"
    console.error("Error in getFeaturedPrograms (outer catch):", message)
    return []
  }
}

export default async function Home() {
  const channels = await getChannels()
  const featuredPrograms = await getFeaturedPrograms()

  if (channels.length === 0) {
    return (
      <div className="pt-4 px-4 md:px-10 flex items-center justify-center min-h-[80vh]">
        <div className="bg-gray-800 p-6 rounded-lg max-w-md w-full text-center">
          <h2 className="text-xl font-semibold mb-4">Welcome to Black Truth TV</h2>
          <p className="mb-4">No channels found. Please complete the setup to get started.</p>
          <Link href="/setup" className="text-red-500 hover:underline">
            Go to Setup
          </Link>
        </div>
      </div>
    )
  }

  const randomIndex = Math.floor(Math.random() * channels.length)
  const featuredChannel = channels[randomIndex]

  const popularChannels = channels.slice(0, 10)
  const newsChannels = channels.filter(
    (c) => c.name.toLowerCase().includes("news") || c.description?.toLowerCase().includes("news"),
  )
  const entertainmentChannels = channels.filter(
    (c) => c.name.toLowerCase().includes("entertainment") || c.description?.toLowerCase().includes("entertainment"),
  )
  const remainingChannels = channels.filter(
    (c) => !newsChannels.includes(c) && !entertainmentChannels.includes(c) && c.id !== featuredChannel.id,
  )

  return (
    <div className="flex flex-col">
      <BreakingNews />
      <div>
        <FeaturedChannel channel={featuredChannel} />
        <section className="px-4 md:px-10 pb-10 -mt-16 relative z-10">
          <ChannelCarousel
            title="Popular Channels"
            channels={popularChannels}
            autoScroll={true}
            autoScrollInterval={6000}
          />
          {newsChannels.length > 0 && (
            <ChannelCarousel title="News" channels={newsChannels} autoScroll={true} autoScrollInterval={8000} />
          )}
          {entertainmentChannels.length > 0 && (
            <ChannelCarousel
              title="Entertainment"
              channels={entertainmentChannels}
              autoScroll={true}
              autoScrollInterval={7000}
            />
          )}
          {remainingChannels.length > 0 && (
            <ChannelCarousel title="More Channels" channels={remainingChannels} autoScroll={false} />
          )}
          <div className="flex justify-center mt-8">
            <Link href="/channels" className="text-gray-400 hover:text-white transition-colors">
              View All Channels
            </Link>
          </div>
        </section>
      </div>
    </div>
  )
}
