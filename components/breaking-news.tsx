"use client"

import { useState, useEffect } from "react"
import { NewsTicker } from "./news-ticker"
import { getNewsItems } from "@/lib/news-data"

export function BreakingNews() {
  const [newsItems, setNewsItems] = useState<string[]>([])

  useEffect(() => {
    try {
      const items = getNewsItems()
      setNewsItems(items || [])
    } catch (error) {
      console.error("Error loading news items:", error)
      setNewsItems([])
    }
  }, [])

  // Don't render if there are no news items
  if (!newsItems || newsItems.length === 0) {
    return null
  }

  return (
    <div className="bg-red-600 text-white w-full z-20 mt-16">
      <NewsTicker news={newsItems} />
    </div>
  )
}
