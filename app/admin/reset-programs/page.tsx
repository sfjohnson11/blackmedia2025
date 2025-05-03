"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { AlertCircle, Trash2, RefreshCw, ArrowLeft } from "lucide-react"
import Link from "next/link"
import { createClient } from "@supabase/supabase-js"

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ""
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""
const supabase = createClient(supabaseUrl, supabaseAnonKey)

export default function ResetProgramsPage() {
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ type: "success" | "error" | null; text: string }>({
    type: null,
    text: "",
  })
  const [confirmText, setConfirmText] = useState("")
  const [selectedChannel, setSelectedChannel] = useState<number | null>(null)
  const [channels, setChannels] = useState<any[]>([])
  const [loadingChannels, setLoadingChannels] = useState(false)

  async function fetchChannels() {
    try {
      setLoadingChannels(true)
      const { data, error } = await supabase.from("channels").select("*").order("id")

      if (error) throw error
      setChannels(data || [])
    } catch (error) {
      console.error("Error fetching channels:", error)
      setMessage({ type: "error", text: "Failed to fetch channels" })
    } finally {
      setLoadingChannels(false)
    }
  }

  async function resetAllPrograms() {
    if (confirmText !== "DELETE") {
      setMessage({ type: "error", text: 'Please type "DELETE" to confirm' })
      return
    }

    try {
      setLoading(true)
      setMessage({ type: null, text: "" })

      // Delete all programs
      const { error } = await supabase.from("programs").delete().neq("id", 0) // Delete all records

      if (error) throw error

      // Clear local storage cache related to programs
      localStorage.removeItem("btv_programs_cache")
      localStorage.removeItem("btv_last_fetch")

      setMessage({
        type: "success",
        text: "All programs have been deleted successfully. Browser cache has been cleared.",
      })
      setConfirmText("")
    } catch (error) {
      console.error("Error resetting programs:", error)
      setMessage({ type: "error", text: "Failed to reset programs. Please try again." })
    } finally {
      setLoading(false)
    }
  }

  async function resetChannelPrograms() {
    if (!selectedChannel) {
      setMessage({ type: "error", text: "Please select a channel" })
      return
    }

    try {
      setLoading(true)
      setMessage({ type: null, text: "" })

      // Delete programs for the selected channel
      const { error } = await supabase.from("programs").delete().eq("channel_id", selectedChannel)

      if (error) throw error

      // Clear local storage cache related to programs
      localStorage.removeItem("btv_programs_cache")
      localStorage.removeItem("btv_last_fetch")

      setMessage({
        type: "success",
        text: `Programs for channel ${selectedChannel} have been deleted successfully. Browser cache has been cleared.`,
      })
    } catch (error) {
      console.error("Error resetting channel programs:", error)
      setMessage({ type: "error", text: "Failed to reset channel programs. Please try again." })
    } finally {
      setLoading(false)
    }
  }

  async function clearBrowserCache() {
    try {
      // Clear local storage cache related to programs
      localStorage.removeItem("btv_programs_cache")
      localStorage.removeItem("btv_last_fetch")
      localStorage.removeItem("btv_channel_data")
      localStorage.removeItem("btv_current_programs")

      setMessage({
        type: "success",
        text: "Browser cache has been cleared successfully.",
      })
    } catch (error) {
      console.error("Error clearing browser cache:", error)
      setMessage({ type: "error", text: "Failed to clear browser cache. Please try again." })
    }
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center mb-6">
        <Link href="/admin" className="mr-4">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Admin
          </Button>
        </Link>
        <h1 className="text-3xl font-bold">Reset Programs</h1>
      </div>

      {message.type && (
        <div
          className={`mb-6 p-4 rounded-md ${
            message.type === "success"
              ? "bg-green-900/30 border border-green-800"
              : "bg-red-900/30 border border-red-800"
          }`}
        >
          <div className="flex items-start">
            {message.type === "error" && <AlertCircle className="h-5 w-5 mr-2 flex-shrink-0 text-red-400" />}
            <p>{message.text}</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="bg-red-900/10 border-red-900/30">
          <CardHeader>
            <CardTitle className="text-red-400">Reset ALL Programs</CardTitle>
            <CardDescription>Delete all programs from the database</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="bg-black/30 p-4 rounded-md mb-4">
              <div className="flex items-start">
                <AlertCircle className="h-5 w-5 mr-2 flex-shrink-0 text-red-400" />
                <p className="text-sm">
                  <span className="font-bold">WARNING:</span> This will delete ALL programs from ALL channels. This
                  action cannot be undone.
                </p>
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium mb-1">Type "DELETE" to confirm:</label>
              <input
                type="text"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                className="w-full p-2 bg-gray-900 border border-gray-700 rounded-md"
                placeholder='Type "DELETE" here'
              />
            </div>
          </CardContent>
          <CardFooter>
            <Button
              onClick={resetAllPrograms}
              disabled={loading || confirmText !== "DELETE"}
              className="w-full bg-red-600 hover:bg-red-700"
            >
              {loading ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Resetting...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Reset ALL Programs (All Channels)
                </>
              )}
            </Button>
          </CardFooter>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Reset Channel Programs</CardTitle>
            <CardDescription>Delete programs for a specific channel</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={fetchChannels} disabled={loadingChannels} className="w-full mb-4" variant="outline">
              {loadingChannels ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Loading Channels...
                </>
              ) : (
                "Load Channels"
              )}
            </Button>

            {channels.length > 0 && (
              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">Select Channel:</label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {channels.map((channel) => (
                    <Button
                      key={channel.id}
                      variant={selectedChannel === channel.id ? "default" : "outline"}
                      onClick={() => setSelectedChannel(channel.id)}
                      className="h-auto py-2"
                    >
                      {channel.name || `Channel ${channel.id}`}
                    </Button>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
          <CardFooter>
            <Button
              onClick={resetChannelPrograms}
              disabled={loading || selectedChannel === null}
              className="w-full bg-amber-600 hover:bg-amber-700"
            >
              {loading ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Resetting...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Reset Selected Channel Programs
                </>
              )}
            </Button>
          </CardFooter>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Clear Browser Cache</CardTitle>
          <CardDescription>Clear cached program data from your browser</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-400 mb-4">
            This will clear any cached program data stored in your browser's local storage. This can help if you're
            seeing outdated program information.
          </p>
        </CardContent>
        <CardFooter>
          <Button onClick={clearBrowserCache} className="w-full">
            Clear Browser Cache
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}
