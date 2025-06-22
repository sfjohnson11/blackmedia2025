export interface Channel {
  id: string
  name: string
  slug: string
  description?: string
  logo_url?: string
  password_protected?: boolean | null
}

export interface Program {
  id: string | number
  channel_id: number // Should consistently be a number
  title: string
  mp4_url: string
  start_time: string // ISO string
  duration: number // CRITICAL: This is the duration in seconds
  description?: string | null
  poster_url?: string | null
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

export interface ChannelAccess {
  channelId: string
  hasAccess: boolean
  timestamp: number
}

export interface LibraryItem {
  id: string
  title: string
  type: "video" | "audio" | "document"
  description?: string
  media_url?: string
  thumbnail_url?: string
  channel_id?: number
  created_at: string
  document_text_content?: string
}

export interface LibraryItemData {
  id: string
  title: string
  description?: string | null
  type: "document" | "audio" | "video"
  url?: string | null
  thumbnail_url?: string | null
  channel_id?: string | null
  date_added: string
  file_size_mb?: number | null
  duration_seconds?: number | null
  content?: string | null
  created_at: string
}
