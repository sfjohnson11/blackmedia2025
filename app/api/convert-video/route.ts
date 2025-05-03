import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { convertVideoToHLS } from "@/lib/video-processing"

// Initialize Supabase client with admin rights for server operations
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ""
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ""
const supabase = createClient(supabaseUrl, supabaseServiceKey)

export async function POST(request: NextRequest) {
  try {
    const { channelId, videoId, fileName } = await request.json()

    if (!channelId || !videoId || !fileName) {
      return NextResponse.json(
        {
          success: false,
          message: "Missing required parameters: channelId, videoId, and fileName are required",
        },
        { status: 400 },
      )
    }

    // Get the file URL from Supabase
    const { data: fileData } = supabase.storage.from(`channel${channelId}`).getPublicUrl(fileName)

    if (!fileData || !fileData.publicUrl) {
      return NextResponse.json(
        {
          success: false,
          message: "Could not generate URL for the specified file",
        },
        { status: 404 },
      )
    }

    // Start the conversion process
    const result = await convertVideoToHLS(channelId, fileData.publicUrl, fileName)

    return NextResponse.json(result)
  } catch (error) {
    console.error("Error processing video conversion request:", error)
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "An unknown error occurred",
      },
      { status: 500 },
    )
  }
}
