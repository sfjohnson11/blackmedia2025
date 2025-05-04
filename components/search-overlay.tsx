"use client"

import { useState, useEffect, useRef } from "react"
import { X, Search, Loader2 } from "lucide-react"
import Link from "next/link"
import Image from "next/image"

interface SearchResult {
  id: number
  name: string
  description?: string
  image_url?: string
  type: "channel" | "program"
}

interface SearchOverlayProps {
  onClose: () => void
}

export function SearchOverlay({ onClose }: SearchOverlayProps) {
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<SearchResult[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    // Focus the input when the overlay opens
    if (inputRef.current) {
      inputRef.current.focus()
    }

    // Add escape key listener
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose()
      }
    }

    window.addEventListener("keydown", handleEscape)
    return () => window.removeEventListener("keydown", handleEscape)
  }, [onClose])

  useEffect(() => {
    const searchTimeout = setTimeout(async () => {
      if (query.length >= 2) {
        setIsLoading(true)
        try {
          const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`)
          if (response.ok) {
            const data = await response.json()
            setResults(data)
          }
        } catch (error) {
          console.error("Search error:", error)
        } finally {
          setIsLoading(false)
        }
      } else {
        setResults([])
      }
    }, 300)

    return () => clearTimeout(searchTimeout)
  }, [query])

  return (
    <div className="fixed inset-0 bg-black/95 z-50 overflow-y-auto">
      <div className="max-w-4xl mx-auto pt-20 px-4">
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-2xl font-bold text-white">Search</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
            aria-label="Close search"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="relative mb-8">
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search for channels or programs..."
            className="w-full bg-gray-900 border border-gray-700 rounded-md py-3 px-4 pl-12 text-white text-lg"
          />
          <Search className="absolute left-4 top-3.5 h-5 w-5 text-gray-400" />
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 text-red-600 animate-spin" />
          </div>
        ) : results.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {results.map((result) => (
              <Link
                key={`${result.type}-${result.id}`}
                href={result.type === "channel" ? `/watch/${result.id}` : `/program/${result.id}`}
                onClick={onClose}
                className="bg-gray-800 rounded-md overflow-hidden hover:bg-gray-700 transition-colors"
              >
                <div className="aspect-video relative">
                  <Image
                    src={result.image_url || "/placeholder.svg?height=180&width=320&query=channel"}
                    alt={result.name}
                    fill
                    className="object-cover"
                  />
                </div>
                <div className="p-3">
                  <h3 className="font-medium text-white">{result.name}</h3>
                  {result.description && (
                    <p className="text-sm text-gray-300 line-clamp-2 mt-1">{result.description}</p>
                  )}
                  <span className="inline-block mt-2 text-xs text-gray-400 bg-gray-900 px-2 py-1 rounded">
                    {result.type === "channel" ? "Channel" : "Program"}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        ) : query.length >= 2 ? (
          <div className="text-center py-12 text-gray-400">No results found for "{query}"</div>
        ) : null}
      </div>
    </div>
  )
}
