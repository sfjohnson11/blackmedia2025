// lib/favorites.ts

export function getFavorites(): string[] {
  if (typeof window === "undefined") return []
  const stored = localStorage.getItem("favorite_programs")
  return stored ? JSON.parse(stored) : []
}

export function toggleFavorite(programId: string) {
  const favorites = getFavorites()
  const updated = favorites.includes(programId)
    ? favorites.filter((id) => id !== programId)
    : [...favorites, programId]
  localStorage.setItem("favorite_programs", JSON.stringify(updated))
}

export function isFavorited(programId: string): boolean {
  return getFavorites().includes(programId)
}
