"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Search, Bell, User, Heart, Menu, X } from "lucide-react"
import { SearchOverlay } from "./search-overlay"

export function Navbar() {
  const [isScrolled, setIsScrolled] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)

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
            <Link href="/favorites" className="text-white hover:text-gray-300">
              <Heart className="h-4 w-4 mr-1 inline text-red-500" />
              Favorites
            </Link>
            <Link href="/history" className="text-white hover:text-gray-300">
              Continue Watching
            </Link>
            <Link href="/donate" className="text-white hover:text-gray-300">
              Donate
            </Link>
          </nav>
        </div>

        <div className="flex items-center space-x-4">
          {/* Search button */}
          <button
            className="text-white hover:text-gray-300 transition-colors"
            onClick={() => setSearchOpen(!searchOpen)}
            aria-label="Search"
          >
            <Search className="h-5 w-5" />
          </button>

          {/* Notifications button */}
          <Link href="/notifications" className="text-white hover:text-gray-300 transition-colors relative">
            <Bell className="h-5 w-5" />
            <span className="absolute -top-1 -right-1 bg-red-600 rounded-full w-4 h-4 text-xs flex items-center justify-center">
              3
            </span>
          </Link>

          {/* User profile button */}
          <div className="relative">
            <Link href="/profile" className="text-white hover:text-gray-300 transition-colors">
              <User className="h-5 w-5" />
            </Link>
          </div>

          {/* Mobile menu button */}
          <button
            className="md:hidden text-white hover:text-gray-300"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-black border-t border-gray-800 py-4 px-4">
          <nav className="flex flex-col space-y-4">
            <Link href="/" className="text-white hover:text-gray-300 py-2">
              Home
            </Link>
            <Link href="/channels" className="text-white hover:text-gray-300 py-2">
              Channels
            </Link>
            <Link href="/browse" className="text-white hover:text-gray-300 py-2">
              Browse
            </Link>
            <Link href="/favorites" className="text-white hover:text-gray-300 py-2 flex items-center">
              <Heart className="h-4 w-4 mr-2 text-red-500" />
              Favorites
            </Link>
            <Link href="/history" className="text-white hover:text-gray-300 py-2">
              Continue Watching
            </Link>
            <Link href="/donate" className="text-white hover:text-gray-300 py-2">
              Donate
            </Link>
          </nav>
        </div>
      )}

      {/* Search overlay */}
      {searchOpen && <SearchOverlay onClose={() => setSearchOpen(false)} />}
    </header>
  )
}
