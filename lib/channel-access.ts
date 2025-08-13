// lib/channel-access.ts
// ✅ Client-safe helpers (no next/headers imports)

export const PROTECTED_CHANNEL_KEYS = ["23", "24", "25", "26", "27", "28", "29"] as const;

/**
 * Returns true if the given channel should be gated with a passcode.
 * Accepts string or number (we normalize to string).
 */
export function isPasswordProtected(channelIdOrKey: string | number): boolean {
  const key = String(channelIdOrKey);
  return (PROTECTED_CHANNEL_KEYS as readonly string[]).includes(key);
}

// (Optional) If some code wants the whole list:
export function getProtectedChannelKeys(): string[] {
  return [...PROTECTED_CHANNEL_KEYS];
}

/**
 * NOTE:
 * - Do NOT read the unlock cookie from here (httpOnly cookie isn’t available to client code).
 * - Server-only helpers that read cookies belong in a separate file:
//    lib/channel-access.server.ts
 *   where you can import `cookies` from "next/headers".
 */
