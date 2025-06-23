"use client"

import type React from "react"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { AlertCircle, CheckCircle, ChevronLeft, Info } from "lucide-react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"

// Centralized full URL builder
function getFullUrl(path: string): string {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL + "/storage/v1/object/public/"
  const cleanPath = path.replace(/^\/+/g, "")
  return base + cleanPath
}

export default function FreedomSchoolPage() {
  const router = useRouter()
  const videoRef = useRef<HTMLVideoElement>(null)
  const [videoUrl, setVideoUrl] = useState<string>("")
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)
  const headerImageUrl = getFullUrl("freedom-school/freedom-schoolimage.jpeg")

  useEffect(() => {
    const loadVideo = async () => {
      setIsLoading(true)
      setError(null)

      const { data, error: dbError } = await supabase
        .from("freedom_school_videos")
        .select("*")
        .eq("published", true)
        .order("created_at", { ascending: false })
        .limit(1)
        .single()

      if (dbError || !data) {
        console.error("Freedom School video fetch error:", dbError)
        setError("No Freedom School video available at the moment.")
        setIsLoading(false)
        return
      }

      // Ensure mp4_url is a string and not empty
      if (typeof data.mp4_url !== "string" || data.mp4_url.trim() === "") {
        console.error("Freedom School video mp4_url is invalid:", data.mp4_url)
        setError("Video data is invalid.")
        setIsLoading(false)
        return
      }

      const fullUrl = getFullUrl(data.mp4_url) // mp4_url should be like 'freedom-school/video.mp4'
      setVideoUrl(fullUrl)
      setIsLoading(false)
    }

    loadVideo()
  }, [])

  const handleVideoError = (e: React.SyntheticEvent<HTMLVideoElement, Event>) => {
    console.error("Video element error:", e)
    setError("Video failed to load. Please check the video file and your connection.")
  }

  return (
    <div className="bg-black min-h-screen text-white p-4 md:p-6">
      <button
        onClick={() => router.push("/")}
        className="mb-4 text-sm text-gray-300 hover:text-white hover:underline flex items-center"
        aria-label="Back to Home"
      >
        <ChevronLeft className="w-4 h-4 mr-1" /> Back to Home
      </button>

      <div className="mb-6">
        <div className="relative w-full h-48 md:h-64 rounded-lg overflow-hidden mb-4 shadow-lg">
          {headerImageUrl ? (
            <img
              src={headerImageUrl || "/placeholder.svg"}
              alt="Freedom School Header"
              className="w-full h-full object-cover"
              onError={(e) => {
                console.error("Failed to load Freedom School header image:", headerImageUrl)
                e.currentTarget.style.display = "none"
                // Optionally show a placeholder text or background if image fails
                const parent = e.currentTarget.parentElement
                if (parent) {
                  const placeholder = document.createElement("div")
                  placeholder.className = "w-full h-full flex items-center justify-center bg-gray-700 text-gray-400"
                  placeholder.textContent = "Freedom School"
                  parent.appendChild(placeholder)
                }
              }}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gray-700 text-gray-400">
              Freedom School
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent"></div>
          <div className="absolute bottom-0 left-0 p-4 md:p-6">
            <h1 className="text-3xl md:text-4xl font-bold text-shadow">📚 Freedom School</h1>
            <p className="text-gray-200 text-shadow-sm">Our virtual classroom is always open.</p>
          </div>
        </div>
      </div>

      <div className="w-full aspect-video bg-gray-900 rounded-lg overflow-hidden shadow-xl mb-6">
        {isLoading ? (
          <div className="flex items-center justify-center h-full text-gray-400">Loading video...</div>
        ) : videoUrl ? (
          <video
            ref={videoRef}
            controls
            autoPlay
            playsInline
            className="w-full h-full"
            onError={handleVideoError}
            key={videoUrl} // Add key to re-initialize video element if src changes
          >
            <source src={videoUrl} type="video/mp4" />
            Your browser does not support the video tag.
          </video>
        ) : (
          <div className="flex items-center justify-center h-full bg-gray-800 text-gray-400 rounded-lg">
            <p>{error || "Video content coming soon."}</p>
          </div>
        )}
      </div>

      {error &&
        !videoUrl && ( // Show general error if videoUrl is not set
          <div className="text-yellow-500 flex items-center gap-2 mb-4 p-3 bg-yellow-950 rounded-md">
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
  const [submitStatus, setSubmitStatus] = useState<null | "success" | "error" | "info">(null)
  const [submitMessage, setSubmitMessage] = useState("")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setSubmitStatus(null)
    setSubmitMessage("")

    const trimmedName = name.trim()
    const trimmedEmail = email.trim()

    if (!trimmedName || !trimmedEmail) {
      setSubmitStatus("error")
      setSubmitMessage("Name and email are required.")
      setIsSubmitting(false)
      return
    }

    try {
      // 1. Check if email already exists
      const { data: existingSignup, error: selectError } = await supabase
        .from("freedom_school_signups")
        .select("id")
        .eq("email", trimmedEmail)
        .maybeSingle() // Use maybeSingle to return null instead of error if not found

      if (selectError) {
        // Handle unexpected select error (not "no rows found" which maybeSingle handles)
        console.error("Error checking existing signup:", selectError)
        setSubmitStatus("error")
        setSubmitMessage("Could not verify email. Please try again.")
        setIsSubmitting(false)
        return
      }

      if (existingSignup) {
        setSubmitStatus("info") // Use "info" for already signed up
        setSubmitMessage("This email address has already been signed up. Thank you!")
        setIsSubmitting(false)
        return
      }

      // 2. Insert new signup
      const { error: insertError } = await supabase
        .from("freedom_school_signups")
        .insert([{ name: trimmedName, email: trimmedEmail }])

      if (insertError) {
        console.error("Error inserting signup:", insertError)
        setSubmitStatus("error")
        // Check for unique constraint violation (PostgreSQL error code 23505)
        if (insertError.code === "23505") {
          setSubmitMessage("This email address has already been signed up.")
        } else {
          setSubmitMessage("Failed to sign up. Please try again later.")
        }
      } else {
        setSubmitStatus("success")
        setSubmitMessage("Thank you for signing up! We'll keep you updated.")
        setName("")
        setEmail("")
      }
    } catch (error) {
      console.error("Unexpected error during signup:", error)
      setSubmitStatus("error")
      setSubmitMessage("An unexpected error occurred. Please try again.")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="max-w-md mx-auto mt-8 p-6 bg-gray-800 rounded-lg shadow-md">
      <h2 className="text-xl font-semibold text-white mb-4 text-center">Join Freedom School Updates</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <Label htmlFor="name-signup" className="text-gray-300">
            Full Name
          </Label>
          <Input
            id="name-signup"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="bg-gray-700 border-gray-600 text-white placeholder-gray-500 focus:ring-red-500 focus:border-red-500"
            placeholder="Enter your full name"
          />
        </div>

        <div>
          <Label htmlFor="email-signup" className="text-gray-300">
            Email Address
          </Label>
          <Input
            id="email-signup"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="bg-gray-700 border-gray-600 text-white placeholder-gray-500 focus:ring-red-500 focus:border-red-500"
            placeholder="Enter your email address"
          />
        </div>

        <Button
          type="submit"
          disabled={isSubmitting}
          className="w-full bg-red-600 hover:bg-red-700 text-white font-semibold py-2.5 disabled:opacity-70"
        >
          {isSubmitting ? "Submitting..." : "Sign Up for Updates"}
        </Button>

        {submitMessage && (
          <div
            className={`flex items-center gap-2 p-3 rounded-md text-sm ${
              submitStatus === "success"
                ? "bg-green-900 text-green-300"
                : submitStatus === "error"
                  ? "bg-red-900 text-red-300"
                  : submitStatus === "info"
                    ? "bg-blue-900 text-blue-300"
                    : ""
            }`}
          >
            {submitStatus === "success" && <CheckCircle size={18} />}
            {submitStatus === "error" && <AlertCircle size={18} />}
            {submitStatus === "info" && <Info size={18} />}
            <span>{submitMessage}</span>
          </div>
        )}
      </form>
    </div>
  )
}
