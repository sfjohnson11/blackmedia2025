export function getContinueWatching(): string[] {
  if (typeof window === "undefined") return []
  const keys = Object.keys(localStorage).filter((k) => k.startsWith("video_progress_"))
  return keys.map((k) => k.replace("video_progress_", ""))
}

export function getProgressFor(src: string) {
  const raw = localStorage.getItem(`video_progress_${src}`)
  return raw ? JSON.parse(raw) : null
}
