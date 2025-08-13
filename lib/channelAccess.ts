import { cookies } from "next/headers";
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";

const COOKIE_PREFIX = "channel_unlocked_";

export function hasChannelCookie(key: string) {
  return cookies().get(`${COOKIE_PREFIX}${key}`)?.value === "1";
}

export async function verifyAndGrantChannelAccess(key: string, passcode: string) {
  const supabase = createServerComponentClient({ cookies });

  const { data, error } = await supabase.rpc("verify_channel_passcode", {
    p_channel_key: key,
    p_passcode: passcode,
  });
  if (error) throw error;

  const ok = !!data;
  if (ok) {
    // httpOnly cookie so client JS can’t read it
    cookies().set(`${COOKIE_PREFIX}${key}`, "1", {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 12, // 12 hours
    });
  }
  return ok;
}
