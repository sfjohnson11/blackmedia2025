import { supabase } from "@/lib/supabase"
import type { Channel, Program } from "@/types"
import { ChannelRow } from "@/components/channel-row"
import { FeaturedChannel } from "@/components/featured-channel"
import Link from "next/link"

async function getChannels() {
  try {
    const { data, error } = await supabase.from("channels").select("*").order("id")

    if (error) {
      console.error("Error fetching channels:", error)
      return []
    }

    return data as Channel[]
  } catch (error) {
    console.error("Error fetching channels:", error)
    return []
  }
}

async function getFeaturedPrograms() {
  try {
    // Get a few recent programs to feature
    const { data, error } = await supabase
      .from("programs")
      .select("*, channels(*)")
      .order("start_time", { ascending: false })
      .limit(5)

    if (error) {
      console.error("Error fetching featured programs:", error)
      return []
    }

    return data as (Program & { channels: Channel })[]
  } catch (error) {
    console.error("Error fetching featured programs:", error)
    return []
  }
}

export default async function Home() {
  const channels = await getChannels()
  const featuredPrograms = await getFeaturedPrograms()

  // If no channels, show a simple message with link to setup
  if (channels.length === 0) {
    return (
      <div className="pt-24 px-4 md:px-10 flex items-center justify-center min-h-[80vh]">
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

  // Select a random channel to feature at the top
  const randomIndex = Math.floor(Math.random() * channels.length)
  const featuredChannel = channels[randomIndex]

  // Group channels by category (for this example, we'll just create arbitrary groups)
  const popularChannels = channels.slice(0, 5)
  const newsChannels = channels.filter(
    (c) => c.name.toLowerCase().includes("news") || c.description?.toLowerCase().includes("news"),
  )
  const entertainmentChannels = channels.filter(
    (c) => c.name.toLowerCase().includes("entertainment") || c.description?.toLowerCase().includes("entertainment"),
  )

  // If we don't have enough categorized channels, create more rows
  const remainingChannels = channels.filter(
    (c) => !newsChannels.includes(c) && !entertainmentChannels.includes(c) && c.id !== featuredChannel.id,
  )

  return (
    <div className="pt-16">
      {/* Featured Channel Hero */}
      <FeaturedChannel channel={featuredChannel} />

      {/* Channel Rows */}
      <section className="px-4 md:px-10 pb-10 -mt-16 relative z-10">
        {/* Popular Channels */}
        <div className="netflix-row">
          <h2 className="netflix-title">Popular Channels</h2>
          <ChannelRow channels={popularChannels} />
        </div>

        {/* News Channels - only show if we have some */}
        {newsChannels.length > 0 && (
          <div className="netflix-row">
            <h2 className="netflix-title">News</h2>
            <ChannelRow channels={newsChannels} />
          </div>
        )}

        {/* Entertainment Channels - only show if we have some */}
        {entertainmentChannels.length > 0 && (
          <div className="netflix-row">
            <h2 className="netflix-title">Entertainment</h2>
            <ChannelRow channels={entertainmentChannels} />
          </div>
        )}

        {/* More Channels */}
        {remainingChannels.length > 0 && (
          <div className="netflix-row">
            <h2 className="netflix-title">More Channels</h2>
            <ChannelRow channels={remainingChannels.slice(0, 5)} />
          </div>
        )}

        {/* All Channels Link */}
        <div className="flex justify-center mt-8">
          <Link href="/browse" className="text-gray-400 hover:text-white transition-colors">
            View All Channels
          </Link>
        </div>
      </section>
    </div>
  )
}
