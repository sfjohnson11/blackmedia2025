import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const query = searchParams.get("q")

  if (!query || query.length < 2) {
    return NextResponse.json({ error: "Query too short" }, { status: 400 })
  }

  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

  try {
    // Search channels
    const { data: channels, error: channelsError } = await supabase
      .from("channels")
      .select("id, name, description, image_url")
      .ilike("name", `%${query}%`)
      .limit(10)

    if (channelsError) throw channelsError

    // Search programs
    const { data: programs, error: programsError } = await supabase
      .from("programs")
      .select("id, name, description, image_url")
      .ilike("name", `%${query}%`)
      .limit(10)

    if (programsError) throw programsError

    // Combine and format results
    const formattedChannels = channels.map((channel) => ({
      ...channel,
      type: "channel",
    }))

    const formattedPrograms = programs.map((program) => ({
      ...program,
      type: "program",
    }))

    // Combine and sort by relevance (simple implementation)
    const results = [...formattedChannels, ...formattedPrograms]
      .sort((a, b) => {
        // Sort by exact match first
        const aExact = a.name.toLowerCase() === query.toLowerCase()
        const bExact = b.name.toLowerCase() === query.toLowerCase()

        if (aExact && !bExact) return -1
        if (!aExact && bExact) return 1

        // Then by starts with
        const aStartsWith = a.name.toLowerCase().startsWith(query.toLowerCase())
        const bStartsWith = b.name.toLowerCase().startsWith(query.toLowerCase())

        if (aStartsWith && !bStartsWith) return -1
        if (!aStartsWith && bStartsWith) return 1

        // Then alphabetically
        return a.name.localeCompare(b.name)
      })
      .slice(0, 15) // Limit total results

    return NextResponse.json(results)
  } catch (error) {
    console.error("Search error:", error)
    return NextResponse.json({ error: "Failed to search" }, { status: 500 })
  }
}
