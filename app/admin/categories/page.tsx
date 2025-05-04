"use client"

import { useState, useEffect } from "react"
import { createClient } from "@supabase/supabase-js"
import { Loader2, Plus, Save, Trash2 } from "lucide-react"

export default function CategoriesPage() {
  const [categories, setCategories] = useState<any[]>([])
  const [newCategory, setNewCategory] = useState("")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState({ text: "", type: "" })

  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

  useEffect(() => {
    fetchCategories()
  }, [])

  const fetchCategories = async () => {
    try {
      setLoading(true)

      // Get all unique categories from channels
      const { data, error } = await supabase.from("channels").select("category").not("category", "is", null)

      if (error) throw error

      // Extract unique categories
      const uniqueCategories = Array.from(new Set(data.map((item) => item.category).filter(Boolean))).map((name) => ({
        name,
      }))

      setCategories(uniqueCategories)
    } catch (error) {
      console.error("Error fetching categories:", error)
      setMessage({ text: "Failed to load categories", type: "error" })
    } finally {
      setLoading(false)
    }
  }

  const addCategory = () => {
    if (!newCategory.trim()) return

    // Check if category already exists
    if (categories.some((cat) => cat.name.toLowerCase() === newCategory.trim().toLowerCase())) {
      setMessage({ text: "Category already exists", type: "error" })
      return
    }

    setCategories([...categories, { name: newCategory.trim(), isNew: true }])
    setNewCategory("")
  }

  const removeCategory = (index: number) => {
    const updatedCategories = [...categories]
    updatedCategories.splice(index, 1)
    setCategories(updatedCategories)
  }

  const saveCategories = async () => {
    try {
      setSaving(true)
      setMessage({ text: "", type: "" })

      // Get all channels
      const { data: channels, error: fetchError } = await supabase.from("channels").select("id, category")

      if (fetchError) throw fetchError

      // Find categories that were removed
      const currentCategoryNames = categories.map((cat) => cat.name)
      const removedCategories = Array.from(new Set(channels.map((ch) => ch.category).filter(Boolean))).filter(
        (cat) => !currentCategoryNames.includes(cat as string),
      )

      // Update channels with removed categories to "Uncategorized"
      if (removedCategories.length > 0) {
        const { error: updateError } = await supabase
          .from("channels")
          .update({ category: "Uncategorized" })
          .in("category", removedCategories)

        if (updateError) throw updateError
      }

      setMessage({ text: "Categories saved successfully", type: "success" })
    } catch (error) {
      console.error("Error saving categories:", error)
      setMessage({ text: "Failed to save categories", type: "error" })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Manage Categories</h1>

      {message.text && (
        <div
          className={`p-4 mb-6 rounded-md ${
            message.type === "error" ? "bg-red-100 text-red-800" : "bg-green-100 text-green-800"
          }`}
        >
          {message.text}
        </div>
      )}

      <div className="bg-white rounded-md shadow-sm p-6 mb-6">
        <h2 className="text-lg font-medium mb-4">Current Categories</h2>

        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-8 w-8 text-blue-500 animate-spin" />
          </div>
        ) : (
          <>
            <div className="space-y-3 mb-6">
              {categories.length === 0 ? (
                <p className="text-gray-500 italic">No categories found</p>
              ) : (
                categories.map((category, index) => (
                  <div key={index} className="flex items-center justify-between bg-gray-50 p-3 rounded-md">
                    <span className={category.isNew ? "font-medium text-blue-600" : ""}>{category.name}</span>
                    <button
                      onClick={() => removeCategory(index)}
                      className="text-red-500 hover:text-red-700"
                      aria-label={`Remove ${category.name} category`}
                    >
                      <Trash2 className="h-5 w-5" />
                    </button>
                  </div>
                ))
              )}
            </div>

            <div className="flex items-center mt-4">
              <input
                type="text"
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                placeholder="New category name"
                className="flex-grow border border-gray-300 rounded-l-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                onClick={addCategory}
                className="bg-blue-500 text-white px-4 py-2 rounded-r-md hover:bg-blue-600 flex items-center"
                disabled={!newCategory.trim()}
              >
                <Plus className="h-5 w-5 mr-1" />
                Add
              </button>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                onClick={saveCategories}
                disabled={saving}
                className="bg-green-500 text-white px-4 py-2 rounded-md hover:bg-green-600 flex items-center"
              >
                {saving ? <Loader2 className="h-5 w-5 mr-2 animate-spin" /> : <Save className="h-5 w-5 mr-2" />}
                Save Changes
              </button>
            </div>
          </>
        )}
      </div>

      <div className="bg-blue-50 p-4 rounded-md text-sm text-blue-800">
        <p className="font-medium mb-2">How categories work:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Categories are used to group channels on the homepage</li>
          <li>Removing a category will move its channels to "Uncategorized"</li>
          <li>To assign channels to categories, use the channel editor</li>
        </ul>
      </div>
    </div>
  )
}
