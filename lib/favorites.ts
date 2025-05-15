// lib/favorites.ts
export function getFavorites(): string[] {
  if (typeof window === "undefined") return []
  const stored = localStorage.getItem("favorite_programs")
  return stored ? JSON.parse(stored) : []
}

export function toggleFavorite(programId: string) {
  const favorites = getFavorites()
  const updated = favorites.includes(programId)
    ? favorites.filter((id) => id !== programId)
    : [...favorites, programId]
  localStorage.setItem("favorite_programs", JSON.stringify(updated))
}

export function isFavorited(programId: string): boolean {
  return getFavorites().includes(programId)
}


// lib/continue.ts
export function getContinueWatching(): string[] {
  if (typeof window === "undefined") return []
  const keys = Object.keys(localStorage).filter((k) => k.startsWith("video_progress_"))
  return keys.map((k) => k.replace("video_progress_", ""))
}

export function getProgressFor(src: string) {
  const raw = localStorage.getItem(`video_progress_${src}`)
  return raw ? JSON.parse(raw) : null
}


// app/admin/favorites/page.tsx
"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { getFavorites } from "@/lib/favorites"
import type { Program } from "@/types"
import Link from "next/link"

export default function FavoritesPage() {
  const [programs, setPrograms] = useState<Program[]>([])

  useEffect(() => {
    async function load() {
      const ids = getFavorites()
      if (ids.length === 0) return
      const { data } = await supabase.from("programs").select("*").in("id", ids)
      setPrograms(data || [])
    }
    load()
  }, [])

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">❤️ Favorites</h1>
      {programs.length === 0 ? (
        <p className="text-gray-400">No favorites yet.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {programs.map((p) => (
            <Link key={p.id} href={`/watch/${p.channel_id}`} className="block bg-gray-800 p-4 rounded">
              <h2 className="text-white font-semibold mb-1">{p.title}</h2>
              <p className="text-sm text-gray-400">Channel {p.channel_id}</p>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}


// app/admin/continue/page.tsx
"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { getContinueWatching, getProgressFor } from "@/lib/continue"
import type { Program } from "@/types"
import Link from "next/link"

export default function ContinueWatchingPage() {
  const [programs, setPrograms] = useState<Program[]>([])

  useEffect(() => {
    async function load() {
      const srcList = getContinueWatching()
      if (srcList.length === 0) return

      const { data } = await supabase.from("programs").select("*")
      const filtered = (data || []).filter((p) =>
        srcList.includes(`https://msllqpnxwbugvkpnquwx.supabase.co/storage/v1/object/public/channel${p.channel_id}/${p.mp4_url}`)
      )

      setPrograms(filtered)
    }
    load()
  }, [])

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">⏯️ Continue Watching</h1>
      {programs.length === 0 ? (
        <p className="text-gray-400">No videos in progress.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {programs.map((p) => (
            <Link key={p.id} href={`/watch/${p.channel_id}`} className="block bg-gray-800 p-4 rounded">
              <h2 className="text-white font-semibold mb-1">{p.title}</h2>
              <p className="text-sm text-gray-400">Channel {p.channel_id}</p>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
