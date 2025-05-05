export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export interface Database {
  public: {
    Tables: {
      channels: {
        Row: {
          description: string | null
          id: string
          logo_url: string | null
          name: string | null
          password_protected: boolean | null
          slug: string | null
        }
        Insert: {
          description?: string | null
          id: string
          logo_url?: string | null
          name?: string | null
          password_protected?: boolean | null
          slug?: string | null
        }
        Update: {
          description?: string | null
          id?: string
          logo_url?: string | null
          name?: string | null
          password_protected?: boolean | null
          slug?: string | null
        }
        Relationships: []
      }
      programs: {
        Row: {
          channel_id: string | null
          duration: number | null
          id: number
          mp4_url: string | null
          start_time: string | null
          title: string | null
        }
        Insert: {
          channel_id?: string | null
          duration?: number | null
          id?: number
          mp4_url?: string | null
          start_time?: string | null
          title?: string | null
        }
        Update: {
          channel_id?: string | null
          duration?: number | null
          id?: number
          mp4_url?: string | null
          start_time?: string | null
          title?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      exec_sql: {
        Args: {
          sql: string
        }
        Returns: undefined
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}
