'use client'

import { Heart } from 'lucide-react'
import { useState, useEffect } from 'react'
import { isFavorited, toggleFavorite } from '@/lib/favorites'

interface FavoriteToggleProps {
  programId: string
}

export function FavoriteToggle({ programId }: FavoriteToggleProps) {
  const [favorited, setFavorited] = useState(false)

  useEffect(() => {
    setFavorited(isFavorited(programId))
  }, [programId])

  const handleClick = () => {
    toggleFavorite(programId)
    setFavorited(!favorited)
  }

  return (
    <button
      onClick={handleClick}
      className={`p-2 rounded-full border ${
        favorited ? 'text-red-500 border-red-500' : 'text-gray-500 border-gray-700'
      } hover:bg-gray-800`}
      title={favorited ? 'Remove from favorites' : 'Add to favorites'}
    >
      <Heart fill={favorited ? 'currentColor' : 'none'} className="h-5 w-5" />
    </button>
  )
}
