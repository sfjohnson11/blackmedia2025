"use client"

import type React from "react"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { AlertCircle, CheckCircle, ChevronLeft } from "lucide-react"
import { useRouter } from "next/navigation"

// Centralized full URL builder
function getFullUrl(path: string): string {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL + "/storage/v1/object/public/"
  const cleanPath = path.replace(/^\/+/, "")
  return base + cleanPath
}

export default function FreedomSchoolPage() {
  const router = useRouter()
  const videoRef = useRef<HTMLVideoElement>(null)
  const [videoUrl, setVideoUrl] = useState<string>("")
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)
  const fallbackUrl = "freedom-school/welcome.mp4"
  const headerImageUrl = getFullUrl("freedom-school/freedom-schoolimage.jpeg")

  useEffect(() => {
    const primary = "freedom-school/intro.mp4"
    const fullPrimary = getFullUrl(primary)
    const fullFallback = getFullUrl(fallbackUrl)

    // Preload test
    fetch(fullPrimary, { method: "HEAD" })
      .then((res) => {
        if (!res.ok) throw new Error("Primary video not available")
        setVideoUrl(fullPrimary)
      })
      .catch(() => {
        setVideoUrl(fullFallback)
        setError("Primary video failed, using fallback")
      })
      .finally(() => {
        setIsLoading(false)
      })
  }, [])

  const handleVideoError = () => {
    if (videoUrl !== getFullUrl(fallbackUrl)) {
      setVideoUrl(getFullUrl(fallbackUrl))
      setError("Video failed to load. Switched to fallback.")
    } else {
      setError("Both primary and fallback failed to load.")
    }
  }

  // Debug helper
  useEffect(() => {
    console.log("📺 Playing Freedom School video:", videoUrl)
  }, [videoUrl])

  return (
    <div className="bg-black min-h-screen text-white p-6">
      <button onClick={() => router.push("/")} className="mb-4 text-sm text-white hover:underline">
        <ChevronLeft className="inline w-4 h-4 mr-1" /> Back to Home
      </button>

      {/* Header with Image */}
      <div className="mb-6">
        <div className="relative w-full h-48 md:h-64 rounded-lg overflow-hidden mb-4">
          <img
            src={headerImageUrl || "/placeholder.svg"}
            alt="Freedom School"
            className="w-full h-full object-cover"
            onError={(e) => {
              console.error("Failed to load Freedom School header image")
              e.currentTarget.style.display = "none"
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black to-transparent"></div>
          <div className="absolute bottom-0 left-0 p-4">
            <h1 className="text-3xl md:text-4xl font-bold">📚 Freedom School</h1>
            <p className="text-gray-300">Learn, reflect, and rise — our virtual classroom is always open.</p>
          </div>
        </div>
      </div>

      <div className="w-full aspect-video bg-black mb-4">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">Loading video...</div>
        ) : (
          <video
            ref={videoRef}
            key={videoUrl}
            src={videoUrl}
            controls
            autoPlay
            playsInline
            className="w-full h-full"
            onError={handleVideoError}
          >
            <source src={videoUrl} type="video/mp4" />
            Your browser does not support the video tag.
          </video>
        )}
      </div>

      {error && (
        <div className="text-red-500 flex items-center gap-2 mb-4">
          <AlertCircle className="w-5 h-5" /> {error}
        </div>
      )}

      <FreedomSchoolSignup />
    </div>
  )
}

function FreedomSchoolSignup() {
  const [email, setEmail] = useState("")
  const [name, setName] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitStatus, setSubmitStatus] = useState<null | "success" | "error">(null)
  const [errorMessage, setErrorMessage] = useState("")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setSubmitStatus(null)

    try {
      await new Promise((resolve) => setTimeout(resolve, 800))
      setSubmitStatus("success")
      setName("")
      setEmail("")
    } catch (error) {
      setSubmitStatus("error")
      setErrorMessage("There was an error submitting your information. Please try again.")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label htmlFor="name" className="text-white">
          Full Name
        </Label>
        <Input
          id="name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          className="bg-gray-800 border-gray-700 text-white"
          placeholder="Enter your full name"
        />
      </div>

      <div>
        <Label htmlFor="email" className="text-white">
          Email Address
        </Label>
        <Input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="bg-gray-800 border-gray-700 text-white"
          placeholder="Enter your email address"
        />
      </div>

      <Button type="submit" disabled={isSubmitting} className="w-full bg-red-600 hover:bg-red-700 text-white">
        {isSubmitting ? "Submitting..." : "Sign Up"}
      </Button>

      {submitStatus === "success" && (
        <div className="flex items-center gap-2 text-green-500 p-2 bg-green-950 rounded">
          <CheckCircle size={16} />
          <span>Thank you for signing up! We'll keep you updated.</span>
        </div>
      )}

      {submitStatus === "error" && (
        <div className="flex items-center gap-2 text-red-500 p-2 bg-red-950 rounded">
          <AlertCircle size={16} />
          <span>{errorMessage}</span>
        </div>
      )}
    </form>
  )
}
