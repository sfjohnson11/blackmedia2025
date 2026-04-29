// Replaced by membership-based access control in lib/protected-channels.ts
// Keeping for backward compatibility

export const PROTECTED_CHANNEL_KEYS = ['23', '24', '25', '26', '27', '28', '29'] as const
export const COOKIE_PREFIX = 'channel_unlocked_'

export function isPasswordProtected(channelIdOrKey: string | number): boolean {
  return false // passcode system disabled
}

export function getProtectedChannelKeys(): string[] {
  return []
}
