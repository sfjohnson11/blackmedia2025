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
