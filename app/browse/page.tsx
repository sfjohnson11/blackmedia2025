import { supabase } from "@/lib/supabase"
import type { Channel } from "@/types"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Search, Filter } from "lucide-react"

async function getChannels() {
  try {
    const { data, error } = await supabase.from("channels").select("*").order("name")

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

export default async function BrowsePage() {
  const channels = await getChannels()

  if (channels.length === 0) {
    return (
      <div className="pt-24 px-4 md:px-10 flex items-center justify-center min-h-[80vh]">
        <div className="bg-gray-800 p-6 rounded-lg max-w-md w-full text-center">
          <h2 className="text-xl font-semibold mb-4">No Channels Found</h2>
          <p className="mb-4">Please set up your database tables and add some channels to get started.</p>
          <Link href="/setup">
            <Button className="bg-red-600 hover:bg-red-700">Go to Setup</Button>
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="pt-24 px-4 md:px-10 pb-10">
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8">
        <h1 className="text-3xl font-bold mb-4 md:mb-0">Browse All Channels</h1>

        <div className="flex space-x-4">
          <div className="relative">
            <input
              type="text"
              placeholder="Search channels..."
              className="pl-10 pr-4 py-2 bg-gray-900 border border-gray-700 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent w-full md:w-64"
            />
            <Search className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
          </div>

          <Button variant="outline" className="flex items-center gap-2">
            <Filter className="h-4 w-4" />
            <span>Filter</span>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
        {channels.map((channel) => (
          <Link key={channel.id} href={`/watch/${channel.id}`} className="block">
            <div className="bg-gray-900 rounded-lg overflow-hidden transition-transform hover:scale-105 hover:shadow-xl">
              <div className="aspect-video relative">
                {channel.logo_url ? (
                  <img
                    src={channel.logo_url || "/placeholder.svg"}
                    alt={channel.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-gray-800 flex items-center justify-center">
                    <span className="text-2xl font-bold">{channel.name.charAt(0)}</span>
                  </div>
                )}
              </div>
              <div className="p-4">
                <h3 className="font-bold text-lg mb-1 truncate">{channel.name}</h3>
                {channel.description && <p className="text-gray-400 text-sm line-clamp-2">{channel.description}</p>}
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
