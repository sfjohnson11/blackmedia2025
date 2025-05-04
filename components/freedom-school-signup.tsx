"use client"

import type React from "react"

import { useState } from "react"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react"

export function FreedomSchoolSignUp() {
  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    phone: "",
    age: "",
    interests: "",
    newsletter: true,
    course: "history",
  })

  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState("")

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleSelectChange = (value: string) => {
    setFormData((prev) => ({ ...prev, course: value }))
  }

  const handleCheckboxChange = (checked: boolean) => {
    setFormData((prev) => ({ ...prev, newsletter: checked }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError("")

    try {
      // Insert the sign-up data into Supabase
      const { error: supabaseError } = await supabase.from("freedom_school_signups").insert([
        {
          full_name: formData.fullName,
          email: formData.email,
          phone: formData.phone,
          age: formData.age,
          interests: formData.interests,
          newsletter: formData.newsletter,
          preferred_course: formData.course,
        },
      ])

      if (supabaseError) throw new Error(supabaseError.message)

      // Show success message
      setSuccess(true)

      // Reset form after 3 seconds
      setTimeout(() => {
        setFormData({
          fullName: "",
          email: "",
          phone: "",
          age: "",
          interests: "",
          newsletter: true,
          course: "history",
        })
        setSuccess(false)
      }, 3000)
    } catch (err) {
      console.error("Error submitting form:", err)
      setError("There was an error submitting your information. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-gray-900 rounded-xl p-6 md:p-8 sticky top-24">
      <h2 className="text-2xl md:text-3xl font-bold mb-6 text-center">Join Our Freedom School</h2>

      {success ? (
        <div className="bg-green-900/30 border border-green-600 rounded-lg p-4 flex items-center mb-6">
          <CheckCircle2 className="h-5 w-5 text-green-500 mr-2 flex-shrink-0" />
          <p className="text-green-100">
            Thank you for signing up! We will contact you with more information about our Freedom School program.
          </p>
        </div>
      ) : error ? (
        <div className="bg-red-900/30 border border-red-600 rounded-lg p-4 flex items-center mb-6">
          <AlertCircle className="h-5 w-5 text-red-500 mr-2 flex-shrink-0" />
          <p className="text-red-100">{error}</p>
        </div>
      ) : null}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <Label htmlFor="fullName">Full Name</Label>
          <Input
            id="fullName"
            name="fullName"
            value={formData.fullName}
            onChange={handleChange}
            required
            className="bg-gray-800 border-gray-700"
          />
        </div>

        <div>
          <Label htmlFor="email">Email Address</Label>
          <Input
            id="email"
            name="email"
            type="email"
            value={formData.email}
            onChange={handleChange}
            required
            className="bg-gray-800 border-gray-700"
          />
        </div>

        <div>
          <Label htmlFor="phone">Phone Number (optional)</Label>
          <Input
            id="phone"
            name="phone"
            type="tel"
            value={formData.phone}
            onChange={handleChange}
            className="bg-gray-800 border-gray-700"
          />
        </div>

        <div>
          <Label htmlFor="age">Age (optional)</Label>
          <Input
            id="age"
            name="age"
            type="text"
            value={formData.age}
            onChange={handleChange}
            className="bg-gray-800 border-gray-700"
          />
        </div>

        <div>
          <Label htmlFor="course">Preferred Course</Label>
          <Select value={formData.course} onValueChange={handleSelectChange}>
            <SelectTrigger className="bg-gray-800 border-gray-700">
              <SelectValue placeholder="Select a course" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="history">The History of Freedom Schools</SelectItem>
              <SelectItem value="literature">African American Literature</SelectItem>
              <SelectItem value="youth">Youth Leadership Development</SelectItem>
              <SelectItem value="all">All Available Courses</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="interests">Interests & Questions (optional)</Label>
          <Textarea
            id="interests"
            name="interests"
            value={formData.interests}
            onChange={handleChange}
            placeholder="Tell us what you're interested in learning or any questions you have..."
            className="bg-gray-800 border-gray-700 min-h-[100px]"
          />
        </div>

        <div className="flex items-center space-x-2">
          <Checkbox id="newsletter" checked={formData.newsletter} onCheckedChange={handleCheckboxChange} />
          <Label htmlFor="newsletter" className="text-sm">
            Receive updates about Freedom School programs and events
          </Label>
        </div>

        <Button type="submit" className="w-full bg-red-600 hover:bg-red-700 text-white" disabled={loading}>
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Submitting...
            </>
          ) : (
            "Sign Up for Freedom School"
          )}
        </Button>
      </form>
    </div>
  )
}
