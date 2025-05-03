"use client"

import type React from "react"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null)
  const router = useRouter()

  useEffect(() => {
    // Check if user is authenticated
    const adminPassword = localStorage.getItem("btv_admin_auth")
    const isAuth = adminPassword === "blacktruth_admin_2025" // Simple password check
    setIsAuthenticated(isAuth)

    if (isAuth === false) {
      router.push("/admin/login")
    }
  }, [router])

  // Show loading state while checking authentication
  if (isAuthenticated === null) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center">
          <Loader2 className="h-12 w-12 text-red-600 animate-spin mb-4" />
          <p className="text-xl">Verifying access...</p>
        </div>
      </div>
    )
  }

  // If authenticated, render the admin content
  return (
    <div className="min-h-screen bg-gray-900">
      <div className="bg-black border-b border-gray-800 py-4 px-6">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <h1 className="text-xl font-bold text-red-600">Black Truth TV Admin</h1>
          <button
            onClick={() => {
              localStorage.removeItem("btv_admin_auth")
              setIsAuthenticated(false)
              router.push("/admin/login")
            }}
            className="text-sm text-gray-400 hover:text-white"
          >
            Logout
          </button>
        </div>
      </div>
      <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">{children}</div>
    </div>
  )
}
