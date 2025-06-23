// NewsTicker.tsx — with marquee scrolling and admin editing
"use client"

import { useState, useEffect } from "react"
import { Pause, Play, Edit } from "lucide-react"
import { Button } from "@/components/ui/button"

interface NewsTickerProps {
  news?: string[]
  speed?: number
  backgroundColor?: string
  textColor?: string
  isAdmin?: boolean
  onUpdateNews?: (news: string[]) => void
}

export function NewsTicker({
  news = [],
  speed = 30,
  backgroundColor = "bg-red-600",
  textColor = "text-white",
  isAdmin = false,
  onUpdateNews,
}: NewsTickerProps) {
  const [isPaused, setIsPaused] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editableNews, setEditableNews] = useState<string[]>(news)
  const [newNewsItem, setNewNewsItem] = useState("")

  useEffect(() => {
    if (news.length > 0) {
      setEditableNews(news)
    }
  }, [news])

  const handleSaveNews = () => {
    onUpdateNews?.(editableNews)
    setIsEditing(false)
  }

  const handleAddNewsItem = () => {
    if (newNewsItem.trim()) {
      const updated = [...editableNews, newNewsItem.trim()]
      setEditableNews(updated)
      setNewNewsItem("")
      onUpdateNews?.(updated)
    }
  }

  const handleRemoveNewsItem = (index: number) => {
    const updated = editableNews.filter((_, i) => i !== index)
    setEditableNews(updated)
    onUpdateNews?.(updated)
  }

  if (!editableNews || editableNews.length === 0) return null

  return (
    <div className={`w-full ${backgroundColor} relative overflow-hidden shadow-md`}>
      <div className="flex items-center py-3 px-4">
        <div className="mr-4">
          <span className={`font-bold ${textColor} text-sm md:text-base uppercase tracking-wider`}>BREAKING NEWS</span>
        </div>

        <div className="flex-1 overflow-hidden relative">
          <div
            className={`whitespace-nowrap ${textColor} font-medium text-sm md:text-base animate-marquee ${
              isPaused ? "paused" : ""
            }`}
            style={{ display: 'inline-block', whiteSpace: 'nowrap' }}
          >
            {editableNews.map((item, i) => (
              <span key={i} className="mx-8 inline-block">
                {item}
              </span>
            ))}
          </div>
        </div>

        <div className="ml-4">
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
                    const updated = [...editableNews]
                    updated[index] = e.target.value
                    setEditableNews(updated)
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
