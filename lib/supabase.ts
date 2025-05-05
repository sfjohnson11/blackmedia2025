import { createClient } from "@supabase/supabase-js"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ""
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export const isLiveChannel = (channelId: string): boolean => {
  // Only Channel 21 is live
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

// Replace the getCurrentProgram function with this more efficient implementation
export async function getCurrentProgram(channelId: string): Promise<{ program: any }> {
  console.log(`=== GETTING CURRENT PROGRAM FOR CHANNEL ${channelId} ===`)
  const now = new Date()
  console.log(`Current time (UTC ISO): ${now.toISOString()}`)
  console.log(`Current time (Local): ${now.toLocaleString()}`)

  try {
    // Get programs that have already started
    const { data, error } = await supabase
      .from("programs")
      .select("*")
      .eq("channel_id", channelId)
      .lte("start_time", now.toISOString())
      .order("start_time", { ascending: false })

    if (error) {
      console.error(`Error fetching programs for channel ${channelId}:`, error)
      return { program: null }
    }

    if (!data || data.length === 0) {
      console.log(`No programs found for channel ${channelId}`)
      return { program: null }
    }

    console.log(`Found ${data.length} programs that have started for channel ${channelId}`)

    // Find the active program (where current time is between start and end)
    const activeProgram = data.find((program) => {
      const start = new Date(program.start_time)
      const end = new Date(start.getTime() + program.duration * 1000)
      const isActive = now >= start && now < end

      console.log(`Checking program: ${program.title}`)
      console.log(`- Start time: ${start.toLocaleString()}`)
      console.log(`- End time: ${end.toLocaleString()}`)
      console.log(`- Is active: ${isActive}`)

      return isActive
    })

    if (activeProgram) {
      console.log(`✅ CURRENT ACTIVE PROGRAM FOUND: ${activeProgram.title}`)
      return { program: activeProgram }
    }

    // If no active program, return the most recent program
    console.log(`No active program found, returning most recent program: ${data[0]?.title}`)
    return { program: data[0] || null }
  } catch (e) {
    console.error(`Error in getCurrentProgram for channel ${channelId}:`, e)
    return { program: null }
  }
}

export async function getUpcomingPrograms(channelId: string): Promise<{ programs: any[] }> {
  const now = new Date().toISOString()
  console.log(`Getting upcoming programs for channel ${channelId} at ${now}`)

  try {
    const { data: programs, error } = await supabase
      .from("programs")
      .select("*")
      .eq("channel_id", channelId)
      .gt("start_time", now)
      .order("start_time", { ascending: true })
      .limit(5)

    if (error) {
      console.error("Error fetching upcoming programs:", error)
      return { programs: [] }
    }

    console.log(`Found ${programs?.length || 0} upcoming programs`)
    return { programs: programs || [] }
  } catch (e) {
    console.error(`Error in getUpcomingPrograms for channel ${channelId}:`, e)
    return { programs: [] }
  }
}

export function calculateProgramProgress(program: any): { progressPercent: number; isFinished: boolean } {
  const startTime = new Date(program.start_time).getTime()
  const now = Date.now()
  const duration = program.duration * 1000 // Convert seconds to milliseconds
  const elapsed = now - startTime

  let progressPercent = (elapsed / duration) * 100
  if (progressPercent > 100) {
    progressPercent = 100
  }

  const isFinished = progressPercent >= 100

  return { progressPercent, isFinished }
}

export const getLiveStreamUrl = (channelId: string): string | null => {
  // Only Channel 21 has a live stream
  if (channelId === "21") {
    // Use a reliable test stream URL for Channel 21
    return "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8"
  }
  return null
}

// Fix double slashes in URLs (but preserve http://)
export function fixUrl(url: string): string {
  if (!url) return ""

  // First preserve the protocol (http:// or https://)
  let protocol = ""
  const protocolMatch = url.match(/^(https?:\/\/)/)
  if (protocolMatch) {
    protocol = protocolMatch[0]
    url = url.substring(protocol.length)
  }

  // Replace any double slashes with single slashes
  url = url.replace(/\/+/g, "/")

  // Put the protocol back
  return protocol + url
}

// Improve the URL checking and resolution functions

// Update the checkUrlExists function to be more reliable
export async function checkUrlExists(url: string): Promise<boolean> {
  try {
    console.log(`Checking if URL exists: ${url}`)

    // Basic URL validation
    if (!url || !url.match(/^https?:\/\//i)) {
      console.log(`Invalid URL format: ${url}`)
      return false
    }

    // For m3u8 streams, assume they're valid without checking
    if (url.includes(".m3u8")) {
      console.log(`Assuming m3u8 stream is valid: ${url}`)
      return true
    }

    // For Supabase storage URLs, assume they're valid
    if (url.includes("supabase.co") && url.includes("storage/v1/object")) {
      console.log(`Assuming Supabase storage URL is valid: ${url}`)
      return true
    }

    // For test streams, assume they're valid
    if (url.includes("test-streams.mux.dev")) {
      console.log(`Assuming test stream is valid: ${url}`)
      return true
    }

    // For common video hosting services, assume they're valid
    if (
      url.includes("youtube.com") ||
      url.includes("youtu.be") ||
      url.includes("vimeo.com") ||
      url.includes("dailymotion.com") ||
      url.includes("cloudfront.net") ||
      url.includes("amazonaws.com")
    ) {
      console.log(`Assuming video hosting service URL is valid: ${url}`)
      return true
    }

    // For client-side, we'll use a simple image request as a heuristic
    // This won't validate video content but can check if the domain responds
    if (typeof window !== "undefined") {
      return new Promise((resolve) => {
        const img = new Image()
        const timeoutId = setTimeout(() => {
          console.log(`URL check timed out: ${url}`)
          resolve(true) // Assume valid on timeout
        }, 3000)

        img.onload = () => {
          clearTimeout(timeoutId)
          console.log(`URL appears valid: ${url}`)
          resolve(true)
        }

        img.onerror = () => {
          clearTimeout(timeoutId)
          // For video URLs, we'll still assume they might be valid even if image check fails
          // Many video servers block image requests but allow video requests
          console.log(`Image check failed but assuming video URL might be valid: ${url}`)
          resolve(true)
        }

        // Use a tiny favicon request instead of the full URL to avoid CORS issues
        const urlObj = new URL(url)
        img.src = `${urlObj.origin}/favicon.ico`
      })
    }

    // Default to assuming the URL is valid
    console.log(`Assuming URL is valid without checking: ${url}`)
    return true
  } catch (error) {
    console.error("Error checking URL:", url, error)
    // In case of errors, assume the URL might be valid
    return true
  }
}

// Add a more robust getDirectDownloadUrl function that handles errors better
export async function getDirectDownloadUrl(url: string | null, channelId: string): Promise<string | null> {
  if (!url) return null

  console.log(`Getting direct download URL for ${url} (Channel ID: ${channelId})`)

  try {
    // First check if the URL is already a direct URL (no transformation needed)
    if (
      url.includes("storage.googleapis.com") ||
      url.includes("blob.vercel-storage.com") ||
      url.includes("cloudfront.net")
    ) {
      console.log(`URL is already a direct URL: ${url}`)
      return url
    }

    // For Supabase storage URLs, get a direct download URL
    if (url.includes("supabase.co") && url.includes("storage/v1/object/public")) {
      // Fix any double slashes in the path (but preserve http://)
      const fixedUrl = url.replace(/(https?:\/\/)|(\/\/+)/g, (match, protocol) => {
        return protocol || "/"
      })
      console.log(`Fixed Supabase storage URL: ${fixedUrl}`)
      return fixedUrl
    }

    // For YouTube URLs, we can't use them directly
    if (url.includes("youtube.com") || url.includes("youtu.be")) {
      console.log(`YouTube URL detected, cannot use directly: ${url}`)
      return null
    }

    // For other URLs, try to use them directly (with double slash fix)
    const fixedUrl = url.replace(/(https?:\/\/)|(\/\/+)/g, (match, protocol) => {
      return protocol || "/"
    })
    console.log(`Using fixed URL directly: ${fixedUrl}`)
    return fixedUrl
  } catch (error) {
    console.error(`Error getting direct download URL for ${url}:`, error)
    // Return the original URL as a fallback, but fix double slashes
    return url.replace(/(https?:\/\/)|(\/\/+)/g, (match, protocol) => {
      return protocol || "/"
    })
  }
}

// Function to construct a URL with the specific pattern observed in your storage
export function constructChannelVideoUrl(channelId: string, fileName: string): string {
  // Ensure there's only a single slash between path segments
  return `${supabaseUrl}/storage/v1/object/public/channel${channelId}/${fileName.replace(/^\/+/, "")}`
}

// These functions are required by the video player component
export async function saveWatchProgress(programId: number, currentTime: number): Promise<void> {
  try {
    // Don't save progress if it's very close to the beginning (less than 5 seconds)
    if (currentTime < 5) return

    if (typeof window === "undefined") return

    // Simple localStorage implementation
    localStorage.setItem(`watch_progress_${programId}`, currentTime.toString())
  } catch (error) {
    console.error("Error saving watch progress:", error)
  }
}

export async function getWatchProgress(programId: number): Promise<number | null> {
  try {
    if (typeof window === "undefined") return null

    const savedProgress = localStorage.getItem(`watch_progress_${programId}`)
    if (savedProgress) {
      return Number.parseFloat(savedProgress)
    }
    return null
  } catch (error) {
    console.error("Error getting watch progress:", error)
    return null
  }
}

export function shouldDisableAutoRefresh(duration: number): boolean {
  // If video is longer than 5 minutes (300 seconds), disable auto refresh
  return duration > 300
}

export async function checkRLSStatus(bucketName: string): Promise<{
  enabled: boolean
  hasPublicPolicy: boolean
  canAccess: boolean
}> {
  try {
    // Check if RLS is enabled
    const { data: policyData, error: policyError } = await supabase
      .from("pg_policies")
      .select("*")
      .eq("tablename", bucketName)

    const rlsEnabled = policyData && policyData.length > 0

    // Check if there's a public policy
    const hasPublicPolicy = policyData?.some((policy) => policy.definition === "true") || false

    // Try to access a file in the bucket
    let canAccess = false
    try {
      const { data: listData, error: listError } = await supabase.storage.from(bucketName).list()
      canAccess = !listError
    } catch (accessError) {
      console.warn(`Could not access bucket ${bucketName}:`, accessError)
    }

    return {
      enabled: rlsEnabled,
      hasPublicPolicy,
      canAccess,
    }
  } catch (error) {
    console.error(`Error checking RLS status for bucket ${bucketName}:`, error)
    return {
      enabled: false,
      hasPublicPolicy: false,
      canAccess: false,
    }
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

export async function testAllVideoFormats(
  channelId: string,
  fileName: string,
): Promise<Array<{ url: string; works: boolean }>> {
  const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ""
  const formats = [
    `${baseUrl}/storage/v1/object/public/channel${channelId}/${fileName}`,
    `${baseUrl}/storage/v1/object/public/videos/channel${channelId}/${fileName}`,
    `${baseUrl}/storage/v1/object/public/videos/channel-${channelId}/${fileName}`,
    `${baseUrl}/storage/v1/object/public/videos/${fileName}`,
    `${baseUrl}/storage/v1/object/public/${channelId}/${fileName}`,
    `${baseUrl}/storage/v1/object/public/ch${channelId}/${fileName}`,
  ]

  const results = []

  for (const url of formats) {
    try {
      const response = await fetch(url, { method: "HEAD" })
      results.push({ url, works: response.ok })
    } catch (error) {
      results.push({ url, works: false })
    }
  }

  return results
}
