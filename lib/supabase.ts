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

  if (path.startsWith("http")) {
    return path
  }

  const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!baseUrl) {
    console.error("NEXT_PUBLIC_SUPABASE_URL is not defined")
    return path
  }

  const cleanPath = path.replace(/^\/+/, "")
  return `${baseUrl}/storage/v1/object/public/${cleanPath}`
}

// Updated getCurrentProgram function
export const getCurrentProgram = async (channelId: string) => {
  const now = new Date().toISOString()

  const { data, error } = await supabase
    .from("programs")
    .select("*")
    .eq("channel_id", channelId)
    .lte("start_time", now)
    .order("start_time", { ascending: false })

  if (error) {
    console.error("Error fetching current program:", error)
    return { program: null, error }
  }

  const activeProgram = data.find((program) => {
    const start = new Date(program.start_time).getTime()
    const end = start + (program.duration || 0) * 1000
    return Date.now() < end
  })

  return { program: activeProgram || null, error: null }
}

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

export async function forceRefreshAllData() {
  try {
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
