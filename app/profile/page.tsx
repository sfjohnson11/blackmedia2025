"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { ArrowLeft, User, Settings, Heart, Clock, LogOut } from "lucide-react"
import { getFavorites } from "@/lib/favorites"
import { getContinueWatching } from "@/lib/continue"
import type { Program } from "@/types"

export default function ProfilePage() {
  const [favorites, setFavorites] = useState<Program[]>([])
  const [history, setHistory] = useState<Program[]>([])
  const [user, setUser] = useState<any>(null)

  useEffect(() => {
    async function loadData() {
      const favIds = getFavorites()
      const watchIds = getContinueWatching()

      if (favIds.length > 0) {
        const { data } = await supabase.from("programs").select("*").in("id", favIds)
        setFavorites(data || [])
      }

      if (watchIds.length > 0) {
        const { data } = await supabase.from("programs").select("*")
        const filtered = (data || []).filter((p) =>
          watchIds.includes(`https://msllqpnxwbugvkpnquwx.supabase.co/storage/v1/object/public/channel${p.channel_id}/${p.mp4_url}`)
        )
        setHistory(filtered)
      }

      const {
        data: { user },
      } = await supabase.auth.getUser()
      setUser(user)
    }
    loadData()
  }, [])

  return (
    <div className="pt-24 px-4 md:px-10 min-h-screen">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center mb-8">
          <Link href="/" className="mr-4">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Home
            </Button>
          </Link>
          <h1 className="text-3xl font-bold">Your Profile</h1>
        </div>

        <div className="bg-gray-800 rounded-lg p-6 mb-8">
          <div className="flex flex-col md:flex-row items-center md:items-start gap-6">
            <div className="bg-gray-700 rounded-full w-24 h-24 flex items-center justify-center">
              <User className="h-12 w-12 text-gray-400" />
            </div>
            <div className="flex-1 text-center md:text-left">
              <h2 className="text-2xl font-bold mb-2">{user?.email || "Guest User"}</h2>
              <p className="text-gray-400 mb-4">Welcome to Black Truth TV</p>
              <div className="flex flex-wrap gap-3 justify-center md:justify-start">
                <Button variant="outline" size="sm" className="flex items-center gap-2">
                  <Settings className="h-4 w-4" />
                  Account Settings
                </Button>
                <Link href="/donate">
                  <Button size="sm" className="bg-red-600 hover:bg-red-700 flex items-center gap-2">
                    <Heart className="h-4 w-4" />
                    Support Us
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <div className="bg-gray-800 rounded-lg p-6">
            <h3 className="text-xl font-bold mb-4 flex items-center">
              <Clock className="h-5 w-5 mr-2 text-blue-400" />
              Recently Watched
            </h3>
            {history.length === 0 ? (
              <p className="text-gray-400 text-center py-8">Your watch history will appear here</p>
            ) : (
              <ul className="space-y-2">
                {history.map((p) => (
                  <li key={p.id} className="text-white text-sm">
                    <Link href={`/watch/${p.channel_id}`} className="hover:underline">
                      {p.title} (Channel {p.channel_id})
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="bg-gray-800 rounded-lg p-6">
            <h3 className="text-xl font-bold mb-4 flex items-center">
              <Heart className="h-5 w-5 mr-2 text-red-400" />
              Favorite Programs
            </h3>
            {favorites.length === 0 ? (
              <p className="text-gray-400 text-center py-8">Your favorite programs will appear here</p>
            ) : (
              <ul className="space-y-2">
                {favorites.map((p) => (
                  <li key={p.id} className="text-white text-sm">
                    <Link href={`/watch/${p.channel_id}`} className="hover:underline">
                      {p.title} (Channel {p.channel_id})
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="bg-gray-800 rounded-lg p-6 mb-8">
          <h3 className="text-xl font-bold mb-4">Account Actions</h3>
          <div className="space-y-3">
            <Button variant="outline" className="w-full justify-start">
              <Settings className="h-4 w-4 mr-2" />
              Manage Account Settings
            </Button>
            <Link href="/donate" className="block">
              <Button variant="outline" className="w-full justify-start">
                <Heart className="h-4 w-4 mr-2 text-red-500" />
                Donation History
              </Button>
            </Link>
            <Button
              variant="outline"
              className="w-full justify-start text-red-500 hover:text-red-400"
              onClick={async () => {
                await supabase.auth.signOut()
                location.reload()
              }}
            >
              <LogOut className="h-4 w-4 mr-2" />
              Sign Out
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
