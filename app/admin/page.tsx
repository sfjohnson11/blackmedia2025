"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import {
  Settings,
  Upload,
  Database,
  ImageIcon,
  Users,
  Calendar,
  RefreshCw,
  Lock,
  Radio,
  Clock,
  FileVideo,
  Trash2,
  Code,
} from "lucide-react"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"

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
        { name: "Video Processor", href: "/admin/video-processor", icon: <FileVideo className="h-4 w-4" /> },
        { name: "Refresh Programs", href: "/admin/refresh-programs", icon: <RefreshCw className="h-4 w-4" /> },
        { name: "Reset Programs", href: "/admin/reset-programs", icon: <Trash2 className="h-4 w-4" /> },
      ],
    },
    {
      title: "System Setup",
      description: "Database and system configuration",
      icon: <Settings className="h-8 w-8 text-red-500" />,
      links: [
        { name: "SQL Setup", href: "/setup/sql-setup", icon: <Database className="h-4 w-4" /> },
        { name: "Debug Storage", href: "/debug", icon: <RefreshCw className="h-4 w-4" /> },
        { name: "SQL Query Tool", href: "/admin/sql-query", icon: <Code className="h-4 w-4" /> },
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

        <Card>
          <CardHeader>
            <CardTitle>Video Processor</CardTitle>
            <CardDescription>Process and fix video URLs</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-400 mb-4">
              Check and fix video URLs, test playback, and manage program data.
            </p>
          </CardContent>
          <CardFooter>
            <Link href="/admin/video-processor" className="w-full">
              <Button className="w-full">Open Video Processor</Button>
            </Link>
          </CardFooter>
        </Card>

        <Card className="bg-red-900/10 border-red-900/30">
          <CardHeader>
            <CardTitle className="text-red-400">Reset Programs</CardTitle>
            <CardDescription>Delete all programs and start fresh</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-400 mb-4">
              Completely reset program data to fix issues with old or duplicate programs.
            </p>
          </CardContent>
          <CardFooter>
            <Link href="/admin/reset-programs" className="w-full">
              <Button className="w-full bg-red-600 hover:bg-red-700">Reset Programs</Button>
            </Link>
          </CardFooter>
        </Card>

        <div className="bg-red-900/20 p-6 rounded-lg shadow-md border border-red-900/30">
          <h3 className="text-xl font-semibold mb-4 flex items-center text-red-400">
            <Trash2 className="mr-2 h-5 w-5" />
            Reset Program Data
          </h3>
          <p className="text-gray-300 mb-4">
            Completely delete program data from the database and start fresh. Use this when you need to remove old
            programs.
          </p>
          <Link href="/admin/reset-programs">
            <Button className="w-full bg-red-600 hover:bg-red-700">Reset Programs</Button>
          </Link>
        </div>

        <div className="bg-blue-900/20 p-6 rounded-lg shadow-md border border-blue-900/30">
          <h3 className="text-xl font-semibold mb-4 flex items-center text-blue-400">
            <Code className="mr-2 h-5 w-5" />
            SQL Query Tool
          </h3>
          <p className="text-gray-300 mb-4">
            Execute SQL queries directly against your database for advanced troubleshooting and data management.
          </p>
          <Link href="/admin/sql-query">
            <Button className="w-full bg-blue-600 hover:bg-blue-700">Open SQL Tool</Button>
          </Link>
        </div>
      </div>
      <Link href="/admin/clear-cache">
        <div className="bg-gray-800 rounded-lg p-6 hover:bg-gray-700 transition-colors h-full">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-bold">Clear Cache</h3>
            <Trash2 className="h-6 w-6 text-red-500" />
          </div>
          <p className="text-gray-300 mb-4">
            Clear browser cache and local storage to fix issues with data not updating properly.
          </p>
          <div className="text-sm text-gray-400">Use when news items or other data isn't refreshing</div>
        </div>
      </Link>
    </div>
  )
}
