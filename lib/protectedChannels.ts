export const PROTECTED_CHANNEL_KEYS = ["23","24","25","26","27","28","29"] as const;

export function isProtectedChannelKey(key: string) {
  return PROTECTED_CHANNEL_KEYS.includes(key);
}
