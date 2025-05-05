import { NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"

export async function GET() {
  try {
    // Create the live_streams table if it doesn't exist
    const createTableResult = await supabase.rpc("exec_sql", {
      sql: `
        CREATE TABLE IF NOT EXISTS live_streams (
          id SERIAL PRIMARY KEY,
          channel_id TEXT UNIQUE REFERENCES channels(id),
          stream_url TEXT NOT NULL,
          is_active BOOLEAN DEFAULT true,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
      `,
    })

    if (createTableResult.error) {
      throw new Error(`Failed to create live_streams table: ${createTableResult.error.message}`)
    }

    return NextResponse.json({
      success: true,
      message: "Live streams table created successfully",
    })
  } catch (error) {
    console.error("Error setting up live streams:", error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    )
  }
}

export async function POST(request: Request) {
  try {
    const { channelId, streamUrl } = await request.json()

    if (!channelId || !streamUrl) {
      return NextResponse.json({ success: false, error: "Channel ID and stream URL are required" }, { status: 400 })
    }

    // Check if the channel exists
    const { data: channelData, error: channelError } = await supabase
      .from("channels")
      .select("id")
      .eq("id", channelId)
      .single()

    if (channelError || !channelData) {
      return NextResponse.json({ success: false, error: `Channel ${channelId} does not exist` }, { status: 404 })
    }

    // Upsert the live stream URL
    const { data, error } = await supabase.from("live_streams").upsert(
      {
        channel_id: channelId,
        stream_url: streamUrl,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "channel_id" },
    )

    if (error) {
      throw new Error(`Failed to update live stream URL: ${error.message}`)
    }

    return NextResponse.json({
      success: true,
      message: `Live stream URL for channel ${channelId} updated successfully`,
    })
  } catch (error) {
    console.error("Error updating live stream URL:", error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    )
  }
}
