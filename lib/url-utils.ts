// url-utils.ts

/**
 * Checks if a URL is accessible by making a HEAD request
 * @param url The URL to check
 * @returns Promise<boolean> True if the URL is accessible
 */
export async function isUrlAccessible(url: string): Promise<boolean> {
  if (!url) return false

  try {
    const response = await fetch(url, {
      method: "HEAD",
      mode: "no-cors",
      cache: "no-cache",
    })

    return true
  } catch (error) {
    console.error(`URL accessibility check failed for ${url}:`, error)
    return false
  }
}

/**
 * Checks if a URL is a valid format
 * @param url The URL to validate
 * @returns boolean True if the URL is valid
 */
export function isValidUrl(url: string): boolean {
  if (!url) return false

  try {
    new URL(url)
    return true
  } catch (e) {
    return false
  }
}

/**
 * Determines the video type from a URL
 * @param url The URL to check
 * @returns "mp4" | "hls" | "unknown"
 */
export function getVideoTypeFromUrl(url: string): "mp4" | "hls" | "unknown" {
  if (!url) return "unknown"

  const lowerUrl = url.toLowerCase()

  if (lowerUrl.includes(".m3u8")) return "hls"
  if (lowerUrl.includes(".mp4")) return "mp4"

  // Guess based on known streaming platforms
  if (
    lowerUrl.includes("mux.dev") ||
    lowerUrl.includes("livestream") ||
    lowerUrl.includes("stream") ||
    lowerUrl.includes("live")
  ) {
    return "hls"
  }

  return "mp4" // Default fallback
}
