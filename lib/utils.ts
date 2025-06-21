import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Cleans a channel name to be URL-friendly or for consistent display.
 * Converts to lowercase, replaces spaces and multiple hyphens with a single hyphen,
 * and removes characters that are not alphanumeric or hyphens.
 * @param name The original channel name.
 * @returns A cleaned string.
 */
export function cleanChannelName(name: string | undefined | null): string {
  if (!name) {
    return ""
  }
  return String(name)
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-") // Replace spaces with hyphens
    .replace(/-+/g, "-") // Replace multiple hyphens with a single hyphen
    .replace(/[^a-z0-9-]/g, "") // Remove non-alphanumeric characters except hyphens
}

/**
 * Cleans a channel description by removing unwanted characters like quotation marks.
 * Also handles specific patterns like "50 that appear to be formatting issues.
 * @param description The original channel description.
 * @returns A cleaned string.
 */
export function cleanChannelDescription(description: string | undefined | null): string {
  if (!description) {
    return ""
  }

  let cleaned = String(description).trim()

  // Remove leading quotation marks
  cleaned = cleaned.replace(/^["']+/, "")

  // Remove trailing quotation marks
  cleaned = cleaned.replace(/["']+$/, "")

  // Fix specific patterns like "50 (quotation mark before a number)
  // This replaces patterns like "50 with just 50
  cleaned = cleaned.replace(/["']+(\d+)/g, "$1")

  // Also handle cases where there might be a space after the quote
  cleaned = cleaned.replace(/["']+\s+(\d+)/g, "$1")

  // You might want to add more general cleaning, like normalizing whitespace:
  // cleaned = cleaned.replace(/\s+/g, " ");

  return cleaned
}

// You can add other utility functions here as your project grows.
