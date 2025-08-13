import { NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";

// GET ?channelId=23&day=2025-08-11  -> list draft rows
export async function GET(req: Request) {
  const supabase = createRouteHandlerClient({ cookies });
  const url = new URL(req.url);
  const channelId = url.searchParams.get("channelId");
  const day = url.searchParams.get("day"); // YYYY-MM-DD
  if (!channelId || !day) return NextResponse.json({ ok: false, error: "channelId and day are required" }, { status: 400 });

  const { data, error } = await supabase
    .from("programs_draft")
    .select("*")
    .eq("channel_id", channelId)
    .gte("start_time", `${day}T00:00:00Z`)
    .lt("start_time", `${day}T24:00:00Z`)
    .order("sort_index", { ascending: true });

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true, rows: data ?? [] });
}

// POST body: { channelId, day, rows: [{title, mp4_url, duration, poster_url, sort_index}], baseTimeUtc: "YYYY-MM-DDTHH:mm:ssZ" }
// This replaces the draft for that day/channel and auto-chains start_time from baseTimeUtc by duration.
export async function POST(req: Request) {
  const supabase = createRouteHandlerClient({ cookies });
  const body = await req.json().catch(() => ({}));
  const { channelId, day, rows, baseTimeUtc } = body as {
    channelId?: string | number;
    day?: string;
    baseTimeUtc?: string; // e.g., "2025-08-11T00:00:00Z"
    rows?: Array<{ title: string; mp4_url: string; duration: number; poster_url?: string; sort_index?: number }>;
  };

  if (!channelId || !day || !rows || !Array.isArray(rows) || !baseTimeUtc) {
    return NextResponse.json({ ok: false, error: "channelId, day, baseTimeUtc, rows required" }, { status: 400 });
  }

  let cur = new Date(baseTimeUtc).getTime();
  const prepared = rows
    .sort((a, b) => (a.sort_index ?? 0) - (b.sort_index ?? 0))
    .map((r, i) => {
      const startIso = new Date(cur).toISOString();
      cur += (r.duration ?? 0) * 1000;
      return {
        channel_id: String(channelId),
        title: r.title,
        mp4_url: r.mp4_url,
        duration: r.duration,
        start_time: startIso,
        poster_url: r.poster_url ?? null,
        sort_index: i
      };
    });

  // clear then insert
  const { error: clearErr } = await supabase.rpc("clear_programs_draft_day", { p_channel_id: String(channelId), p_day: day });
  if (clearErr) return NextResponse.json({ ok: false, error: clearErr.message }, { status: 400 });

  const { error: insErr } = await supabase.from("programs_draft").insert(prepared);
  if (insErr) return NextResponse.json({ ok: false, error: insErr.message }, { status: 400 });

  return NextResponse.json({ ok: true, count: prepared.length });
}
