import { supabase } from "@/lib/supabase"
import type { Channel, Program } from "@/types"
import { ChannelCarousel } from "@/components/channel-carousel"
import { FeaturedChannel } from "@/components/featured-channel"
import Link from "next/link"

async function getChannels() {
  try {
    const { data, error } = await supabase.from("channels").select("*")

    if (error) {
      console.error("Error fetching channels:", error)
      return []
    }

    // Sort channels numerically by ID
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

  // Select a random channel to feature at the top
  const randomIndex = Math.floor(Math.random() * channels.length)
  const featuredChannel = channels[randomIndex]

  // Group channels by category (for this example, we'll just create arbitrary groups)
  const popularChannels = channels.slice(0, 10)
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
    <div>
      {/* Featured Channel Hero */}
      <FeaturedChannel channel={featuredChannel} />

      {/* Channel Rows */}
      <section className="px-4 md:px-10 pb-10 -mt-16 relative z-10">
        {/* Popular Channels - with auto-scroll enabled */}
        <ChannelCarousel
          title="Popular Channels"
          channels={popularChannels}
          autoScroll={true}
          autoScrollInterval={6000}
        />

        {/* News Channels - only show if we have some */}
        {newsChannels.length > 0 && (
          <ChannelCarousel title="News" channels={newsChannels} autoScroll={true} autoScrollInterval={8000} />
        )}

        {/* Entertainment Channels - only show if we have some */}
        {entertainmentChannels.length > 0 && (
          <ChannelCarousel
            title="Entertainment"
            channels={entertainmentChannels}
            autoScroll={true}
            autoScrollInterval={7000}
          />
        )}

        {/* More Channels */}
        {remainingChannels.length > 0 && (
          <ChannelCarousel title="More Channels" channels={remainingChannels} autoScroll={false} />
        )}

        {/* All Channels Link */}
        <div className="flex justify-center mt-8">
          <Link href="/channels" className="text-gray-400 hover:text-white transition-colors">
            View All Channels
          </Link>
        </div>
      </section>
    </div>
  )
}
