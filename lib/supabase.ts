import { createClient } from "@supabase/supabase-js"
import type { Database } from "@/types/supabase"

// Create a single supabase client for interacting with your database
export const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
)

// Centralized full URL builder
export function getFullUrl(path: string): string {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL + "/storage/v1/object/public/"
  const cleanPath = path.replace(/^\/+/, "")
  return base + cleanPath
}

// Get the current program for a channel
export async function getCurrentProgram(channelId: string) {
  // Check if this is a live channel
  if (isLiveChannel(channelId)) {
    try {
      // Get the live stream URL
      const liveUrl = await getLiveStreamUrl(channelId)

      if (!liveUrl) {
        console.error("No live stream URL found for channel:", channelId)
        return { program: null, error: "No live stream URL found" }
      }

      // Create a virtual "program" for the live stream
      const liveProgram = {
        id: -1, // Use a negative ID to indicate it's a live program
        channel_id: channelId,
        title: "LIVE: Channel " + channelId,
        mp4_url: liveUrl,
        start_time: new Date().toISOString(),
        duration: 86400, // 24 hours in seconds
        is_live: true,
      }

      return { program: liveProgram, error: null }
    } catch (err) {
      console.error("Error handling live channel:", err)
      return { program: null, error: err }
    }
  }

  // For non-live channels, use the existing logic
  const now = new Date().toISOString()

  try {
    const { data, error } = await supabase
      .from("programs")
      .select("*")
      .eq("channel_id", channelId)
      .lte("start_time", now)
      .order("start_time", { ascending: false })
      .limit(1)

    if (error) {
      console.error("Error fetching current program:", error)
      return { program: null, error }
    }

    return { program: data[0] || null, error: null }
  } catch (err) {
    console.error("Error in getCurrentProgram:", err)
    return { program: null, error: err }
  }
}

// Get upcoming programs for a channel
export async function getUpcomingPrograms(channelId: string, limit = 5) {
  const now = new Date().toISOString()

  try {
    const { data, error } = await supabase
      .from("programs")
      .select("*")
      .eq("channel_id", channelId)
      .gt("start_time", now)
      .order("start_time", { ascending: true })
      .limit(limit)

    if (error) {
      console.error("Error fetching upcoming programs:", error)
      return { programs: [], error }
    }

    return { programs: data || [], error: null }
  } catch (err) {
    console.error("Error in getUpcomingPrograms:", err)
    return { programs: [], error: err }
  }
}

// Force refresh all data by clearing any cached results
export async function forceRefreshAllData() {
  try {
    // Call the refresh-cache API route
    const response = await fetch("/api/refresh-cache", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ force: true }),
    })

    if (!response.ok) {
      throw new Error(`Failed to refresh cache: ${response.status} ${response.statusText}`)
    }

    return { success: true, error: null }
  } catch (err) {
    console.error("Error in forceRefreshAllData:", err)
    return { success: false, error: err }
  }
}

// Save watch progress for a program
export async function saveWatchProgress(programId: number, position: number) {
  try {
    // Only save if we have a valid position
    if (position <= 0) return { success: false, error: "Invalid position" }

    // Store in localStorage for now
    localStorage.setItem(`watch_progress_${programId}`, position.toString())
    return { success: true, error: null }
  } catch (err) {
    console.error("Error saving watch progress:", err)
    return { success: false, error: err }
  }
}

// Get watch progress for a program
export async function getWatchProgress(programId: number): Promise<number> {
  try {
    // Get from localStorage
    const progress = localStorage.getItem(`watch_progress_${programId}`)
    return progress ? Number.parseFloat(progress) : 0
  } catch (err) {
    console.error("Error getting watch progress:", err)
    return 0
  }
}

// Determine if we should disable auto-refresh for long videos
export function shouldDisableAutoRefresh(duration: number): boolean {
  // If the video is longer than 10 minutes (600 seconds), disable auto-refresh
  return duration > 600
}

// Add the missing exports after the existing code

// Add isLiveChannel function
export const isLiveChannel = (channelId: string): boolean => {
  // Only Channel 21 is live
  return channelId === "21"
}

// Replace the current getLiveStreamUrl function with this version that queries the database

export const getLiveStreamUrl = async (channelId: string): Promise<string | null> => {
  // Only Channel 21 is live
  if (channelId === "21") {
    try {
      // Query the database for the live stream URL
      const { data, error } = await supabase
        .from("live_streams")
        .select("stream_url")
        .eq("channel_id", channelId)
        .single()

      if (error || !data) {
        console.error("Error fetching live stream URL:", error)
        return null
      }

      return data.stream_url
    } catch (err) {
      console.error("Error in getLiveStreamUrl:", err)
      return null
    }
  }
  return null
}

// Add createTables function
export async function createTables() {
  try {
    const sql = `
      CREATE TABLE IF NOT EXISTS channels (
        id TEXT PRIMARY KEY,
        name TEXT,
        slug TEXT,
        description TEXT,
        logo_url TEXT,
        password_protected BOOLEAN
      );
      
      CREATE TABLE IF NOT EXISTS programs (
        id SERIAL PRIMARY KEY,
        channel_id TEXT,
        title TEXT,
        mp4_url TEXT,
        start_time TEXT,
        duration INTEGER
      );
    `

    const { error } = await supabase.rpc("exec_sql", { sql })

    if (error) {
      return { success: false, error: error.message }
    }

    return { success: true }
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "An unknown error occurred" }
  }
}

// Add checkRLSStatus function
export async function checkRLSStatus(bucketName: string): Promise<{
  enabled: boolean
  hasPublicPolicy: boolean
  canAccess: boolean
}> {
  try {
    // Check if RLS is enabled
    const { data: rlsData, error: rlsError } = await supabase
      .from("pg_policies")
      .select("*")
      .eq("tablename", bucketName)

    const enabled = !rlsError && rlsData && rlsData.length > 0

    // Check if there's a public policy
    const hasPublicPolicy = enabled && rlsData.some((policy) => policy.name === "Enable read access for all users")

    // Try to access a file
    let canAccess = false
    if (bucketName) {
      const { data: listData, error: listError } = await supabase.storage.from(bucketName).list()
      canAccess = !listError
    }

    return {
      enabled,
      hasPublicPolicy,
      canAccess,
    }
  } catch (error) {
    console.error("Error checking RLS status:", error)
    throw error
  }
}

// Add listBuckets function
export async function listBuckets(): Promise<any[]> {
  try {
    const { data, error } = await supabase.storage.listBuckets()

    if (error) {
      throw new Error(`Error listing buckets: ${error.message}`)
    }

    return data || []
  } catch (error) {
    console.error("Error listing buckets:", error)
    return []
  }
}
