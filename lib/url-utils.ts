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

/**
 * Constructs a full Supabase public URL for a given relative MP4 path
 * Cleans up double slashes and ensures proper formatting
 * @param mp4Path The path stored in the database (e.g. "/channel1//video.mp4")
 * @returns Full public video URL
 */
export function getFullUrl(mp4Path: string): string {
  if (!mp4Path) return ""

  const baseUrl = "https://msllqpnxwbugvkpnquwx.supabase.co/storage/v1/object/public"

  // Remove any leading slashes
  const cleanPath = mp4Path.replace(/^\/+/g, "")

  // Replace multiple slashes in the middle with a single slash
  const sanitizedPath = cleanPath.replace(/\/{2,}/g, "/")

  return `${baseUrl}/${sanitizedPath}`
}
