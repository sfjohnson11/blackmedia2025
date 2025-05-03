"use client"

import { useState, useEffect, useRef } from "react"
import { Pause, Play, Edit } from "lucide-react"
import { Button } from "@/components/ui/button"

interface NewsTickerProps {
  news: string[]
  speed?: number
  backgroundColor?: string
  textColor?: string
  isAdmin?: boolean
  onUpdateNews?: (news: string[]) => void
}

export function NewsTicker({
  news,
  speed = 30,
  backgroundColor = "bg-red-600",
  textColor = "text-white",
  isAdmin = false,
  onUpdateNews,
}: NewsTickerProps) {
  const [isPaused, setIsPaused] = useState(false)
  const [currentNewsIndex, setCurrentNewsIndex] = useState(0)
  const [isEditing, setIsEditing] = useState(false)
  const [editableNews, setEditableNews] = useState<string[]>(news)
  const [newNewsItem, setNewNewsItem] = useState("")
  const tickerRef = useRef<HTMLDivElement>(null)

  // Auto-rotate news items
  useEffect(() => {
    if (isPaused || news.length <= 1) return

    const interval = setInterval(() => {
      setCurrentNewsIndex((prevIndex) => (prevIndex + 1) % news.length)
    }, speed * 1000) // Convert to milliseconds

    return () => clearInterval(interval)
  }, [isPaused, news, speed])

  // Handle saving edited news
  const handleSaveNews = () => {
    if (onUpdateNews) {
      onUpdateNews(editableNews)
    }
    setIsEditing(false)
  }

  // Add a new news item
  const handleAddNewsItem = () => {
    if (newNewsItem.trim()) {
      const updatedNews = [...editableNews, newNewsItem.trim()]
      setEditableNews(updatedNews)
      setNewNewsItem("")
      if (onUpdateNews) {
        onUpdateNews(updatedNews)
      }
    }
  }

  // Remove a news item
  const handleRemoveNewsItem = (index: number) => {
    const updatedNews = editableNews.filter((_, i) => i !== index)
    setEditableNews(updatedNews)
    if (onUpdateNews) {
      onUpdateNews(updatedNews)
    }
  }

  // If there are no news items, don't render anything
  if (news.length === 0) return null

  return (
    <div className={`w-full ${backgroundColor} relative overflow-hidden shadow-md`}>
      {/* Main ticker */}
      <div className="flex items-center py-3 px-4">
        <div className="flex-shrink-0 mr-4">
          <span className={`font-bold ${textColor} text-sm md:text-base uppercase tracking-wider`}>BREAKING NEWS</span>
        </div>

        <div className="flex-1 overflow-hidden relative">
          <div
            ref={tickerRef}
            className={`whitespace-nowrap ${textColor} font-medium text-sm md:text-base transition-transform duration-1000 ease-in-out`}
          >
            {news[currentNewsIndex]}
          </div>
        </div>

        <div className="flex-shrink-0 ml-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsPaused(!isPaused)}
            className={`${textColor} hover:bg-white/20`}
            aria-label={isPaused ? "Play" : "Pause"}
          >
            {isPaused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
          </Button>

          {isAdmin && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsEditing(!isEditing)}
              className={`${textColor} hover:bg-white/20 ml-1`}
              aria-label="Edit News"
            >
              <Edit className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Admin editing interface */}
      {isAdmin && isEditing && (
        <div className="bg-gray-900 p-4 border-t border-gray-700">
          <h3 className="font-bold mb-3">Edit Breaking News</h3>

          <div className="space-y-3 mb-4">
            {editableNews.map((item, index) => (
              <div key={index} className="flex items-center">
                <input
                  type="text"
                  value={item}
                  onChange={(e) => {
                    const updatedNews = [...editableNews]
                    updatedNews[index] = e.target.value
                    setEditableNews(updatedNews)
                  }}
                  className="flex-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded-md"
                />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleRemoveNewsItem(index)}
                  className="ml-2 text-red-400 hover:text-red-300"
                >
                  Remove
                </Button>
              </div>
            ))}
          </div>

          <div className="flex mb-4">
            <input
              type="text"
              value={newNewsItem}
              onChange={(e) => setNewNewsItem(e.target.value)}
              placeholder="Add new news item..."
              className="flex-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded-l-md"
            />
            <Button onClick={handleAddNewsItem} className="rounded-l-none">
              Add
            </Button>
          </div>

          <div className="flex justify-end">
            <Button variant="outline" onClick={() => setIsEditing(false)} className="mr-2">
              Cancel
            </Button>
            <Button onClick={handleSaveNews}>Save Changes</Button>
          </div>
        </div>
      )}
    </div>
  )
}
