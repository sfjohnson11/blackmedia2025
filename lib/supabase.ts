import { createClient } from "@supabase/supabase-js"
import type { Program, Channel } from "@/types"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export const STANDBY_PLACEHOLDER_ID = "standby"

export function getFullUrl(pathFromDB?: string | null): string | undefined {
  if (!pathFromDB || !supabaseUrl) {
    return undefined
  }
  const cleanPath = pathFromDB.startsWith("/") ? pathFromDB.substring(1) : pathFromDB
  return `${supabaseUrl}/storage/v1/object/public/${cleanPath}`
}

export function getVideoUrlForProgram(program: Program | null | undefined): string | undefined {
  if (!program || !program.mp4_url || typeof program.channel_id !== "number" || !supabaseUrl) {
    return undefined
  }

  if (program.channel_id === 21 && program.mp4_url.endsWith(".m3u8")) {
    return program.mp4_url
  }

  const bucket = `channel${program.channel_id}`
  const objectPath =
    program.id === STANDBY_PLACEHOLDER_ID ? program.mp4_url : `${bucket}/${program.mp4_url.replace(/^\//, "")}`

  return `${supabaseUrl}/storage/v1/object/public/${objectPath.replace(/\/\//g, "/")}`
}

export async function fetchChannelDetails(channelId: string): Promise<Channel | null> {
  const { data, error } = await supabase.from("channels").select("*").eq("id", channelId).single()
  if (error) {
    console.error("Error fetching channel details:", error)
    return null
  }
  return data as Channel
}

export async function fetchProgramsForChannel(channelId: string): Promise<Program[]> {
  const { data, error } = await supabase
    .from("programs")
    .select("*, duration")
    .eq("channel_id", channelId)
    .order("start_time", { ascending: true })

  if (error) {
    console.error(`Supabase error for channel ${channelId}:`, error)
    throw error
  }
  return (data as Program[]) || []
}

export const getCurrentProgram = async (channelId: string): Promise<Program | null> => {
  const now = new Date()
  try {
    const programs = await fetchProgramsForChannel(channelId)
    return (
      programs.find((prog) => {
        if (!prog.start_time || typeof prog.duration !== "number") return false
        const startTime = new Date(prog.start_time)
        const endTime = new Date(startTime.getTime() + prog.duration * 1000)
        return now >= startTime && now < endTime
      }) || null
    )
  } catch (error) {
    console.error(`Error in getCurrentProgram for channel ${channelId}:`, error)
    return null
  }
}

// RESTORED: All necessary utility functions
export async function getUpcomingPrograms(channelId: string, limit = 5): Promise<Program[]> {
  const now = new Date()
  const { data, error } = await supabase
    .from("programs")
    .select("*, duration")
    .eq("channel_id", channelId)
    .gt("start_time", now.toISOString())
    .order("start_time", { ascending: true })
    .limit(limit)
  if (error) {
    console.error("Error fetching upcoming programs:", error)
    return []
  }
  return (data as Program[]) || []
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
    const response = await fetch("/api/refresh-cache", { method: "GET" })
    if (!response.ok) throw new Error(`Failed to refresh cache: ${response.status}`)
    return { success: true }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
}

export async function saveWatchProgress(programId: string | number, position: number) {
  if (typeof window === "undefined") return
  try {
    localStorage.setItem(`watch_progress_${programId}`, position.toString())
  } catch (err) {
    console.error("Error saving watch progress:", err)
  }
}

export async function getWatchProgress(programId: string | number): Promise<number | null> {
  if (typeof window === "undefined") return null
  try {
    const progress = localStorage.getItem(`watch_progress_${programId}`)
    return progress ? Number.parseFloat(progress) : null
  } catch (err) {
    console.error("Error getting watch progress:", err)
    return null
  }
}

export function shouldDisableAutoRefresh(duration: number): boolean {
  return duration > 600
}

export const isLiveChannel = (channelId: string): boolean => {
  return channelId === "21"
}

export async function createTables() {
  const sql = `
    CREATE TABLE IF NOT EXISTS channels (id TEXT PRIMARY KEY, name TEXT, slug TEXT, description TEXT, logo_url TEXT, password_protected BOOLEAN);
    CREATE TABLE IF NOT EXISTS programs (id SERIAL PRIMARY KEY, channel_id TEXT, title TEXT, mp4_url TEXT, start_time TEXT, duration INTEGER);
  `
  const { error } = await supabase.rpc("exec_sql", { sql_query: sql })
  if (error) console.error("Error creating tables:", error)
}

export async function checkRLSStatus(bucketName: string) {
  const { data, error } = await supabase.storage.from(bucketName).list(undefined, { limit: 1 })
  return { canList: !error, error }
}

export async function listBuckets() {
  return await supabase.storage.listBuckets()
}
