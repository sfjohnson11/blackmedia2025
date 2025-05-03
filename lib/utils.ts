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

/**
 * Cleans a channel description by removing unwanted characters like quotation marks
 * Also handles specific patterns like "50 that appear to be formatting issues
 */
export function cleanChannelDescription(description: string | undefined): string {
  if (!description) return ""

  // Remove quotation marks at the beginning and end
  let cleaned = description.trim()

  // Remove leading quotation marks
  cleaned = cleaned.replace(/^["']+/, "")

  // Remove trailing quotation marks
  cleaned = cleaned.replace(/["']+$/, "")

  // Fix specific patterns like "50 (quotation mark before a number)
  // This replaces patterns like "50 with just 50
  cleaned = cleaned.replace(/["']+(\d+)/g, "$1")

  // Also handle cases where there might be a space after the quote
  cleaned = cleaned.replace(/["']+ +(\d+)/g, "$1")

  return cleaned
}
