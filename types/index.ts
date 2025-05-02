export interface Channel {
  id: string
  name: string
  slug: string
  description: string
  logo_url?: string
}

export interface Program {
  id: number
  channel_id: string
  title: string
  mp4_url: string
  start_time: string
  duration?: number
}

export interface Video {
  id: number
  title: string
  description?: string
  url: string
  thumbnail_url?: string
  channel_id: string
  duration: number
  created_at: string
}

export interface CurrentlyPlaying {
  channelId: string
  programId: number
  progress: number
}
