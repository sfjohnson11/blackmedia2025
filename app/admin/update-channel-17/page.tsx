"use client"

import { useState } from "react"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { ArrowLeft, CheckCircle, AlertCircle, RefreshCw } from "lucide-react"
import Link from "next/link"

export default function UpdateChannel17Page() {
  const [isUpdating, setIsUpdating] = useState(false)
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null)

  const updateChannelName = async () => {
    setIsUpdating(true)
    setResult(null)

    try {
      // Update channel 17's name in the database
      const { error } = await supabase.from("channels").update({ name: "Black Music Vault" }).eq("id", "17")

      if (error) throw error

      setResult({
        success: true,
        message: "Channel 17 has been successfully renamed to 'Black Music Vault'",
      })
    } catch (error) {
      console.error("Error updating channel name:", error)
      setResult({
        success: false,
        message: error instanceof Error ? error.message : "An unknown error occurred",
      })
    } finally {
      setIsUpdating(false)
    }
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="flex items-center mb-6">
        <Link href="/admin">
          <Button variant="outline" size="sm" className="mr-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Return to Admin
          </Button>
        </Link>
        <h1 className="text-2xl font-bold">Update Channel 17 Name</h1>
      </div>

      <div className="bg-gray-800 p-6 rounded-lg max-w-2xl mx-auto">
        <h2 className="text-xl font-semibold mb-4">Rename Channel 17 to "Black Music Vault"</h2>

        <p className="mb-6 text-gray-300">
          This will update Channel 17's name in the database to "Black Music Vault". This change will be reflected
          throughout the application.
        </p>

        <Button onClick={updateChannelName} disabled={isUpdating} className="w-full bg-blue-600 hover:bg-blue-700">
          {isUpdating ? (
            <>
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              Updating...
            </>
          ) : (
            "Update Channel Name"
          )}
        </Button>

        {result && (
          <div
            className={`mt-6 p-4 rounded-md ${
              result.success ? "bg-green-900/30 text-green-400" : "bg-red-900/30 text-red-400"
            }`}
          >
            <div className="flex items-center gap-2">
              {result.success ? <CheckCircle className="h-5 w-5" /> : <AlertCircle className="h-5 w-5" />}
              <p>{result.message}</p>
            </div>
          </div>
        )}

        <div className="mt-6 bg-gray-900 p-4 rounded-md">
          <h3 className="font-semibold mb-2">After Updating</h3>
          <p className="text-sm text-gray-400">After updating the channel name, you may need to:</p>
          <ul className="text-sm text-gray-400 list-disc list-inside mt-2">
            <li>Refresh your browser cache</li>
            <li>Wait a few moments for the changes to propagate</li>
            <li>Update any channel images if needed</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
