// lib/channel-access.ts
export const COOKIE_PREFIX = "channel_unlocked_";

// Re-export the protected list so client components (e.g., cards) can import safely
export { PROTECTED_CHANNEL_KEYS, isProtectedChannelKey } from "./protectedChannels";

