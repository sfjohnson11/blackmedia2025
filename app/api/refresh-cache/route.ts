import { NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"

export async function GET() {
  try {
    // Force a fresh query to the database to ensure we're not getting cached results
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

    return NextResponse.json({
      success: true,
      message: "Cache refreshed successfully",
      timestamp,
      channelCount: channels?.length || 0,
    })
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
