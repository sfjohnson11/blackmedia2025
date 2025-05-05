"use client"

import type React from "react"

import { useState } from "react"
import { Loader2 } from "lucide-react"

export function FreedomSchoolSignUp() {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsSubmitting(true)
    setError(null)

    const formData = new FormData(e.currentTarget)
    const name = formData.get("name") as string
    const email = formData.get("email") as string
    const interests = formData.get("interests") as string

    try {
      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 1500))

      // In a real implementation, you would send this data to your backend
      console.log("Form submitted with:", { name, email, interests })

      setIsSuccess(true)
      e.currentTarget.reset()
    } catch (err) {
      setError("There was an error submitting your form. Please try again.")
      console.error("Form submission error:", err)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="bg-gray-900 rounded-xl p-6 md:p-8 sticky top-20">
      <h2 className="text-2xl md:text-3xl font-bold mb-4">Join Our Freedom School</h2>

      {isSuccess ? (
        <div className="bg-green-900/30 border border-green-600 rounded-lg p-4 text-center">
          <h3 className="text-xl font-semibold text-green-400 mb-2">Thank You!</h3>
          <p className="text-gray-300">
            Your registration has been received. We'll contact you with more information about our upcoming classes.
          </p>
          <button
            onClick={() => setIsSuccess(false)}
            className="mt-4 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded transition-colors"
          >
            Register Another Person
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <p className="text-gray-300 mb-4">
            Register for our upcoming Freedom School sessions. Classes are free and open to all ages.
          </p>

          {error && (
            <div className="bg-red-900/30 border border-red-600 rounded-lg p-3 text-red-400 text-sm">{error}</div>
          )}

          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-300 mb-1">
              Full Name
            </label>
            <input
              type="text"
              id="name"
              name="name"
              required
              className="w-full bg-gray-800 border border-gray-700 rounded-md px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-red-600"
              placeholder="Enter your full name"
            />
          </div>

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-1">
              Email Address
            </label>
            <input
              type="email"
              id="email"
              name="email"
              required
              className="w-full bg-gray-800 border border-gray-700 rounded-md px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-red-600"
              placeholder="Enter your email address"
            />
          </div>

          <div>
            <label htmlFor="interests" className="block text-sm font-medium text-gray-300 mb-1">
              Areas of Interest
            </label>
            <select
              id="interests"
              name="interests"
              className="w-full bg-gray-800 border border-gray-700 rounded-md px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-red-600"
            >
              <option value="history">African American History</option>
              <option value="literature">Literature & Arts</option>
              <option value="youth">Youth Leadership</option>
              <option value="community">Community Organizing</option>
              <option value="all">All Topics</option>
            </select>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-red-600 hover:bg-red-700 disabled:bg-red-800/50 text-white font-medium py-2 px-4 rounded-md transition-colors flex items-center justify-center"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="animate-spin mr-2 h-4 w-4" />
                Submitting...
              </>
            ) : (
              "Register for Freedom School"
            )}
          </button>

          <p className="text-xs text-gray-400 mt-4">
            By registering, you'll receive updates about our Freedom School program and other educational initiatives
            from Black Truth TV. You can unsubscribe at any time.
          </p>
        </form>
      )}
    </div>
  )
}
