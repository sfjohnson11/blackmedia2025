// Store news items in localStorage for easy updates
const NEWS_STORAGE_KEY = "blacktruth_news_items"

// Default news items if none are stored
const DEFAULT_NEWS = [
  "Welcome to Black Truth TV - Your source for 24/7 streaming across 29 channels",
  "Channels 22-29 are password protected - Contact admin for access",
  "All content on Black Truth TV is provided under Fair Use for educational purposes",
  "New content added daily - Check back regularly for updates",
  "Support our mission by visiting the Donate page",
]

// Get news items from localStorage or use defaults
export function getNewsItems(): string[] {
  if (typeof window === "undefined") return DEFAULT_NEWS

  try {
    const storedNews = localStorage.getItem(NEWS_STORAGE_KEY)
    return storedNews ? JSON.parse(storedNews) : DEFAULT_NEWS
  } catch (error) {
    console.error("Error loading news items:", error)
    return DEFAULT_NEWS
  }
}

// Save news items to localStorage
export function saveNewsItems(news: string[]): void {
  if (typeof window === "undefined") return

  try {
    localStorage.setItem(NEWS_STORAGE_KEY, JSON.stringify(news))
  } catch (error) {
    console.error("Error saving news items:", error)
  }
}

// Add a new news item
export function addNewsItem(item: string): string[] {
  const currentNews = getNewsItems()
  const updatedNews = [...currentNews, item]
  saveNewsItems(updatedNews)
  return updatedNews
}

// Remove a news item by index
export function removeNewsItem(index: number): string[] {
  const currentNews = getNewsItems()
  const updatedNews = currentNews.filter((_, i) => i !== index)
  saveNewsItems(updatedNews)
  return updatedNews
}

// Update a news item at a specific index
export function updateNewsItem(index: number, newText: string): string[] {
  const currentNews = getNewsItems()
  if (index >= 0 && index < currentNews.length) {
    currentNews[index] = newText
    saveNewsItems(currentNews)
  }
  return currentNews
}
