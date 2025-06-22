import { createClient } from "@supabase/supabase-js"
import type { Database } from "@/types/supabase"
import type { Program, Channel } from "@/types"

export const STANDBY_PLACEHOLDER_ID = 0 // Or -1, or any other unique number

export const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
)

// Existing getFullUrl - might be used for posters or other assets
// if they are not in channel-specific buckets or if their path already includes the bucket.
export function getFullUrl(pathFromDatabase: string): string {
  if (!pathFromDatabase) {
    console.warn("getFullUrl (Generic): Empty pathFromDatabase provided.")
    return ""
  }

  if (pathFromDatabase.startsWith("http://") || pathFromDatabase.startsWith("https://")) {
    console.log("getFullUrl (Generic): Path is already a full URL:", pathFromDatabase)
    return pathFromDatabase
  }

  const supabasePublicUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!supabasePublicUrl) {
    console.error("getFullUrl (Generic): NEXT_PUBLIC_SUPABASE_URL is not defined.")
    return `ERROR_SUPABASE_URL_NOT_SET/${pathFromDatabase}`
  }

  const cleanBaseUrl = supabasePublicUrl.replace(/\/$/, "")
  const cleanPath = pathFromDatabase.replace(/^\//, "")

  const finalUrl = `${cleanBaseUrl}/storage/v1/object/public/${cleanPath}`
  console.log(
    `getFullUrl (Generic): Constructed URL. Base: ${cleanBaseUrl}, Clean Path: ${cleanPath}, Final URL: ${finalUrl}`,
  )
  return finalUrl
}

// NEW function specifically for program video URLs with dynamic buckets
export function getVideoUrlForProgram(program: Program | null): string {
  if (!program || !program.mp4_url || program.channel_id === undefined || program.channel_id === null) {
    console.warn("getVideoUrlForProgram: Invalid program data provided or mp4_url/channel_id missing.", program)
    return ""
  }

  // If mp4_url is already a full URL, return it.
  if (program.mp4_url.startsWith("http://") || program.mp4_url.startsWith("https://")) {
    console.log("getVideoUrlForProgram: mp4_url is already a full URL:", program.mp4_url)
    return program.mp4_url
  }

  const supabasePublicUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!supabasePublicUrl) {
    console.error("getVideoUrlForProgram: NEXT_PUBLIC_SUPABASE_URL is not defined. Cannot construct video URL.")
    return `ERROR_SUPABASE_URL_NOT_SET/channel${program.channel_id}/${program.mp4_url}`
  }

  const cleanBaseUrl = supabasePublicUrl.replace(/\/$/, "") // Remove trailing slash from base
  const bucketName = `channel${program.channel_id}`
  const objectPath = program.mp4_url.replace(/^\//, "") // Remove leading slash from mp4_url if present

  const finalUrl = `${cleanBaseUrl}/storage/v1/object/public/${bucketName}/${objectPath}`
  console.log(
    `getVideoUrlForProgram: Constructed video URL. Base: ${cleanBaseUrl}, Bucket: ${bucketName}, ObjectPath: ${objectPath}, Final URL: ${finalUrl}`,
  )
  return finalUrl
}

// Function to fetch programs for a given channel
export async function fetchProgramsForChannel(channelId: string): Promise<Program[]> {
  console.log(`fetchProgramsForChannel: Fetching for channelId: ${channelId}`)
  if (!channelId) {
    console.warn("fetchProgramsForChannel: No channelId provided.")
    return []
  }
  const { data, error } = await supabase
    .from("programs")
    .select("*")
    .eq("channel_id", channelId)
    .order("start_time", { ascending: true })

  if (error) {
    console.error(`fetchProgramsForChannel: Supabase error for channel ${channelId}:`, JSON.stringify(error, null, 2))
    throw error
  }
  console.log(`fetchProgramsForChannel: Found ${data?.length || 0} programs for channel ${channelId}.`)
  return (data as Program[]) || []
}

// Function to get the currently scheduled program for a channel
// Returns the program if one is active, otherwise null.
export const getCurrentProgram = async (channelId: string): Promise<Program | null> => {
  const now = new Date()
  console.log(`getCurrentProgram: Called for channelId: ${channelId}. Current time (UTC): ${now.toISOString()}`)

  let programs: Program[] = []
  try {
    programs = await fetchProgramsForChannel(channelId)
  } catch (error) {
    console.error(`getCurrentProgram: Error calling fetchProgramsForChannel for channelId ${channelId}:`, error)
    throw error
  }

  if (!programs || programs.length === 0) {
    console.log(
      `getCurrentProgram: No programs found by fetchProgramsForChannel for channel ${channelId}. Returning null.`,
    )
    return null
  }

  console.log(`getCurrentProgram: Checking ${programs.length} programs for channel ${channelId}.`)
  for (const prog of programs) {
    if (!prog || typeof prog.start_time !== "string" || typeof prog.mp4_url !== "string") {
      console.warn(
        `getCurrentProgram: Skipping program with missing essential data (start_time, mp4_url):`,
        JSON.stringify(prog, null, 2),
      )
      continue
    }
    const startTime = new Date(prog.start_time)
    const durationInSeconds = typeof prog.duration === "number" && !isNaN(prog.duration) ? prog.duration : 0
    const endTime = new Date(startTime.getTime() + durationInSeconds * 1000)

    console.log(`getCurrentProgram: Checking program "${prog.title}" (ID: ${prog.id})
      Channel: ${prog.channel_id}
      Raw Start: ${prog.start_time}, Parsed StartTime (UTC): ${startTime.toISOString()} (isValid: ${!isNaN(startTime.getTime())})
      Raw Duration: ${prog.duration}, Parsed Duration (s): ${durationInSeconds}
      EndTime (UTC): ${endTime.toISOString()} (isValid: ${!isNaN(endTime.getTime())})
      Is Current? (${now.toISOString()} >= ${startTime.toISOString()} && ${now.toISOString()} < ${endTime.toISOString()}): ${now >= startTime && now < endTime}`)

    if (isNaN(startTime.getTime()) || isNaN(endTime.getTime())) {
      console.warn(
        `getCurrentProgram: Invalid date for program "${prog.title}" (ID: ${prog.id}). StartTime: ${startTime}, EndTime: ${endTime}. Skipping.`,
      )
      continue
    }

    if (now >= startTime && now < endTime) {
      console.log(`getCurrentProgram: Found active program: "${prog.title}" (ID: ${prog.id}). Returning it.`)
      return prog
    }
  }
  console.log(
    `getCurrentProgram: No currently active program found for channel ${channelId} after checking all. Returning null.`,
  )
  return null
}

// Function to fetch details for a single channel
export async function fetchChannelDetails(channelId: string): Promise<Channel | null> {
  console.log(`fetchChannelDetails: Fetching for channelId: ${channelId}`)
  if (!channelId) {
    console.warn("fetchChannelDetails: No channelId provided.")
    return null
  }
  const { data, error } = await supabase.from("channels").select("*").eq("id", channelId).single()

  if (error) {
    console.error(`fetchChannelDetails: Supabase error for channel ${channelId}:`, JSON.stringify(error, null, 2))
    if (error.code === "PGRST116") {
      console.warn(`fetchChannelDetails: Channel not found for ID ${channelId}.`)
      return null
    }
    throw error
  }
  console.log(`fetchChannelDetails: Found channel:`, JSON.stringify(data, null, 2))
  return data as Channel
}

// Function to fetch upcoming programs for a given channel
export async function getUpcomingPrograms(channelId: string, limit = 5): Promise<Program[]> {
  const now = new Date()
  const { data, error } = await supabase
    .from("programs")
    .select("*")
    .eq("channel_id", channelId)
    .gt("start_time", now.toISOString()) // Programs starting after now
    .order("start_time", { ascending: true })
    .limit(limit)

  if (error) {
    console.error("Error fetching upcoming programs:", error)
    return []
  }
  return (data as Program[]) || []
}

// Function to fetch a channel by its ID
export async function getChannelById(channelId: string): Promise<Channel | null> {
  if (!channelId) return null
  const { data, error } = await supabase.from("channels").select("*").eq("id", channelId).single()
  if (error) {
    console.error(`Error fetching channel ${channelId}:`, error)
    return null
  }
  return data as Channel
}

// Function to force refresh all data
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

// Function to save watch progress
export async function saveWatchProgress(programId: number, position: number) {
  try {
    localStorage.setItem(`watch_progress_${programId}`, position.toString())
    return { success: true, error: null }
  } catch (err) {
    console.error("Error saving watch progress:", err)
    return { success: false, error: err }
  }
}

// Function to get watch progress
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

// Function to determine if auto refresh should be disabled
export function shouldDisableAutoRefresh(duration: number): boolean {
  return duration > 600
}

// Function to check if a channel is live
export const isLiveChannel = (channelId: string): boolean => {
  return channelId === "21"
}

// Function to create tables if they don't exist
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

// Function to check RLS status for a bucket
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

// Function to list all buckets
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
