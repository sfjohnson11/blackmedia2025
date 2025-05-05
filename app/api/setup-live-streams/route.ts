import { type NextRequest, NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"

// Create the live_streams table if it doesn't exist
async function createLiveStreamsTable() {
  const { error } = await supabase.rpc("create_live_streams_table", {})

  if (error && !error.message.includes("already exists")) {
    console.error("Error creating live_streams table:", error)
    throw error
  }
}

// Handle GET requests - setup table and return live streams
export async function GET() {
  try {
    // First, ensure the function exists
    await supabase.rpc("create_function_if_not_exists", {
      function_name: "create_live_streams_table",
      function_definition: `
        CREATE OR REPLACE FUNCTION create_live_streams_table()
        RETURNS void AS $$
        BEGIN
          -- Create the live_streams table if it doesn't exist
          CREATE TABLE IF NOT EXISTS live_streams (
            id SERIAL PRIMARY KEY,
            channel_id TEXT NOT NULL,
            stream_url TEXT NOT NULL,
            is_active BOOLEAN DEFAULT true,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
          );
          
          -- Create unique index on channel_id
          CREATE UNIQUE INDEX IF NOT EXISTS live_streams_channel_id_idx ON live_streams (channel_id);
        END;
        $$ LANGUAGE plpgsql;
      `,
    })

    // Now create the table
    await createLiveStreamsTable()

    // Return success
    return NextResponse.json({ success: true, message: "Live streams table setup complete" })
  } catch (error) {
    console.error("Error in setup-live-streams GET:", error)
    return NextResponse.json({ success: false, error: "Failed to setup live streams table" }, { status: 500 })
  }
}

// Handle POST requests - add or update a live stream
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { channelId, streamUrl } = body

    if (!channelId || !streamUrl) {
      return NextResponse.json({ success: false, error: "Channel ID and Stream URL are required" }, { status: 400 })
    }

    // Ensure table exists
    await createLiveStreamsTable()

    // Check if entry exists for this channel
    const { data: existingStream } = await supabase
      .from("live_streams")
      .select("*")
      .eq("channel_id", channelId)
      .single()

    let result

    if (existingStream) {
      // Update existing stream
      result = await supabase
        .from("live_streams")
        .update({
          stream_url: streamUrl,
          updated_at: new Date().toISOString(),
        })
        .eq("channel_id", channelId)
    } else {
      // Insert new stream
      result = await supabase.from("live_streams").insert({
        channel_id: channelId,
        stream_url: streamUrl,
      })
    }

    if (result.error) {
      throw result.error
    }

    return NextResponse.json({
      success: true,
      message: `Live stream for channel ${channelId} ${existingStream ? "updated" : "added"} successfully`,
    })
  } catch (error) {
    console.error("Error in setup-live-streams POST:", error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Unknown error occurred" },
      { status: 500 },
    )
  }
}
