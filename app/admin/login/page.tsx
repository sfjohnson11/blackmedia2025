"use client"

import type React from "react"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Lock, AlertCircle } from "lucide-react"
import Link from "next/link"

export default function AdminLoginPage() {
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError("")

    // Simple password check - in a real app, use a proper authentication system
    if (password === "blacktruth_admin_2025") {
      localStorage.setItem("btv_admin_auth", password)
      router.push("/admin")
    } else {
      setError("Invalid password")
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900 px-4">
      <div className="max-w-md w-full bg-gray-800 rounded-lg shadow-lg p-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-red-600 mb-2">Admin Access</h1>
          <p className="text-gray-400">Enter your password to access the admin dashboard</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-6">
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-300 mb-1">
              Admin Password
            </label>
            <div className="relative">
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
                placeholder="Enter password"
                required
              />
              <Lock className="absolute right-3 top-2.5 h-5 w-5 text-gray-500" />
            </div>
          </div>

          {error && (
            <div className="bg-red-900/30 text-red-400 p-3 rounded-md flex items-start">
              <AlertCircle className="h-5 w-5 mr-2 mt-0.5 flex-shrink-0" />
              <p>{error}</p>
            </div>
          )}

          <Button
            type="submit"
            disabled={isLoading}
            className="w-full bg-red-600 hover:bg-red-700 text-white py-2 rounded-md"
          >
            {isLoading ? "Logging in..." : "Login"}
          </Button>

          <div className="text-center mt-4">
            <Link href="/" className="text-sm text-gray-400 hover:text-white">
              Return to Home
            </Link>
          </div>
        </form>
      </div>
    </div>
  )
}
