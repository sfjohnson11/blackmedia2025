// Replaced by membership-based access control
// Keeping this file to avoid import errors in any components that still reference it

export const COOKIE_PREFIX = 'channel_unlocked_'

export function hasChannelCookie(key: string): boolean {
  return false // passcode system disabled — membership required
}
