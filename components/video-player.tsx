// lib/supabase.ts
import { createClient } from "@supabase/supabase-js"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Ensure we do NOT hardcode "videos/" or override pathing
export function getFullUrl(path: string): string {
  if (!path) return ""
  const cleanedPath = path.startsWith("/") ? path.slice(1) : path
  const fullUrl = `${supabaseUrl}/storage/v1/object/public/${cleanedPath}`
  return fullUrl.replace(/([^:]\/)\/+/, "$1") // fix double slashes
}

export async function getCurrentProgram(channelId: number) {
  const now = new Date().toISOString()
  const { data, error } = await supabase
    .from("programs")
    .select("*")
    .eq("channel_id", channelId)
    .lte("start_time", now)
    .order("start_time", { ascending: false })
    .limit(1)

  if (error) throw error
  return { program: data?.[0] || null }
}

export async function getUpcomingPrograms(channelId: number) {
  const now = new Date().toISOString()
  const { data, error } = await supabase
    .from("programs")
    .select("*")
    .eq("channel_id", channelId)
    .gt("start_time", now)
    .order("start_time", { ascending: true })

  if (error) throw error
  return { programs: data || [] }
}

export async function forceRefreshAllData() {
  // No-op if not implemented; useful for future cache busting
  return true
}
