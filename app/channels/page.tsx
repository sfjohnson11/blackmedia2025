// app/channels/page.tsx
import { supabase } from "@/lib/supabase"
import type { Channel } from "@/types"
import { ChannelGrid } from "@/components/channel-grid"
import Link from "next/link"

// 🔥 Force this page to always be dynamic (no stale cache)
export const dynamic = "force-dynamic"
export const revalidate = 0

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
          <p className="mb-4">
            Please set up your database tables and add some channels to get started.
          </p>
          <Link href="/app" className="text-red-500 hover:underline">
            Return to Member Hub
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="pt-24 px-4 md:px-10 pb-10">
      {/* ===== PAGE TITLE + BUTTONS ===== */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-8 gap-3">
        <h1 className="text-3xl font-bold">All Channels</h1>

        <div className="flex flex-col sm:flex-row gap-3">
          {/* Back to Member Hub */}
          <Link href="/app">
            <button
              className="
                rounded-lg
                bg-slate-700
                px-5
                py-2.5
                text-sm
                font-semibold
                text-white
                shadow-md
                hover:bg-slate-600
                transition
                focus:outline-none
                focus:ring-2
                focus:ring-slate-400
                focus:ring-offset-2
                focus:ring-offset-black
              "
            >
              ⬅ Back to Member Hub
            </button>
          </Link>

          {/* On-Demand button */}
          <Link href="/on-demand">
            <button
              className="
                rounded-lg 
                bg-red-600 
                px-5 
                py-2.5 
                text-sm 
                font-semibold 
                text-white 
                shadow-md 
                hover:bg-red-700 
                transition 
                focus:outline-none 
                focus:ring-2 
                focus:ring-red-500 
                focus:ring-offset-2 
                focus:ring-offset-black
              "
            >
              🎬 Watch On-Demand
            </button>
          </Link>
        </div>
      </div>

      {/* ===== CHANNEL GRID ===== */}
      <ChannelGrid channels={channels} />
    </div>
  )
}
