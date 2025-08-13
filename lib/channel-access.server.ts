// lib/channel-access.server.ts
import { cookies } from "next/headers";
import { COOKIE_PREFIX } from "./channel-access";

export function hasChannelCookie(key: string) {
  return cookies().get(`${COOKIE_PREFIX}${key}`)?.value === "1";
}
