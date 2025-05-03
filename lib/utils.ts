import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Cleans a channel name by removing unwanted characters like quotation marks
 */
export function cleanChannelName(name: string): string {
  if (!name) return name

  // Remove quotation marks at the beginning and end
  let cleaned = name.trim()

  // Remove leading quotation marks
  cleaned = cleaned.replace(/^["']+/, "")

  // Remove trailing quotation marks
  cleaned = cleaned.replace(/["']+$/, "")

  return cleaned
}

// Add a new function to clean channel descriptions
export function cleanChannelDescription(description: string | undefined): string {
  if (!description) return ""

  // Remove quotation marks at the beginning and end
  let cleaned = description.trim()

  // Remove leading quotation marks
  cleaned = cleaned.replace(/^["']+/, "")

  // Remove trailing quotation marks
  cleaned = cleaned.replace(/["']+$/, "")

  return cleaned
}
