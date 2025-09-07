// lib/standby.ts
const ROOT = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/+$/, "");

function publicUrl(bucket: string, key: string) {
  const clean = key.replace(/^\.?\//, "").replace(/\\/g, "/").replace(/\/{2,}/g, "/");
  return `${ROOT}/storage/v1/object/public/${bucket}/${clean}`;
}

/** Always build the standby URL for a numeric channel id. */
export function getStandbyUrlForChannel(channelId: number) {
  // If you use a single universal filename across all buckets, this one line is enough.
  return publicUrl(`channel${channelId}`, "standby_blacktruthtv.mp4");
}
