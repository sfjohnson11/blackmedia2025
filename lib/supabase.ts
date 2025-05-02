import { createClient } from "@supabase/supabase-js"

// Use environment variables with fallback to hardcoded values
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://msllqpnxwbugvkpnquwx.supabase.co"
const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1zbGxxcG54d2J1Z3ZrcG5xdXd4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDYxNDM3MDcsImV4cCI6MjA2MTcxOTcwN30.GmBaiUunC9R9gZh0IH8fp2VsY55d3SC_dvRagrJoUzA"

// Create the Supabase client
export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Helper function to check if Supabase is accessible
export async function checkSupabaseConnection() {
  try {
    // Simple query to check connection
    const { error } = await supabase.from("_dummy_query_").select("*").limit(1)
    // If we get a "relation does not exist" error, that means the connection works
    // but the table doesn't exist, which is fine for this check
    return error?.code === "PGRST116" || !error
  } catch (e) {
    console.error("Supabase connection check failed:", e)
    return false
  }
}

// Helper function to check if tables exist
export async function checkTablesExist() {
  try {
    // Try to query the channels table
    const { error } = await supabase.from("channels").select("count", { count: "exact", head: true })
    return !error
  } catch (e) {
    console.error("Table check failed:", e)
    return false
  }
}

// Helper function to create tables directly
export async function createTables() {
  const sql = `
  -- Create channels table if it doesn't exist
  CREATE TABLE IF NOT EXISTS channels (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    slug TEXT NOT NULL,
    description TEXT,
    logo_url TEXT
  );

  -- Create programs table if it doesn't exist
  CREATE TABLE IF NOT EXISTS programs (
    id SERIAL PRIMARY KEY,
    channel_id TEXT REFERENCES channels(id),
    title TEXT NOT NULL,
    mp4_url TEXT NOT NULL,
    start_time TIMESTAMP WITH TIME ZONE NOT NULL,
    duration INTEGER DEFAULT 3600
  );

  -- Disable RLS initially
  ALTER TABLE channels DISABLE ROW LEVEL SECURITY;
  ALTER TABLE programs DISABLE ROW LEVEL SECURITY;
  `

  try {
    const { error } = await supabase.rpc("exec_sql", { sql })
    if (error) throw error
    return { success: true, error: null }
  } catch (error) {
    console.error("Error creating tables:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}

// Helper function to enable RLS and set policies
export async function enableRLS() {
  const sql = `
  -- Enable RLS
  ALTER TABLE channels ENABLE ROW LEVEL SECURITY;
  ALTER TABLE programs ENABLE ROW LEVEL SECURITY;

  -- Create public access policies (only if they don't exist)
  DO $$
  BEGIN
    -- SELECT policies
    BEGIN
      CREATE POLICY "Channels are viewable by everyone" 
      ON channels FOR SELECT USING (true);
    EXCEPTION
      WHEN duplicate_object THEN
        NULL;
    END;

    BEGIN
      CREATE POLICY "Programs are viewable by everyone" 
      ON programs FOR SELECT USING (true);
    EXCEPTION
      WHEN duplicate_object THEN
        NULL;
    END;

    -- INSERT policies
    BEGIN
      CREATE POLICY "Anyone can insert channels" 
      ON channels FOR INSERT WITH CHECK (true);
    EXCEPTION
      WHEN duplicate_object THEN
        NULL;
    END;

    BEGIN
      CREATE POLICY "Anyone can insert programs" 
      ON programs FOR INSERT WITH CHECK (true);
    EXCEPTION
      WHEN duplicate_object THEN
        NULL;
    END;

    -- UPDATE policies
    BEGIN
      CREATE POLICY "Anyone can update channels" 
      ON channels FOR UPDATE USING (true);
    EXCEPTION
      WHEN duplicate_object THEN
        NULL;
    END;

    BEGIN
      CREATE POLICY "Anyone can update programs" 
      ON programs FOR UPDATE USING (true);
    EXCEPTION
      WHEN duplicate_object THEN
        NULL;
    END;

    -- DELETE policies
    BEGIN
      CREATE POLICY "Anyone can delete channels" 
      ON channels FOR DELETE USING (true);
    EXCEPTION
      WHEN duplicate_object THEN
        NULL;
    END;

    BEGIN
      CREATE POLICY "Anyone can delete programs" 
      ON programs FOR DELETE USING (true);
    EXCEPTION
      WHEN duplicate_object THEN
        NULL;
    END;
  END $$;
  `

  try {
    const { error } = await supabase.rpc("exec_sql", { sql })
    if (error) throw error
    return { success: true, error: null }
  } catch (error) {
    console.error("Error enabling RLS:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}

// Helper function to get the current program for a channel
export async function getCurrentProgram(channelId: string) {
  const now = new Date().toISOString()

  try {
    // Get the program that's currently playing or the next one
    const { data: currentProgram, error: currentError } = await supabase
      .from("programs")
      .select("*")
      .eq("channel_id", channelId)
      .lte("start_time", now)
      .order("start_time", { ascending: false })
      .limit(1)

    if (currentError) throw currentError

    // If no current program, get the next scheduled program
    if (!currentProgram || currentProgram.length === 0) {
      const { data: nextProgram, error: nextError } = await supabase
        .from("programs")
        .select("*")
        .eq("channel_id", channelId)
        .gt("start_time", now)
        .order("start_time", { ascending: true })
        .limit(1)

      if (nextError) throw nextError

      if (nextProgram && nextProgram.length > 0) {
        return { program: nextProgram[0], isNext: true }
      }

      return { program: null, isNext: false }
    }

    return { program: currentProgram[0], isNext: false }
  } catch (error) {
    console.error("Error getting current program:", error)
    return { program: null, isNext: false, error }
  }
}

// Helper function to get upcoming programs for a channel
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

    if (error) throw error

    return { programs: data || [], error: null }
  } catch (error) {
    console.error("Error getting upcoming programs:", error)
    return { programs: [], error }
  }
}

// Helper function to calculate program progress
export function calculateProgramProgress(program: { start_time: string; duration: number }) {
  const now = new Date()
  const startTime = new Date(program.start_time)
  const durationMs = (program.duration || 3600) * 1000 // Convert seconds to ms

  // Calculate elapsed time in ms
  const elapsedMs = now.getTime() - startTime.getTime()

  // Calculate progress percentage
  const progressPercent = Math.min(100, Math.max(0, (elapsedMs / durationMs) * 100))

  // Calculate seconds elapsed
  const secondsElapsed = Math.floor(elapsedMs / 1000)

  return {
    progressPercent,
    secondsElapsed,
    isFinished: elapsedMs >= durationMs,
  }
}

// Helper function to get video URL from bucket
export function getVideoUrl(channelId: string, mp4Url: string) {
  // Updated to use the correct bucket path format
  return `${supabaseUrl}/storage/v1/object/public/videos/channel${channelId}/${mp4Url}`
}

// Helper function to check if a file exists in storage
export async function checkFileExists(bucket: string, path: string) {
  try {
    const { data, error } = await supabase.storage.from(bucket).download(path)
    return !error && data !== null
  } catch (e) {
    console.error("Error checking file:", e)
    return false
  }
}

// Helper function to list all buckets
export async function listBuckets() {
  try {
    const { data, error } = await supabase.storage.listBuckets()
    if (error) throw error
    return data
  } catch (e) {
    console.error("Error listing buckets:", e)
    return []
  }
}

// Helper function to list files in a bucket
export async function listFiles(bucket: string) {
  try {
    const { data, error } = await supabase.storage.from(bucket).list()
    if (error) throw error
    return data
  } catch (e) {
    console.error(`Error listing files in bucket ${bucket}:`, e)
    return []
  }
}
