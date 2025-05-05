import { NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"
import { revalidatePath } from "next/cache"

export const dynamic = "force-dynamic"
export const revalidate = 0

export async function GET() {
  try {
    // Force a fresh query to the database to ensure we're not getting cached results
    const { data: channels, error: channelsError } = await supabase
      .from("channels")
      .select("*")
      .order("id")
      .headers({
        "Cache-Control": "no-cache, no-store, must-revalidate",
        Pragma: "no-cache",
        Expires: "0",
      })
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
        headers: {
          "Cache-Control": "no-cache, no-store, must-revalidate",
          Pragma: "no-cache",
          Expires: "0",
        },
      },
    )
  } catch (error) {
    console.error("Error refreshing cache:", error)
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Unknown error occurred",
      },
      { status: 500 },
    )
  }
}
