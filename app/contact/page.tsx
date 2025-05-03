"use client"

import type React from "react"

import { useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { ArrowLeft, Mail, Send, CheckCircle } from "lucide-react"

export default function ContactPage() {
  const [formState, setFormState] = useState({
    name: "",
    email: "",
    subject: "",
    message: "",
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSubmitted, setIsSubmitted] = useState(false)

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setFormState((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    // Simulate form submission
    setTimeout(() => {
      setIsSubmitting(false)
      setIsSubmitted(true)
      setFormState({
        name: "",
        email: "",
        subject: "",
        message: "",
      })
    }, 1500)
  }

  return (
    <div className="pt-24 px-4 md:px-10 pb-16">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center mb-8">
          <Link href="/" className="mr-4">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Home
            </Button>
          </Link>
          <h1 className="text-3xl font-bold flex items-center">
            <Mail className="h-6 w-6 mr-2 text-red-500" />
            Contact Us
          </h1>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
          <div>
            <div className="bg-gray-800 rounded-lg p-6 md:p-8 h-full">
              <h2 className="text-2xl font-bold mb-4">Get In Touch</h2>
              <p className="text-gray-300 mb-6">
                Have questions, feedback, or need assistance? We're here to help. Fill out the form and our team will
                respond as soon as possible.
              </p>

              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-semibold mb-2">Email Us</h3>
                  <a href="mailto:info@blacktruthtv.com" className="text-red-400 hover:text-red-300">
                    info@blacktruthtv.com
                  </a>
                </div>

                <div>
                  <h3 className="text-lg font-semibold mb-2">For Copyright Inquiries</h3>
                  <a href="mailto:copyright@blacktruthtv.com" className="text-red-400 hover:text-red-300">
                    copyright@blacktruthtv.com
                  </a>
                </div>

                <div>
                  <h3 className="text-lg font-semibold mb-2">For Technical Support</h3>
                  <a href="mailto:support@blacktruthtv.com" className="text-red-400 hover:text-red-300">
                    support@blacktruthtv.com
                  </a>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-gray-800 rounded-lg p-6 md:p-8">
            {isSubmitted ? (
              <div className="flex flex-col items-center justify-center h-full py-8">
                <div className="bg-green-900/30 rounded-full p-4 mb-4">
                  <CheckCircle className="h-12 w-12 text-green-500" />
                </div>
                <h2 className="text-2xl font-bold mb-2">Message Sent!</h2>
                <p className="text-gray-300 text-center mb-6">
                  Thank you for contacting us. We'll get back to you as soon as possible.
                </p>
                <Button onClick={() => setIsSubmitted(false)} className="bg-red-600 hover:bg-red-700">
                  Send Another Message
                </Button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label htmlFor="name" className="block text-sm font-medium mb-1">
                    Your Name
                  </label>
                  <input
                    id="name"
                    name="name"
                    type="text"
                    required
                    value={formState.name}
                    onChange={handleChange}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
                  />
                </div>

                <div>
                  <label htmlFor="email" className="block text-sm font-medium mb-1">
                    Email Address
                  </label>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    required
                    value={formState.email}
                    onChange={handleChange}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
                  />
                </div>

                <div>
                  <label htmlFor="subject" className="block text-sm font-medium mb-1">
                    Subject
                  </label>
                  <select
                    id="subject"
                    name="subject"
                    required
                    value={formState.subject}
                    onChange={handleChange}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
                  >
                    <option value="">Select a subject</option>
                    <option value="general">General Inquiry</option>
                    <option value="support">Technical Support</option>
                    <option value="content">Content Request</option>
                    <option value="copyright">Copyright Question</option>
                    <option value="password">Channel Password</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="message" className="block text-sm font-medium mb-1">
                    Message
                  </label>
                  <textarea
                    id="message"
                    name="message"
                    rows={5}
                    required
                    value={formState.message}
                    onChange={handleChange}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
                  ></textarea>
                </div>

                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full bg-red-600 hover:bg-red-700 flex items-center justify-center"
                >
                  {isSubmitting ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white mr-2"></div>
                      Sending...
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4 mr-2" />
                      Send Message
                    </>
                  )}
                </Button>
              </form>
            )}
          </div>
        </div>

        <div className="text-center">
          <Link href="/">
            <Button variant="outline">Return to Home</Button>
          </Link>
        </div>
      </div>
    </div>
  )
}
