export interface Channel {
  id: string
  name: string
  slug?: string | null
  description?: string | null
  logo_url?: string | null
  password_protected?: boolean | null
  // Add any other fields from your 'channels' table
}

export interface Program {
  id: number
  channel_id: string
  title: string
  mp4_url: string
  start_time: string // ISO 8601 date string
  duration: number | null // Duration in seconds
  poster_url?: string | null
  // Add any other fields from your 'programs' table
}

export interface CurrentlyPlaying {
  channelId: string
  programId: number
  progress: number
}

export interface Video {
  id: number
  channel_id: string
  title: string
  mp4_url: string
  start_time: string
  duration: number
}

// New interface for channel access
export interface ChannelAccess {
  channelId: string
  hasAccess: boolean
  timestamp: number
}
