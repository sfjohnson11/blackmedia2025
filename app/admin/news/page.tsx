"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { ArrowLeft, AlertTriangle, Save, Plus, Trash2 } from "lucide-react"
import { getNewsItems, saveNewsItems } from "@/lib/news-data"
import { NewsTicker } from "@/components/news-ticker"

export default function AdminNewsPage() {
  const [newsItems, setNewsItems] = useState<string[]>([])
  const [newItem, setNewItem] = useState("")
  const [isSaved, setIsSaved] = useState(false)
  const [isLoaded, setIsLoaded] = useState(false)

  useEffect(() => {
    // Load news items on client side
    setNewsItems(getNewsItems())
    setIsLoaded(true)
  }, [])

  const handleAddItem = () => {
    if (newItem.trim()) {
      const updatedItems = [...newsItems, newItem.trim()]
      setNewsItems(updatedItems)
      // Save immediately to ensure it's stored
      saveNewsItems(updatedItems)
      setNewItem("")
      setIsSaved(true)
      setTimeout(() => setIsSaved(false), 3000)
    }
  }

  const handleRemoveItem = (index: number) => {
    setNewsItems(newsItems.filter((_, i) => i !== index))
    setIsSaved(false)
  }

  const handleUpdateItem = (index: number, value: string) => {
    const updatedItems = [...newsItems]
    updatedItems[index] = value
    setNewsItems(updatedItems)
    setIsSaved(false)
  }

  const handleSaveAll = () => {
    saveNewsItems(newsItems)
    setIsSaved(true)
    // Add a small delay before reloading to ensure storage is updated
    setTimeout(() => {
      window.location.reload()
    }, 1000)
  }

  if (!isLoaded) {
    return (
      <div className="pt-24 px-4 md:px-10 flex items-center justify-center min-h-[80vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-red-600"></div>
      </div>
    )
  }

  return (
    <div className="pt-24 px-4 md:px-10 pb-16">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center mb-8">
          <Link href="/admin" className="mr-4">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Admin
            </Button>
          </Link>
          <h1 className="text-3xl font-bold">Manage Breaking News</h1>
        </div>

        <div className="bg-gray-800 rounded-lg p-6 mb-8">
          <h2 className="text-xl font-bold mb-4">Current Breaking News</h2>
          <div className="mb-6">
            <NewsTicker news={newsItems} />
          </div>

          <div className="bg-gray-900/50 p-4 rounded-md mb-6">
            <div className="flex items-start">
              <AlertTriangle className="h-5 w-5 text-yellow-500 mr-3 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-gray-300">
                The breaking news ticker appears at the top of your site below the navigation bar. It rotates through
                all news items automatically. Changes made here will be visible to all visitors.
              </p>
            </div>
          </div>

          <div className="space-y-4 mb-6">
            <h3 className="font-semibold">Edit News Items</h3>
            {newsItems.map((item, index) => (
              <div key={index} className="flex items-center">
                <input
                  type="text"
                  value={item}
                  onChange={(e) => handleUpdateItem(index, e.target.value)}
                  className="flex-1 px-3 py-2 bg-gray-700 border border-gray-600 rounded-md"
                />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleRemoveItem(index)}
                  className="ml-2 text-red-400 hover:text-red-300"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>

          <div className="flex mb-6">
            <input
              type="text"
              value={newItem}
              onChange={(e) => setNewItem(e.target.value)}
              placeholder="Add new breaking news item..."
              className="flex-1 px-3 py-2 bg-gray-700 border border-gray-600 rounded-l-md"
              onKeyDown={(e) => {
                if (e.key === "Enter") handleAddItem()
              }}
            />
            <Button onClick={handleAddItem} className="rounded-l-none bg-green-600 hover:bg-green-700">
              <Plus className="h-4 w-4 mr-1" />
              Add
            </Button>
          </div>

          <div className="flex justify-end">
            <Button onClick={handleSaveAll} className="bg-blue-600 hover:bg-blue-700">
              <Save className="h-4 w-4 mr-2" />
              {isSaved ? "Saved!" : "Save All Changes"}
            </Button>
          </div>
        </div>

        <div className="bg-gray-800 rounded-lg p-6">
          <h2 className="text-xl font-bold mb-4">Tips for Effective Breaking News</h2>
          <ul className="space-y-2 text-gray-300">
            <li>• Keep messages concise and easy to read at a glance</li>
            <li>• Use for important announcements, new content, or special events</li>
            <li>• Update regularly to keep content fresh</li>
            <li>• Avoid using too many items as it may take too long to cycle through them</li>
            <li>• Consider removing older news items that are no longer relevant</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
