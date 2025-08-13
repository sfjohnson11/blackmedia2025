// lib/channel-access.ts
// ✅ Client-safe: no `next/headers` imports here.

export const PROTECTED_CHANNEL_KEYS = ["23", "24", "25", "26", "27", "28", "29"] as const;

/**
 * Returns true if the given channel should be gated with a passcode.
 * Accepts string or number (we normalize to string).
 */
export function isPasswordProtected(channelIdOrKey: string | number): boolean {
  const key = String(channelIdOrKey);
  return (PROTECTED_CHANNEL_KEYS as readonly string[]).includes(key);
}

/** If you need the list elsewhere */
export function getProtectedChannelKeys(): string[] {
  return [...PROTECTED_CHANNEL_KEYS];
}
