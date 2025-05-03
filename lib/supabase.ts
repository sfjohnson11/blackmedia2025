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

// Update the checkUrlExists function to be more reliable
export async function checkUrlExists(url: string): Promise<boolean> {
  try {
    // Add a cache-busting parameter to avoid cached responses
    const checkUrl = `${url}?t=${Date.now()}`
    console.log(`Checking if URL exists: ${checkUrl}`)

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

    // Consider 200-299 as success
    return response.status >= 200 && response.status < 300
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

// Update the findWorkingVideoUrl function to be more comprehensive and add better logging
export async function findWorkingVideoUrl(fileName: string, channelId: string): Promise<string | null> {
  console.log(`Finding working URL for file: ${fileName}, channel: ${channelId}`)

  // If fileName is already a full URL, try it directly first
  if (fileName.startsWith("http")) {
    try {
      const exists = await checkUrlExists(fileName)
      if (exists) {
        console.log(`Direct URL works: ${fileName}`)
        return fileName
      } else {
        console.log(`Direct URL failed: ${fileName}`)
      }
    } catch (error) {
      console.error(`Error checking direct URL: ${fileName}`, error)
    }
  }

  // Extract just the filename without path if it contains slashes
  const baseFileName = fileName.split("/").pop() || fileName

  // List of possible bucket names to try
  const possibleBuckets = [
    "videos",
    `channel${channelId}`,
    `ch${channelId}`,
    "media",
    "content",
    `channel-${channelId}`,
    "assets",
    "public",
    "storage",
  ]

  // List of possible file paths within each bucket
  const possiblePaths = [
    baseFileName,
    `${baseFileName}`,
    `channel${channelId}/${baseFileName}`,
    `ch${channelId}/${baseFileName}`,
    `channel-${channelId}/${baseFileName}`,
    `${channelId}/${baseFileName}`,
    fileName, // Try the original string as a path too
  ]

  console.log(`Trying ${possibleBuckets.length} buckets with ${possiblePaths.length} path patterns each`)

  // Try each combination of bucket and path
  for (const bucket of possibleBuckets) {
    try {
      console.log(`Checking bucket: ${bucket}`)

      // Try each path in this bucket
      for (const path of possiblePaths) {
        try {
          console.log(`Trying path: ${path} in bucket ${bucket}`)
          const url = getPublicUrl(bucket, path)
          console.log(`Generated URL: ${url}`)

          const exists = await checkUrlExists(url)
          if (exists) {
            console.log(`✅ Found working URL: ${url}`)
            return url
          } else {
            console.log(`❌ URL doesn't exist: ${url}`)
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

  // As a last resort, if the fileName looks like a URL, return it anyway
  if (fileName.match(/^https?:\/\//i)) {
    console.log(`Returning original URL as fallback: ${fileName}`)
    return fileName
  }

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

// Update the getDirectDownloadUrl function to handle more cases
export async function getDirectDownloadUrl(mp4Url: string, channelId: string): Promise<string | null> {
  console.log(`Getting direct download URL for: ${mp4Url}, channel: ${channelId}`)

  // If it's already a full URL, try to use it directly first
  if (mp4Url.startsWith("http")) {
    try {
      const exists = await checkUrlExists(mp4Url)
      if (exists) {
        console.log(`Direct URL exists and works: ${mp4Url}`)
        return mp4Url
      } else {
        console.log(`Direct URL exists but doesn't work: ${mp4Url}`)
      }
    } catch (error) {
      console.error(`Error checking direct URL: ${mp4Url}`, error)
    }
  }

  // Try to find a working URL using the findWorkingVideoUrl function
  const workingUrl = await findWorkingVideoUrl(mp4Url, channelId)
  if (workingUrl) {
    return workingUrl
  }

  // If we couldn't find a working URL, try to create a signed URL
  try {
    // Extract just the filename without path if it contains slashes
    const baseFileName = mp4Url.split("/").pop() || mp4Url

    // Try different bucket patterns
    const bucketPatterns = ["videos", `channel${channelId}`, `ch${channelId}`, "media", "content", "assets"]

    for (const bucket of bucketPatterns) {
      try {
        console.log(`Trying to create signed URL in bucket ${bucket} for file ${baseFileName}`)
        const { data, error } = await supabase.storage.from(bucket).createSignedUrl(baseFileName, 60 * 60) // 1 hour expiry
        if (!error && data?.signedUrl) {
          console.log(`Created signed URL in bucket ${bucket}: ${data.signedUrl}`)
          return data.signedUrl
        } else if (error) {
          console.log(`Error creating signed URL in bucket ${bucket}:`, error)
        }
      } catch (e) {
        console.log(`Exception creating signed URL in bucket ${bucket}:`, e)
      }
    }
  } catch (e) {
    console.error("Error creating signed URL:", e)
  }

  // If all else fails, try to construct a direct URL to the Supabase storage
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ""
  if (supabaseUrl) {
    // Extract just the filename without path if it contains slashes
    const baseFileName = mp4Url.split("/").pop() || mp4Url

    // Try a few common URL patterns
    const directUrls = [
      `${supabaseUrl}/storage/v1/object/public/videos/${baseFileName}`,
      `${supabaseUrl}/storage/v1/object/public/channel${channelId}/${baseFileName}`,
      `${supabaseUrl}/storage/v1/object/public/videos/channel${channelId}/${baseFileName}`,
    ]

    for (const url of directUrls) {
      try {
        console.log(`Trying direct URL: ${url}`)
        const exists = await checkUrlExists(url)
        if (exists) {
          console.log(`Direct URL works: ${url}`)
          return url
        }
      } catch (error) {
        console.log(`Error checking direct URL: ${url}`, error)
      }
    }
  }

  // As an absolute last resort, if mp4Url looks like it might be a URL, return it
  if (mp4Url.match(/^https?:\/\//i) || mp4Url.includes(".mp4") || mp4Url.includes(".m3u8")) {
    console.log(`Returning original URL as last resort: ${mp4Url}`)
    return mp4Url
  }

  // If all else fails, return null
  console.log(`❌ All URL resolution methods failed for ${mp4Url}`)
  return null
}
