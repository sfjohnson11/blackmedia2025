// lib/supabase.ts
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/* ---------- Types ---------- */
export type Program = {
  id: string | number;
  channel_id: number | string;
  title?: string | null;
  mp4_url?: string | null;
  duration?: number | string | null;    // seconds
  start_time?: string | null;           // ISO; parsed as UTC
  description?: string | null;
  [k: string]: any;
};

export type Channel = {
  id: number | string;
  name?: string | null;
  slug?: string | null;
  logo_url?: string | null;
  youtube_channel_id?: string | null;   // CH21 live
  [k: string]: any;
};

export const STANDBY_PLACEHOLDER_ID = "standby-placeholder";

/* ---------- Supabase client (singleton; zero new deps) ---------- */
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

let _client: SupabaseClient | null = null;

/** Use this in ALL client code. Do not create other clients anywhere else. */
export function getSupabase(): SupabaseClient {
  if (_client) return _client;
  _client = createClient(URL, KEY, {
    auth: {
      persistSession: true,
      detectSessionInUrl: true,
      storageKey: "sb-bttv-auth",
    },
  });
  return _client;
}

// Keep this named export to avoid changing other files
export const supabase = getSupabase();

/* ---------- Time (UTC + seconds) ---------- */
export function toUtcDate(val?: string | Date | null): Date | null {
  if (!val) return null;
  if (val instanceof Date) return Number.isNaN(val.getTime()) ? null : val;

  let s = String(val).trim();
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/.test(s)) s = s.replace(" ", "T");

  if (/[zZ]$/.test(s)) {
    s = s.replace(/[zZ]$/, "Z");
  } else {
    const off = /([+\-]\d{2})(:?)(\d{2})?$/.exec(s);
    if (off) {
      const hh = off[1];
      const hasColon = off[2] === ":";
      const mm = off[3] ?? "";
      const norm = mm === "" ? `${hh}:00` : (hasColon ? `${hh}:${mm}` : `${hh}:${mm}`);
      s = s.replace(/([+\-]\d{2})(:?)(\d{2})?$/, norm);
      if (/\+00:00$/.test(s) || /\-00:00$/.test(s)) s = s.replace(/([+\-]00:00)$/, "Z");
    } else if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?$/.test(s)) {
      s = s + "Z";
    }
  }

  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function addSeconds(d: Date, secs: number) {
  return new Date(d.getTime() + secs * 1000);
}

export function parseDurationSec(v: number | string | null | undefined): number {
  if (typeof v === "number" && Number.isFinite(v)) return Math.max(0, Math.round(v));
  if (v == null) return 0;
  const n = Number(String(v).trim());
  return Number.isFinite(n) ? Math.max(0, Math.round(n)) : 0;
}

/* ---------- Storage (PUBLIC buckets) ---------- */
const ROOT = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/+$/, "");
const cleanKey = (k: string) =>
  (k || "").trim().replace(/^\.?\//, "").replace(/\\/g, "/").replace(/\/{2,}/g, "/");

const buildPublicUrl = (bucket: string, objectPath: string): string | undefined => {
  const key = cleanKey(objectPath);
  if (ROOT) return `${ROOT}/storage/v1/object/public/${bucket}/${key}`;
  try {
    const { data } = supabase.storage.from(bucket).getPublicUrl(key);
    return data?.publicUrl || undefined;
  } catch { return undefined; }
};

function bucketNameForChannelId(channel_id: number | string): string {
  if (typeof channel_id === "number" && Number.isFinite(channel_id)) return `channel${channel_id}`;
  const s = String(channel_id).trim().toLowerCase();
  if (/^\d+$/.test(s)) return `channel${s}`;
  if (s.startsWith("channel")) return s;
  return `channel${s}`;
}

/** Resolve playable URL from Program.mp4_url. */
export function getVideoUrlForProgram(p: Program): string | undefined {
  const raw0 = p?.mp4_url ?? "";
  let raw = String(raw0).trim();
  if (!raw) return undefined;

  if (/^https?:\/\//i.test(raw) || raw.startsWith("/")) return raw;

  let m = /^storage:\/\/([^/]+)\/(.+)$/.exec(raw);
  if (m) return buildPublicUrl(m[1], m[2]);

  m = /^([a-z0-9_\-]+):(.+)$/i.exec(raw);
  if (m) return buildPublicUrl(m[1], m[2]);

  m = /^([a-z0-9_\-]+)\/(.+)$/.exec(raw);
  if (m) return buildPublicUrl(m[1], m[2]);

  const bucket = bucketNameForChannelId(p.channel_id);
  const key = cleanKey(raw).replace(/^channel[^/]+\/+/i, "");
  return buildPublicUrl(bucket, key);
}

/* ---------- Channels ---------- */
export async function fetchChannelDetails(id: string | number): Promise<Channel | null> {
  const asNum = Number(id);
  if (!Number.isFinite(asNum)) return null;
  try {
    const { data, error } = await supabase
      .from("channels")
      .select("*")
      .eq("id", asNum)
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return (data as Channel) ?? null;
  } catch { return null; }
}
