// app/watch/[channelId]/page.tsx
"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import YouTubeEmbed from "@/components/youtube-embed";

/* ---------- schema (your exact columns) ---------- */
type Channel = {
  id: number;
  name: string | null;
  slug?: string | null;
  description?: string | null;
  logo_url: string | null;            // poster ONLY
  youtube_channel_id: string | null;  // CH21 live
  youtube_is_live?: boolean | null;
  is_active?: boolean | null;
};
type Program = {
  id: string | number;
  channel_id: number;
  title: string | null;
  mp4_url: string | null;             // VIDEO ONLY
  start_time: string;                 // UTC "Z" or "YYYY-MM-DD HH:mm:ss" (UTC)
  duration: number | string;          // seconds, e.g. 7620 or "7620s"
};

const CH21 = 21;
const STANDBY_FILE = "standby_blacktruthtv.mp4";

/* ---------- time (STRICT UTC) ---------- */
const nowUtc = () => new Date(new Date().toISOString());
function toUtcDate(val?: string | Date | null): Date | null {
  if (!val) return null;
  if (val instanceof Date) return Number.isNaN(val.getTime()) ? null : val;
  let s = String(val).trim();
  // Treat DB "YYYY-MM-DD HH:mm:ss(.sss)" as UTC
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(\.\d+)?$/.test(s)) s = s.replace(" ", "T") + "Z";
  // ISO without tz → force Z (UTC)
  else if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?$/.test(s)) s = s + "Z";
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}
const addSeconds = (d: Date, secs: number) => new Date(d.getTime() + secs * 1000);

/* ---------- display (local or UTC) ---------- */
type TzMode = "local" | "utc";
function fmtOne(isoish?: string, mode: TzMode = "local") {
  const d = toUtcDate(isoish);
  if (!d) return "—";
  const opt: Intl.DateTimeFormatOptions = {
    hour12: true, hour: "2-digit", minute: "2-digit", second: "2-digit", timeZoneName: "short",
  };
  if (mode === "utc") opt.timeZone = "UTC";
  return d.toLocaleString([], opt);
}

/* ---------- duration parsing (handles "7620s" or 7620) ---------- */
function parseDurationSec(v: number | string | null | undefined): number {
  if (typeof v === "number") return Number.isFinite(v) && v > 0 ? v : 0;
  if (v == null) return 0;
  const m = String(v).match(/^\s*(\d+)/);
  if (!m) return 0;
  const n = Number(m[1]);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/* ---------- storage (public buckets, no SDK calls) ---------- */
const bucketFor = (id: number) => `channel${id}`;
const cleanKey  = (k: string) => k.trim().replace(/^\.?\//, "").replace(/\\/g, "/").replace(/\/{2,}/g, "/");
const encPath   = (p: string) => p.split("/").map(encodeURIComponent).join("/");

function computePubRoot(ch?: Channel, progs?: Program[]) {
  const envBase = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/+$/, "");
  if (envBase) return `${envBase}/storage/v1/object/public`;
  const scan = (u?: string | null) => {
    if (!u) return null;
    const s = String(u);
    const i = s.indexOf("/storage/v1/object/public/");
    if (s.startsWith("http") && i > 0) return s.slice(0, i + "/storage/v1/object/public".length);
    return null;
  };
  const a = scan(ch?.logo_url);
  if (a) return a;
  for (const p of progs || []) {
    const x = scan(p?.mp4_url || "");
    if (x) return x;
  }
  return "/storage/v1/object/public";
}
function fromBucket(pubRoot: string, bucket: string, key: string) {
  const root = pubRoot.replace(/\/+$/, "");
  return `${root}/${bucket}/${encPath(cleanKey(key))}`;
}
function resolveSrc(p: Program, channelId: number, pubRoot: string): string | undefined {
  let raw = (p?.mp4_url || "").trim();
  if (!raw) return undefined;
  if (/^https?:\/\//i.test(raw) || raw.startsWith("/")) return raw;
  raw = cleanKey(raw);

  const m1 = /^([a-z0-9_\-]+):(.+)$/i.exec(raw);
  if (m1) return fromBucket(pubRoot, m1[1], m1
