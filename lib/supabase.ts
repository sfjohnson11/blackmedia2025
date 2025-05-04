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

// New function to construct a URL with the specific pattern observed in your storage
export function constructChannelVideoUrl(channelId: string, fileName: string): string {
  // Use the specific pattern with double slash that works for your storage
  return `${supabaseUrl}/storage/v1/object/public/channel${channelId}//${fileName}`
}

// Update the getDirectDownloadUrl function to use the new URL pattern
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

  // Extract just the filename without path if it contains slashes
  const baseFileName = mp4Url.split("/").pop() || mp4Url

  // First try the specific pattern that we know works
  const channelUrl = constructChannelVideoUrl(channelId, baseFileName)
  console.log(`Trying channel-specific URL pattern: ${channelUrl}`)

  try {
    const exists = await checkUrlExists(channelUrl)
    if (exists) {
      console.log(`✅ Channel-specific URL works: ${channelUrl}`)
      return channelUrl
    } else {
      console.log(`❌ Channel-specific URL doesn't work: ${channelUrl}`)
    }
  } catch (error) {
    console.error(`Error checking channel-specific URL: ${channelUrl}`, error)
  }

  // If the specific pattern doesn't work, try other patterns
  const urlPatterns = [
    // Try with single slash
    `${supabaseUrl}/storage/v1/object/public/channel${channelId}/${baseFileName}`,
    // Try with videos bucket
    `${supabaseUrl}/storage/v1/object/public/videos/${baseFileName}`,
    // Try with videos/channel subfolder
    `${supabaseUrl}/storage/v1/object/public/videos/channel${channelId}/${baseFileName}`,
    // Try with just the channel number as bucket
    `${supabaseUrl}/storage/v1/object/public/${channelId}/${baseFileName}`,
    // Try with ch prefix
    `${supabaseUrl}/storage/v1/object/public/ch${channelId}/${baseFileName}`,
  ]

  for (const url of urlPatterns) {
    try {
      console.log(`Trying URL pattern: ${url}`)
      const exists = await checkUrlExists(url)
      if (exists) {
        console.log(`✅ URL pattern works: ${url}`)
        return url
      } else {
        console.log(`❌ URL pattern doesn't work: ${url}`)
      }
    } catch (error) {
      console.error(`Error checking URL pattern: ${url}`, error)
    }
  }

  // If all else fails, return the original URL as a last resort
  if (mp4Url.match(/^https?:\/\//i) || mp4Url.includes(".mp4") || mp4Url.includes(".m3u8")) {
    console.log(`Returning original URL as last resort: ${mp4Url}`)
    return mp4Url
  }

  console.log(`❌ All URL resolution methods failed for ${mp4Url}`)
  return null
}

export async function testAllVideoFormats(
  channelId: string,
  fileName: string,
): Promise<Array<{ url: string; works: boolean }>> {
  const baseUrl = "https://msllqpnxwbugvkpnquwx.supabase.co/storage/v1/object/public"

  const urlFormats = [
    `${baseUrl}/channel${channelId}/${fileName}`,
    `${baseUrl}/channel${channelId}//${fileName}`, // Note the double slash
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

// Update the findWorkingVideoUrl function to be more comprehensive and add better logging
export async function checkRLSStatus(bucketName: string): Promise<{
  enabled: boolean
  hasPublicPolicy: boolean
  canAccess: boolean
}> {
  try {
    // Try to list files in the bucket
    const { data: files, error: listError } = await supabase.storage.from(bucketName).list()

    if (listError) {
      console.error(`Error listing files in bucket ${bucketName}:`, listError)
      return {
        enabled: true, // Assuming RLS is enabled if we get an error
        hasPublicPolicy: false,
        canAccess: false,
      }
    }

    // If we can list files, check if we can get a public URL for the first file
    if (files && files.length > 0) {
      const firstFile = files[0]
      const { data } = supabase.storage.from(bucketName).getPublicUrl(firstFile.name)

      if (data?.publicUrl) {
        // Check if the URL actually works
        const exists = await checkUrlExists(data.publicUrl)
        return {
          enabled: !exists, // If URL doesn't work, RLS is likely enabled
          hasPublicPolicy: exists,
          canAccess: exists,
        }
      }
    }

    return {
      enabled: false,
      hasPublicPolicy: true,
      canAccess: true,
    }
  } catch (e) {
    console.error(`Error checking RLS status for bucket ${bucketName}:`, e)
    return {
      enabled: true,
      hasPublicPolicy: false,
      canAccess: false,
    }
  }
}

export async function saveWatchProgress(programId: number, currentTime: number): Promise<void> {
  try {
    const userId = "guest" // Replace with actual user ID if available
    localStorage.setItem(`watch_progress_${userId}_${programId}`, currentTime.toString())
    console.log(`Saved watch progress for program ${programId}: ${currentTime}s`)
  } catch (error) {
    console.error("Error saving watch progress:", error)
    throw error
  }
}

export async function getWatchProgress(programId: number): Promise<number | null> {
  try {
    const userId = "guest" // Replace with actual user ID if available
    const savedProgress = localStorage.getItem(`watch_progress_${userId}_${programId}`)
    if (savedProgress) {
      return Number.parseFloat(savedProgress)
    }
    return null
  } catch (error) {
    console.error("Error getting watch progress:", error)
    return null
  }
}
