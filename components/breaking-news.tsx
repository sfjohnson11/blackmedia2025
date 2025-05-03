"use client"

import { useState, useEffect } from "react"
import { NewsTicker } from "@/components/news-ticker"
import { getNewsItems, saveNewsItems } from "@/lib/news-data"

interface BreakingNewsProps {
  isAdmin?: boolean
}

export function BreakingNews({ isAdmin = false }: BreakingNewsProps) {
  const [newsItems, setNewsItems] = useState<string[]>([])
  const [isLoaded, setIsLoaded] = useState(false)

  useEffect(() => {
    // Load news items on client side
    setNewsItems(getNewsItems())
    setIsLoaded(true)
  }, [])

  const handleUpdateNews = (updatedNews: string[]) => {
    saveNewsItems(updatedNews)
    setNewsItems(updatedNews)
  }

  // Don't render until client-side data is loaded
  if (!isLoaded) return null

  return (
    <NewsTicker
      news={newsItems}
      isAdmin={isAdmin}
      onUpdateNews={handleUpdateNews}
      speed={15} // Time in seconds each news item is displayed
    />
  )
}
