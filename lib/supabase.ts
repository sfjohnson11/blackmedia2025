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

export async function getCurrentProgram(channelId: string): Promise<{ program: any }> {
  const now = new Date().toISOString()
  console.log(`Fetching current program for channel ${channelId} at ${now}`)

  try {
    const { data: program, error } = await supabase
      .from("programs")
      .select("*")
      .eq("channel_id", channelId)
      .lte("start_time", now)
      .order("start_time", { ascending: false })
      .limit(1)
      .single()

    if (error) {
      // Check if this is a "no rows returned" error, which is expected when no programs exist
      if (error.code === "PGRST116") {
        console.log(`No current program found for channel ${channelId}`)
        return { program: null }
      }

      console.error(`Error fetching current program for channel ${channelId}:`, error)
      return { program: null }
    }

    console.log(`Found current program for channel ${channelId}:`, program?.title || "Unknown title")
    return { program }
  } catch (e) {
    console.error(`Error in getCurrentProgram for channel ${channelId}:`, e)
    return { program: null }
  }
}

export async function getUpcomingPrograms(channelId: string): Promise<{ programs: any[] }> {
  const now = new Date().toISOString()

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

  return { programs }
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

export async function checkUrlExists(url: string): Promise<boolean> {
  try {
    // Add a cache-busting parameter to avoid cached responses
    const checkUrl = `${url}?t=${Date.now()}`

    // Try with a timeout to avoid hanging requests
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 5000) // 5 second timeout

    const response = await fetch(checkUrl, {
      method: "HEAD",
      headers: {
        "Cache-Control": "no-cache",
        Pragma: "no-cache",
      },
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    // Log the response status for debugging
    console.log(`URL check for ${url}: status ${response.status}`)

    return response.ok
  } catch (error) {
    if (error.name === "AbortError") {
      console.error("URL check timed out:", url)
    } else {
      console.error("Error checking URL:", url, error)
    }
    return false
  }
}

export async function listBuckets() {
  try {
    const { data, error } = await supabase.storage.listBuckets()
    if (error) {
      throw error
    }
    return data
  } catch (error) {
    console.error("Error listing buckets:", error)
    throw error
  }
}

export async function listFiles(bucketName: string) {
  try {
    const { data, error } = await supabase.storage.from(bucketName).list()
    if (error) {
      throw error
    }
    return data
  } catch (error) {
    console.error(`Error listing files in bucket ${bucketName}:`, error)
    throw error
  }
}

// New function to get the direct public URL for a file in Supabase storage
export function getPublicUrl(bucketName: string, filePath: string): string {
  const { data } = supabase.storage.from(bucketName).getPublicUrl(filePath)
  return data.publicUrl
}

// New function to find a working video URL by trying multiple bucket patterns
export async function findWorkingVideoUrl(fileName: string, channelId: string): Promise<string | null> {
  console.log(`Finding working URL for file: ${fileName}, channel: ${channelId}`)

  // List of possible bucket names to try
  const possibleBuckets = [
    "videos",
    `channel${channelId}`,
    `ch${channelId}`,
    "media",
    "content",
    `channel-${channelId}`,
  ]

  // List of possible file paths within each bucket
  const possiblePaths = [
    fileName,
    `${fileName}`,
    `channel${channelId}/${fileName}`,
    `ch${channelId}/${fileName}`,
    `channel-${channelId}/${fileName}`,
  ]

  // Try each combination of bucket and path
  for (const bucket of possibleBuckets) {
    try {
      // First check if the bucket exists
      const buckets = await listBuckets()
      if (!buckets.some((b) => b.name === bucket)) {
        console.log(`Bucket ${bucket} does not exist, skipping`)
        continue
      }

      // Then try each path in this bucket
      for (const path of possiblePaths) {
        try {
          const url = getPublicUrl(bucket, path)
          const exists = await checkUrlExists(url)
          if (exists) {
            console.log(`Found working URL: ${url}`)
            return url
          }
        } catch (error) {
          console.log(`Error checking path ${path} in bucket ${bucket}:`, error)
        }
      }
    } catch (error) {
      console.log(`Error checking bucket ${bucket}:`, error)
    }
  }

  // If we get here, we couldn't find a working URL
  console.log(`Could not find working URL for ${fileName}`)
  return null
}

export async function testAllVideoFormats(
  channelId: string,
  fileName: string,
): Promise<Array<{ url: string; works: boolean }>> {
  const baseUrl = "https://msllqpnxwbugvkpnquwx.supabase.co/storage/v1/object/public"

  const urlFormats = [
    `${baseUrl}/channel${channelId}/${fileName}`,
    `${baseUrl}/videos/channel${channelId}/${fileName}`,
    `${baseUrl}/videos/channel-${channelId}/${fileName}`,
    `${baseUrl}/videos/${fileName}`,
    `${baseUrl}/${channelId}/${fileName}`,
    `${baseUrl}/ch${channelId}/${fileName}`,
  ]

  const results = []

  for (const url of urlFormats) {
    try {
      const response = await fetch(url, { method: "HEAD" })
      results.push({
        url,
        works: response.ok,
      })
    } catch (error) {
      results.push({
        url,
        works: false,
      })
    }
  }

  return results
}

// Add this new function
export async function checkChannelHasPrograms(channelId: string): Promise<boolean> {
  try {
    const { count, error } = await supabase
      .from("programs")
      .select("*", { count: "exact", head: true })
      .eq("channel_id", channelId)

    if (error) {
      console.error(`Error checking programs for channel ${channelId}:`, error)
      return false
    }

    return count > 0
  } catch (e) {
    console.error(`Error in checkChannelHasPrograms for channel ${channelId}:`, e)
    return false
  }
}

// New function to get direct download URL for a file
export async function getDirectDownloadUrl(mp4Url: string, channelId: string): Promise<string | null> {
  // If it's already a full URL, try to use it directly
  if (mp4Url.startsWith("http")) {
    return mp4Url
  }

  // Extract the filename
  const fileName = mp4Url.split("/").pop() || mp4Url

  // Try to find a working URL using the new function
  const workingUrl = await findWorkingVideoUrl(fileName, channelId)
  if (workingUrl) {
    return workingUrl
  }

  // If we couldn't find a working URL, try to create a signed URL
  try {
    // Try different bucket patterns
    const bucketPatterns = ["videos", `channel${channelId}`, `ch${channelId}`]

    for (const bucket of bucketPatterns) {
      try {
        const { data, error } = await supabase.storage.from(bucket).createSignedUrl(fileName, 60 * 60) // 1 hour expiry
        if (!error && data?.signedUrl) {
          console.log(`Created signed URL in bucket ${bucket}: ${data.signedUrl}`)
          return data.signedUrl
        }
      } catch (e) {
        console.log(`Error creating signed URL in bucket ${bucket}:`, e)
      }
    }
  } catch (e) {
    console.error("Error creating signed URL:", e)
  }

  // If all else fails, return null
  return null
}
