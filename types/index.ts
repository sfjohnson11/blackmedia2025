export interface Channel {
  id: string
  name: string
  slug: string
  description: string
  logo_url?: string
  password_protected?: boolean
}

export interface Program {
  id: number
  channel_id: string
  title: string
  mp4_url: string
  start_time: string
  duration?: number
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
