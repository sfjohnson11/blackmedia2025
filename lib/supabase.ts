import { createClient } from "@supabase/supabase-js"
import type { Database } from "@/types/supabase"
import type { Program, Channel } from "@/types"

export const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
)

// This function constructs the full public URL for a storage object.
export function getFullUrl(path: string): string {
  if (!path) {
    console.warn("Empty path passed to getFullUrl")
    return ""
  }
  if (path.startsWith("http")) {
    return path
  }
  const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!baseUrl) {
    console.error("NEXT_PUBLIC_SUPABASE_URL is not defined")
    return path // Fallback
  }
  // The path for a channel's video is typically `bucket-name/file-name`
  // e.g., `channel1/my-video.mp4`. The bucket name is part of the path here.
  const cleanPath = path.replace(/^\/+/, "")
  return `${baseUrl}/storage/v1/object/public/${cleanPath}`
}

// This is the conventional name for the standby video in each bucket.
const STANDBY_VIDEO_FILENAME = "standby.mp4"
// A special identifier for our virtual standby program.
export const STANDBY_PLACEHOLDER_ID = "standby_placeholder"

async function fetchProgramByChannelId(channelId: string, now: Date): Promise<Program | null> {
  const { data, error } = await supabase
    .from("programs")
    .select("*")
    .eq("channel_id", channelId)
    .lte("start_time", now.toISOString())
    .order("start_time", { ascending: false })
    .limit(1)

  if (error) {
    console.error(`Error fetching program for channel ${channelId}:`, error)
    return null
  }

  if (data && data.length > 0) {
    const program = data[0]
    const startTime = new Date(program.start_time)
    const duration = program.duration || 1800 // Default 30 mins
    const endTime = new Date(startTime.getTime() + duration * 1000)

    if (now >= startTime && now < endTime) {
      return program as Program
    }
  }
  return null
}

export const getCurrentProgram = async (channelId: string): Promise<{ program: Program | null; error: any }> => {
  try {
    const now = new Date()
    let currentProgram = await fetchProgramByChannelId(channelId, now)

    // If no real program is found, create a virtual placeholder for the standby video.
    if (!currentProgram) {
      console.log(`No current program for channel ${channelId}, creating placeholder for standby video.`)

      currentProgram = {
        id: -1, // Use a non-real ID
        channel_id: STANDBY_PLACEHOLDER_ID, // Special ID to signal this is a standby video
        title: "Programming will resume shortly",
        // The mp4_url path must include the bucket (channelId) and the filename.
        mp4_url: `${channelId}/${STANDBY_VIDEO_FILENAME}`,
        start_time: new Date().toISOString(),
        duration: 86400, // Long duration, doesn't really matter since it loops
        poster_url: null,
      } as Program
    } else {
      console.log(`Fetched current program for channel ${channelId}:`, currentProgram.title)
    }

    return { program: currentProgram, error: null }
  } catch (err) {
    console.error("Error in getCurrentProgram (outer catch):", err)
    return { program: null, error: err }
  }
}

export async function getUpcomingPrograms(channelId: string, limit = 5): Promise<{ programs: Program[]; error: any }> {
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
    return { programs: (data as Program[]) || [], error: null }
  } catch (err) {
    console.error("Error in getUpcomingPrograms:", err)
    return { programs: [], error: err }
  }
}

export async function getChannelById(channelId: string): Promise<Channel | null> {
  if (!channelId) return null
  const { data, error } = await supabase.from("channels").select("*").eq("id", channelId).single()
  if (error) {
    console.error(`Error fetching channel ${channelId}:`, error)
    return null
  }
  return data as Channel
}

export async function forceRefreshAllData() {
  try {
    const response = await fetch("/api/refresh-cache", {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    })
    if (!response.ok) throw new Error(`Failed to refresh cache: ${response.status}`)
    return { success: true, error: null }
  } catch (err) {
    console.error("Error in forceRefreshAllData:", err)
    return { success: false, error: err }
  }
}

export async function saveWatchProgress(programId: number, position: number) {
  try {
    localStorage.setItem(`watch_progress_${programId}`, position.toString())
    return { success: true, error: null }
  } catch (err) {
    console.error("Error saving watch progress:", err)
    return { success: false, error: err }
  }
}

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

export function shouldDisableAutoRefresh(duration: number): boolean {
  return duration > 600
}

export const isLiveChannel = (channelId: string): boolean => {
  return channelId === "21"
}

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

export async function checkRLSStatus(bucketName: string): Promise<{
  enabled: boolean
  hasPublicPolicy: boolean
  canAccess: boolean
}> {
  try {
    const { data: rlsData, error: rlsError } = await supabase
      .from("pg_policies")
      .select("*")
      .eq("tablename", bucketName)

    const enabled = !rlsError && rlsData && rlsData.length > 0

    const hasPublicPolicy = enabled && rlsData.some((policy) => policy.name === "Enable read access for all users")

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
