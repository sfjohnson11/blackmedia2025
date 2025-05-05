"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { AlertCircle, CheckCircle } from "lucide-react"

export function FreedomSchoolSignup() {
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
      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 1000))

      // For now, just simulate success
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
