"use client"

import { useState } from "react"
import { createTables } from "@/lib/supabase"
import { Button } from "@/components/ui/button"

export function ClientSetupButton() {
  const [isLoading, setIsLoading] = useState(false)
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null)

  const handleSetup = async () => {
    setIsLoading(true)
    try {
      const { success, error } = await createTables()
      if (success) {
        setResult({ success: true, message: "Tables created successfully!" })
        // Reload the page after a short delay
        setTimeout(() => {
          window.location.reload()
        }, 1500)
      } else {
        setResult({ success: false, message: error || "Failed to create tables" })
      }
    } catch (e) {
      setResult({
        success: false,
        message: e instanceof Error ? e.message : "An unknown error occurred",
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex flex-col items-center gap-4">
      <Button onClick={handleSetup} disabled={isLoading} className="bg-red-600 hover:bg-red-700 w-full max-w-xs">
        {isLoading ? "Creating Tables..." : "Create Database Tables"}
      </Button>

      {result && (
        <div
          className={`p-3 rounded-md w-full ${
            result.success ? "bg-green-900/30 text-green-400" : "bg-red-900/30 text-red-400"
          }`}
        >
          {result.message}
        </div>
      )}
    </div>
  )
}
