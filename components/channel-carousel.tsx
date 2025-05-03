"use client"

import { useState, useEffect, useRef } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import type { Channel } from "@/types"
import { ChannelCard } from "@/components/channel-card"

interface ChannelCarouselProps {
  title: string
  channels: Channel[]
  autoScroll?: boolean
  autoScrollInterval?: number // in milliseconds
}

export function ChannelCarousel({
  title,
  channels,
  autoScroll = false,
  autoScrollInterval = 5000,
}: ChannelCarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isHovering, setIsHovering] = useState(false)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const autoScrollTimerRef = useRef<NodeJS.Timeout | null>(null)

  // Calculate how many items to show based on screen size
  const [itemsPerPage, setItemsPerPage] = useState(4)

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 640) {
        setItemsPerPage(1)
      } else if (window.innerWidth < 768) {
        setItemsPerPage(2)
      } else if (window.innerWidth < 1024) {
        setItemsPerPage(3)
      } else {
        setItemsPerPage(4)
      }
    }

    handleResize()
    window.addEventListener("resize", handleResize)
    return () => window.removeEventListener("resize", handleResize)
  }, [])

  // Auto-scroll functionality
  useEffect(() => {
    if (autoScroll && !isHovering && channels.length > itemsPerPage) {
      autoScrollTimerRef.current = setInterval(() => {
        scrollNext()
      }, autoScrollInterval)
    }

    return () => {
      if (autoScrollTimerRef.current) {
        clearInterval(autoScrollTimerRef.current)
      }
    }
  }, [autoScroll, isHovering, currentIndex, channels.length, itemsPerPage, autoScrollInterval])

  const scrollPrev = () => {
    setCurrentIndex((prev) => {
      const newIndex = Math.max(prev - 1, 0)
      scrollToIndex(newIndex)
      return newIndex
    })
  }

  const scrollNext = () => {
    setCurrentIndex((prev) => {
      const newIndex = Math.min(prev + 1, Math.max(0, channels.length - itemsPerPage))
      scrollToIndex(newIndex)
      return newIndex
    })
  }

  const scrollToIndex = (index: number) => {
    if (scrollContainerRef.current) {
      const cardWidth = scrollContainerRef.current.scrollWidth / channels.length
      scrollContainerRef.current.scrollTo({
        left: index * cardWidth,
        behavior: "smooth",
      })
    }
  }

  // Handle manual scroll
  const handleScroll = () => {
    if (scrollContainerRef.current) {
      const scrollLeft = scrollContainerRef.current.scrollLeft
      const cardWidth = scrollContainerRef.current.scrollWidth / channels.length
      const newIndex = Math.round(scrollLeft / cardWidth)
      if (newIndex !== currentIndex) {
        setCurrentIndex(newIndex)
      }
    }
  }

  const showLeftArrow = currentIndex > 0
  const showRightArrow = currentIndex < channels.length - itemsPerPage

  return (
    <div
      className="netflix-row relative"
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
    >
      <h2 className="netflix-title">{title}</h2>

      <div className="relative group">
        {/* Left navigation arrow */}
        {showLeftArrow && (
          <button
            onClick={scrollPrev}
            className="absolute left-0 top-1/2 -translate-y-1/2 z-10 bg-black/50 p-2 rounded-full 
                      opacity-0 group-hover:opacity-100 transition-opacity duration-300"
            aria-label="Previous channels"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
        )}

        {/* Right navigation arrow */}
        {showRightArrow && (
          <button
            onClick={scrollNext}
            className="absolute right-0 top-1/2 -translate-y-1/2 z-10 bg-black/50 p-2 rounded-full 
                      opacity-0 group-hover:opacity-100 transition-opacity duration-300"
            aria-label="Next channels"
          >
            <ChevronRight className="h-6 w-6" />
          </button>
        )}

        {/* Channel cards container */}
        <div
          ref={scrollContainerRef}
          className="flex space-x-5 overflow-x-scroll scrollbar-hide pb-6 pt-2 scroll-smooth"
          onScroll={handleScroll}
        >
          {channels.map((channel) => (
            <div key={channel.id} className="min-w-[220px] flex-shrink-0">
              <ChannelCard channel={channel} />
            </div>
          ))}
        </div>

        {/* Pagination indicators */}
        {channels.length > itemsPerPage && (
          <div className="flex justify-center mt-2 space-x-1">
            {Array.from({ length: Math.ceil(channels.length / itemsPerPage) }).map((_, i) => (
              <button
                key={i}
                onClick={() => {
                  setCurrentIndex(i * itemsPerPage)
                  scrollToIndex(i * itemsPerPage)
                }}
                className={`h-1 rounded-full transition-all duration-300 ${
                  i === Math.floor(currentIndex / itemsPerPage) ? "w-4 bg-red-600" : "w-2 bg-gray-600"
                }`}
                aria-label={`Go to page ${i + 1}`}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
