/**
 * Builds a complete public Supabase URL for a given relative MP4 path.
 */
export function getFullUrl(mp4Path: string): string {
  if (!mp4Path) return ""

  const baseUrl = "https://msllqpnxwbugvkpnquwx.supabase.co/storage/v1/object/public"

  // Remove leading slashes
  const cleanPath = mp4Path.replace(/^\/+/, "")

  // Replace multiple slashes
  const sanitizedPath = cleanPath.replace(/\/{2,}/g, "/")

  return `${baseUrl}/${sanitizedPath}`
}

/**
 * Detects the video type based on file extension
 */
export function getVideoTypeFromUrl(url: string): "mp4" | "hls" | "unknown" {
  if (!url) return "unknown"
  const lower = url.toLowerCase()

  if (lower.endsWith(".m3u8")) return "hls"
  if (lower.endsWith(".mp4")) return "mp4"
  return "unknown"
}
