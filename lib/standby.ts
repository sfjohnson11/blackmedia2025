// lib/standby.ts
const ROOT = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/+$/, "");

function publicUrl(bucket: string, key: string) {
  const clean = key.replace(/^\.?\//, "").replace(/\\/g, "/").replace(/\/{2,}/g, "/");
  return `${ROOT}/storage/v1/object/public/${bucket}/${clean}`;
}

export function getStandbyUrlForChannel(channelId: number) {
  // If every channel uses the same filename, keep this one line.
  return publicUrl(`channel${channelId}`, "standby_blacktruthtv.mp4");
}
