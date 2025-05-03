import { supabase } from "@/lib/supabase"
import type { Channel } from "@/types"
import { ChannelGrid } from "@/components/channel-grid"
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

export default async function ChannelsPage() {
  const channels = await getChannels()

  if (channels.length === 0) {
    return (
      <div className="pt-24 px-4 md:px-10 flex items-center justify-center min-h-[80vh]">
        <div className="bg-gray-800 p-6 rounded-lg max-w-md w-full text-center">
          <h2 className="text-xl font-semibold mb-4">No Channels Found</h2>
          <p className="mb-4">Please set up your database tables and add some channels to get started.</p>
          <Link href="/" className="text-red-500 hover:underline">
            Return to Home
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="pt-24 px-4 md:px-10 pb-10">
      <h1 className="text-3xl font-bold mb-8">All Channels</h1>
      <ChannelGrid channels={channels} />
    </div>
  )
}
