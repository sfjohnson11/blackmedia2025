/**
 * Formats a date and time to a user-friendly local time string.
 */
export function formatTimeToLocal(date: Date): string {
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
}
