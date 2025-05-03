"use client"

import { useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { ArrowLeft, Trash2, RefreshCw } from "lucide-react"

export default function ClearCachePage() {
  const [message, setMessage] = useState<string | null>(null)
  const [isClearing, setIsClearing] = useState(false)

  const clearLocalStorage = () => {
    setIsClearing(true)
    try {
      // Clear all localStorage
      localStorage.clear()
      setMessage("Local storage cleared successfully! The page will reload in 3 seconds.")

      // Reload the page after a delay
      setTimeout(() => {
        window.location.reload()
      }, 3000)
    } catch (error) {
      setMessage(`Error clearing local storage: ${error}`)
      setIsClearing(false)
    }
  }

  return (
    <div className="pt-24 px-4 md:px-10 pb-16">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center mb-8">
          <Link href="/admin" className="mr-4">
            <Button variant="outline" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Return to Admin
            </Button>
          </Link>
          <h1 className="text-3xl font-bold">Clear Browser Cache</h1>
        </div>

        <div className="bg-gray-800 rounded-lg p-6 mb-8">
          <h2 className="text-xl font-bold mb-4">Clear Browser Cache</h2>

          <div className="bg-gray-900/50 p-4 rounded-md mb-6">
            <p className="text-sm text-gray-300">
              This tool will clear all locally stored data in your browser for this website. This includes news items,
              channel passwords, and any other cached data. Use this if you're experiencing issues with data not
              updating properly.
            </p>
          </div>

          <div className="flex flex-col space-y-4">
            <Button
              onClick={clearLocalStorage}
              disabled={isClearing}
              className="bg-red-600 hover:bg-red-700 flex items-center justify-center"
            >
              {isClearing ? <RefreshCw className="h-5 w-5 mr-2 animate-spin" /> : <Trash2 className="h-5 w-5 mr-2" />}
              {isClearing ? "Clearing Cache..." : "Clear All Browser Cache"}
            </Button>

            {message && (
              <div className="bg-blue-900/50 p-4 rounded-md mt-4">
                <p className="text-sm text-blue-300">{message}</p>
              </div>
            )}
          </div>
        </div>

        <div className="bg-gray-800 rounded-lg p-6">
          <h2 className="text-xl font-bold mb-4">When to Clear Cache</h2>
          <ul className="space-y-2 text-gray-300">
            <li>• When news items aren't updating properly</li>
            <li>• When channel passwords aren't being recognized</li>
            <li>• When you see outdated information after making changes</li>
            <li>• When the site behavior seems inconsistent</li>
            <li>• As a first troubleshooting step for any data-related issues</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
