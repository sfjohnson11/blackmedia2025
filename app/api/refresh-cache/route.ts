import { NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"
import { revalidatePath } from "next/cache"

export const dynamic = "force-dynamic"
export const revalidate = 0

export async function GET() {
  try {
    // Force a fresh query to the database to ensure we're not getting cached results
    // REMOVED headers() method
    const { data: channels, error: channelsError } = await supabase
      .from("channels")
      .select("*")
      .order("id")
      .throwOnError()

    if (channelsError) {
      throw new Error(`Error fetching channels: ${channelsError.message}`)
    }

    // Get current timestamp for cache-busting
    const timestamp = new Date().toISOString()

    // Revalidate all watch pages
    revalidatePath("/watch/[channelId]")

    // Also revalidate the home page
    revalidatePath("/")

    return NextResponse.json(
      {
        success: true,
        message: "Cache refreshed successfully",
        timestamp,
        channelCount: channels?.length || 0,
      },
      {
        status: 200,
      },
    )
  } catch (error) {
    console.error("Error refreshing cache:", error)
    // Return a 200 OK instead of 500 to prevent client-side errors
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Unknown error occurred",
      },
      { status: 200 },
    )
  }
}
