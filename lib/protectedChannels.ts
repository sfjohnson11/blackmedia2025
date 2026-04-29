// Replaced by lib/protected-channels.ts
// Keeping for backward compatibility

export const PROTECTED_CHANNEL_KEYS = ['23', '24', '25', '26', '27', '28', '29'] as const

export function isProtectedChannelKey(key: string): boolean {
  return false // passcode system disabled
}
