"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Search, Bell, User } from "lucide-react"

export function Navbar() {
  const [isScrolled, setIsScrolled] = useState(false)

  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 0) {
        setIsScrolled(true)
      } else {
        setIsScrolled(false)
      }
    }

    window.addEventListener("scroll", handleScroll)
    return () => window.removeEventListener("scroll", handleScroll)
  }, [])

  return (
    <header
      className={`fixed top-0 z-50 w-full transition-colors duration-300 ${isScrolled ? "bg-black" : "bg-transparent"}`}
    >
      <div className="flex items-center justify-between px-4 py-4 md:px-10">
        <div className="flex items-center space-x-8">
          <Link href="/" className="text-red-600 font-bold text-2xl">
            Black Truth TV
          </Link>
          <nav className="hidden md:flex space-x-4">
            <Link href="/" className="text-white hover:text-gray-300">
              Home
            </Link>
            <Link href="/channels" className="text-white hover:text-gray-300">
              Channels
            </Link>
            <Link href="/browse" className="text-white hover:text-gray-300">
              Browse
            </Link>
          </nav>
        </div>

        <div className="flex items-center space-x-4">
          <button className="text-white">
            <Search className="h-5 w-5" />
          </button>
          <button className="text-white">
            <Bell className="h-5 w-5" />
          </button>
          <button className="text-white">
            <User className="h-5 w-5" />
          </button>
        </div>
      </div>
    </header>
  )
}
