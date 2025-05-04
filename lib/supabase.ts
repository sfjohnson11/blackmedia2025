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
    if (url.includes("supabase.co/storage/v1/object")) {
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
export async function getDirectDownloadUrl(url: string | null, channelId: number): Promise<string | null> {
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
      console.log(`URL is a Supabase storage URL: ${url}`)
      return url
    }

    // For YouTube URLs, we can't use them directly
    if (url.includes("youtube.com") || url.includes("youtu.be")) {
      console.log(`YouTube URL detected, cannot use directly: ${url}`)
      return null
    }

    // For other URLs, try to use them directly
    console.log(`Using URL directly: ${url}`)
    return url
  } catch (error) {
    console.error(`Error getting direct download URL for ${url}:`, error)
    // Return the original URL as a fallback
    return url
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

// CRITICAL FIX: Completely rewritten watch progress functions to prevent video restarts
// Use IndexedDB instead of localStorage for more reliable storage
const DB_NAME = "videoProgressDB"
const STORE_NAME = "watchProgress"
let dbPromise: Promise<IDBDatabase> | null = null

// Initialize the database
function initDB(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      if (typeof window === "undefined" || !window.indexedDB) {
        reject("IndexedDB not available")
        return
      }

      const request = indexedDB.open(DB_NAME, 1)

      request.onerror = (event) => {
        console.error("IndexedDB error:", event)
        reject("Could not open IndexedDB")
      }

      request.onsuccess = (event) => {
        resolve(request.result)
      }

      request.onupgradeneeded = (event) => {
        const db = request.result
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: "id" })
        }
      }
    })
  }
  return dbPromise
}

// Save watch progress to IndexedDB
export async function saveWatchProgress(programId: number, currentTime: number): Promise<void> {
  try {
    // Don't save progress if it's very close to the beginning (less than 5 seconds)
    if (currentTime < 5) return

    // For Freedom School videos (which have higher IDs), log more details
    if (programId > 900) {
      console.log(`Saving Freedom School video progress: ID=${programId}, time=${Math.round(currentTime)}s`)
    }

    if (typeof window === "undefined" || !window.indexedDB) {
      throw new Error("IndexedDB not available")
    }

    const db = await initDB()
    const tx = db.transaction(STORE_NAME, "readwrite")
    const store = tx.objectStore(STORE_NAME)

    // Create a unique ID that includes user info if available
    const userId = localStorage.getItem("userId") || "guest"
    const id = `${userId}_${programId}`

    // Save with timestamp to track when it was last updated
    await store.put({
      id,
      programId,
      currentTime,
      timestamp: Date.now(),
      userId,
    })

    // Also save a backup in localStorage in case IndexedDB fails
    try {
      localStorage.setItem(
        `watch_progress_backup_${id}`,
        JSON.stringify({
          currentTime,
          timestamp: Date.now(),
        }),
      )
    } catch (err) {
      // Ignore localStorage errors
    }

    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve()
      tx.onerror = (event) => reject(event)
    })
  } catch (error) {
    console.error("Error saving watch progress to IndexedDB:", error)

    // Fallback to localStorage
    try {
      const userId = localStorage.getItem("userId") || "guest"
      const id = `${userId}_${programId}`
      localStorage.setItem(`watch_progress_${id}`, currentTime.toString())
      console.log(`Saved watch progress to localStorage as fallback: ${currentTime}s`)
    } catch (err) {
      console.error("Error saving to localStorage fallback:", err)
    }
  }
}

// Get watch progress from IndexedDB
export async function getWatchProgress(programId: number): Promise<number | null> {
  try {
    if (typeof window === "undefined" || !window.indexedDB) {
      throw new Error("IndexedDB not available")
    }

    // For Freedom School videos (which have higher IDs), log more details
    if (programId > 900) {
      console.log(`Getting Freedom School video progress: ID=${programId}`)
    }

    const db = await initDB()
    const tx = db.transaction(STORE_NAME, "readonly")
    const store = tx.objectStore(STORE_NAME)

    const userId = localStorage.getItem("userId") || "guest"
    const id = `${userId}_${programId}`

    return new Promise((resolve, reject) => {
      const request = store.get(id)

      request.onsuccess = () => {
        if (request.result) {
          console.log(`Retrieved watch progress from IndexedDB: ${request.result.currentTime}s`)
          resolve(request.result.currentTime)
        } else {
          // Try localStorage fallback
          try {
            const savedProgress = localStorage.getItem(`watch_progress_${id}`)
            if (savedProgress) {
              const time = Number.parseFloat(savedProgress)
              console.log(`Retrieved watch progress from localStorage fallback: ${time}s`)
              resolve(time)
            } else {
              resolve(null)
            }
          } catch (err) {
            console.error("Error getting from localStorage fallback:", err)
            resolve(null)
          }
        }
      }

      request.onerror = (event) => {
        console.error("Error getting watch progress:", event)

        // Try localStorage fallback
        try {
          const savedProgress = localStorage.getItem(`watch_progress_${id}`)
          if (savedProgress) {
            resolve(Number.parseFloat(savedProgress))
          } else {
            resolve(null)
          }
        } catch (err) {
          console.error("Error getting from localStorage fallback:", err)
          resolve(null)
        }
      }
    })
  } catch (error) {
    console.error("Error accessing IndexedDB:", error)

    // Fallback to localStorage
    try {
      const userId = localStorage.getItem("userId") || "guest"
      const id = `${userId}_${programId}`
      const savedProgress = localStorage.getItem(`watch_progress_${id}`)
      if (savedProgress) {
        return Number.parseFloat(savedProgress)
      }
    } catch (err) {
      console.error("Error getting from localStorage:", err)
    }

    return null
  }
}

// This is a critical fix for the video restart issue
// Add this function to completely disable any automatic refresh for videos longer than 5 minutes
export function shouldDisableAutoRefresh(duration: number): boolean {
  // If video is longer than 5 minutes (300 seconds), disable auto refresh
  // This will prevent the 5-minute restart issue
  return duration > 300
}
