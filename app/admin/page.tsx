"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Settings, Upload, Database, ImageIcon, Users, Calendar, RefreshCw, Lock, Radio, Clock } from "lucide-react"

export default function AdminDashboard() {
  const [stats, setStats] = useState({
    channelCount: 0,
    programCount: 0,
    loading: true,
  })

  useEffect(() => {
    async function fetchStats() {
      try {
        // Get channel count
        const { count: channelCount, error: channelError } = await supabase
          .from("channels")
          .select("*", { count: "exact", head: true })

        // Get program count
        const { count: programCount, error: programError } = await supabase
          .from("programs")
          .select("*", { count: "exact", head: true })

        if (channelError) throw channelError
        if (programError) throw programError

        setStats({
          channelCount: channelCount || 0,
          programCount: programCount || 0,
          loading: false,
        })
      } catch (error) {
        console.error("Error fetching stats:", error)
        setStats((prev) => ({ ...prev, loading: false }))
      }
    }

    fetchStats()
  }, [])

  const adminLinks = [
    {
      title: "Channel Management",
      description: "Import, edit, and manage channel data",
      icon: <Users className="h-8 w-8 text-blue-500" />,
      links: [
        { name: "Import Channels", href: "/setup/import", icon: <Upload className="h-4 w-4" /> },
        { name: "Update Channel Images", href: "/setup/upload-channel-image", icon: <ImageIcon className="h-4 w-4" /> },
        { name: "Browse Channels", href: "/channels", icon: <Users className="h-4 w-4" /> },
        { name: "Channel Passwords", href: "/admin/channel-passwords", icon: <Lock className="h-4 w-4" /> },
      ],
    },
    {
      title: "Content Management",
      description: "Manage programs, news, and site content",
      icon: <Calendar className="h-8 w-8 text-green-500" />,
      links: [
        { name: "Import Programs", href: "/setup/import-programs", icon: <Upload className="h-4 w-4" /> },
        { name: "Monday Schedule Helper", href: "/admin/monday-schedule", icon: <Clock className="h-4 w-4" /> },
        { name: "Breaking News", href: "/admin/news", icon: <Radio className="h-4 w-4" /> },
        { name: "View Schedule", href: "/browse", icon: <Calendar className="h-4 w-4" /> },
      ],
    },
    {
      title: "System Setup",
      description: "Database and system configuration",
      icon: <Settings className="h-8 w-8 text-red-500" />,
      links: [
        { name: "SQL Setup", href: "/setup/sql-setup", icon: <Database className="h-4 w-4" /> },
        { name: "Debug Storage", href: "/debug", icon: <RefreshCw className="h-4 w-4" /> },
      ],
    },
  ]

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Admin Dashboard</h1>
        <p className="text-gray-400">Manage your Black Truth TV platform</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-gray-800 p-6 rounded-lg border border-gray-700">
          <h2 className="text-2xl font-bold text-red-500 mb-1">{stats.loading ? "..." : stats.channelCount}</h2>
          <p className="text-gray-400">Total Channels</p>
        </div>
        <div className="bg-gray-800 p-6 rounded-lg border border-gray-700">
          <h2 className="text-2xl font-bold text-red-500 mb-1">{stats.loading ? "..." : stats.programCount}</h2>
          <p className="text-gray-400">Total Programs</p>
        </div>
        <div className="bg-gray-800 p-6 rounded-lg border border-gray-700">
          <h2 className="text-2xl font-bold text-red-500 mb-1">29</h2>
          <p className="text-gray-400">Active Channels</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {adminLinks.map((section, index) => (
          <div key={index} className="bg-gray-800 rounded-lg overflow-hidden border border-gray-700">
            <div className="p-6">
              <div className="flex items-center mb-4">
                <div className="mr-4">{section.icon}</div>
                <h2 className="text-xl font-bold">{section.title}</h2>
              </div>
              <p className="text-gray-400 mb-6">{section.description}</p>
              <div className="space-y-2">
                {section.links.map((link, linkIndex) => (
                  <Link key={linkIndex} href={link.href} className="block">
                    <Button
                      variant="outline"
                      className="w-full justify-start text-left bg-gray-700 hover:bg-gray-600 border-gray-600"
                    >
                      {link.icon}
                      <span className="ml-2">{link.name}</span>
                    </Button>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
