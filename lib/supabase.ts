import { createClient } from "@supabase/supabase-js"
import type { Database } from "@/types/supabase"

// Create a single supabase client for interacting with your database
export const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
)

// Centralized full URL builder with improved error handling
export function getFullUrl(path: string): string {
  if (!path) {
    console.error("Empty path passed to getFullUrl")
    return ""
  }

  // If it's already a full URL, return it
  if (path.startsWith("http")) {
    return path
  }

  // Make sure we have the Supabase URL
  const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!baseUrl) {
    console.error("NEXT_PUBLIC_SUPABASE_URL is not defined")
    return path // Return the original path as a fallback
  }

  // Clean the path and construct the full URL
  const cleanPath = path.replace(/^\/+/, "")
  return `${baseUrl}/storage/v1/object/public/${cleanPath}`
}

// Get the current program for a channel
export const getCurrentProgram = async (channelId: string) => {
  try {
    const { data, error } = await supabase.rpc("get_current_program_for_channel", {
      input_channel_id: channelId,
    })

    if (error) {
      console.error("RPC Error fetching current program:", error)
      return { program: null, error }
    }

    const program = Array.isArray(data) ? data[0] : data
    return { program: program || null, error: null }
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
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
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
    // Store in localStorage for now
    localStorage.setItem(`watch_progress_${programId}`, position.toString())
    return { success: true, error: null }
  } catch (err) {
    console.error("Error saving watch progress:", err)
    return { success: false, error: err }
  }
}

// Get watch progress for a program
export async function getWatchProgress(): Promise<{
  [key: number]: { timestamp: number; progress: number; duration: number }
}> {
  try {
    const storedProgress = localStorage.getItem("watchProgress")
    return storedProgress ? JSON.parse(storedProgress) : {}
  } catch (err) {
    console.error("Error getting watch progress:", err)
    return {}
  }
}

// Determine if we should disable auto-refresh for long videos
export function shouldDisableAutoRefresh(duration: number): boolean {
  // If the video is longer than 10 minutes (600 seconds), disable auto-refresh
  return duration > 600
}

// Add isLiveChannel function
export const isLiveChannel = (channelId: string): boolean => {
  // Only Channel 21 is live
  return channelId === "21"
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
