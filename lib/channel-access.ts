// lib/channel-access.ts
import { cookies } from "next/headers";

export const COOKIE_PREFIX = "channel_unlocked_";

export function hasChannelCookie(key: string) {
  return cookies().get(`${COOKIE_PREFIX}${key}`)?.value === "1";
}
