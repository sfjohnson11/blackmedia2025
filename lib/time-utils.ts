/**
 * Converts a Sacramento midnight time to UTC
 * Sacramento is in Pacific Time (UTC-7 during PDT, UTC-8 during PST)
 */
export function sacramentoMidnightToUTC(date: Date): Date {
  const result = new Date(date)

  // Check if date is in Daylight Saving Time
  // In the US, DST starts on the second Sunday in March and ends on the first Sunday in November
  const isDST = isDaylightSavingTime(date)

  // Set to midnight in Sacramento local time
  result.setHours(0, 0, 0, 0)

  // Convert to UTC (add 7 hours during PDT, 8 hours during PST)
  result.setHours(result.getHours() + (isDST ? 7 : 8))

  return result
}

/**
 * Checks if a date is during Daylight Saving Time in the US
 */
export function isDaylightSavingTime(date: Date): boolean {
  // Get the year
  const year = date.getFullYear()

  // DST starts on the second Sunday in March
  const dstStart = new Date(year, 2, 1) // March 1
  dstStart.setDate(dstStart.getDate() + ((14 - dstStart.getDay()) % 7)) // Second Sunday

  // DST ends on the first Sunday in November
  const dstEnd = new Date(year, 10, 1) // November 1
  dstEnd.setDate(dstEnd.getDate() + ((7 - dstEnd.getDay()) % 7)) // First Sunday

  // Check if the date is between DST start and end
  return date >= dstStart && date < dstEnd
}

/**
 * Formats a date in a user-friendly format
 */
export function formatDateTime(date: Date): string {
  return date.toLocaleString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short",
  })
}

/**
 * Gets the next Monday date
 */
export function getNextMonday(): Date {
  const today = new Date()
  const day = today.getDay() // 0 is Sunday, 1 is Monday, etc.
  const daysUntilNextMonday = day === 0 ? 1 : 8 - day // If today is Sunday, next Monday is tomorrow

  const nextMonday = new Date(today)
  nextMonday.setDate(today.getDate() + daysUntilNextMonday)
  nextMonday.setHours(0, 0, 0, 0)

  return nextMonday
}
