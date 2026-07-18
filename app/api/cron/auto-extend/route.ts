import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// ORIGINAL DESIGN RESTORED: each night, repeat the schedule's final 24 hours
// forward — day by day — until the channel is covered ~3 days ahead.
// (The broken version repeated the channel's ENTIRE history 7 days forward,
// which blew past Supabase's silent 1000-row query cap and caused the
// duplicate-key failures.)

const DAY_MS = 24 * 60 * 60 * 1000
const HOURS_THRESHOLD = 48        // extend any channel ending within 48h
const TARGET_AHEAD_HOURS = 72     // extend until covered ~3 days out
const MAX_INSERTS_PER_CHANNEL = 2000
const TAIL_ROWS = 400             // recent rows fetched (a day is well under this)
const MIN_TEMPLATE_MINUTES = 30   // skip channels whose valid daily content is shorter

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

interface ProgramRow {
  channel_id: number
  title: string | null
  mp4_url: string | null
  start_time: string
  duration: number | null
}

interface ChannelResult {
  channelId: number
  channelName: string
  status: 'extended' | 'ok' | 'error' | 'no_programs' | 'no_valid_programs' | 'template_too_short'
  message: string
  programsAdded?: number
  newEndTime?: string
}

export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  // Fail closed: if no secret is configured, or it doesn't match, reject.
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const results: ChannelResult[] = []
  const now = Date.now()
  const thresholdMs = now + HOURS_THRESHOLD * 60 * 60 * 1000
  const targetMs = now + TARGET_AHEAD_HOURS * 60 * 60 * 1000

  try {
    const { data: channels, error: channelsError } = await supabase
      .from('channels')
      .select('id, name')
      .order('id', { ascending: true })

    if (channelsError) {
      return NextResponse.json({ error: channelsError.message }, { status: 500 })
    }

    for (const channel of channels || []) {
      const channelId = parseInt(String(channel.id), 10)
      const channelName = channel.name || `Channel ${channelId}`

      try {
        // Fetch only the most recent rows, newest first. Never fetch the whole
        // history: Supabase silently caps unpaginated selects at 1000 rows,
        // which is exactly what broke the old version.
        const { data: tailDesc, error: programsError } = await supabase
          .from('programs')
          .select('channel_id, title, mp4_url, start_time, duration')
          .eq('channel_id', channelId)
          .order('start_time', { ascending: false })
          .limit(TAIL_ROWS)

        if (programsError) {
          results.push({ channelId, channelName, status: 'error', message: programsError.message })
          continue
        }

        if (!tailDesc || tailDesc.length === 0) {
          results.push({ channelId, channelName, status: 'no_programs', message: 'No programs found — skipped' })
          continue
        }

        // restore chronological order
        const rows = (tailDesc as ProgramRow[]).slice().reverse()

        // True end of the schedule, from the recent tail
        let scheduleEndMs = 0
        for (const p of rows) {
          const startMs = new Date(p.start_time).getTime()
          const durSec = Number(p.duration ?? 0)
          const endMs = startMs + durSec * 1000
          if (endMs > scheduleEndMs) scheduleEndMs = endMs
        }

        if (scheduleEndMs > thresholdMs) {
          results.push({
            channelId,
            channelName,
            status: 'ok',
            message: `Schedule runs until ${new Date(scheduleEndMs).toUTCString()} — no action needed`,
          })
          continue
        }

        // TEMPLATE = the schedule's FINAL 24 HOURS (the most recent full day
        // of programming), valid rows only. This is the "repeat yesterday"
        // behavior the channel lineup was designed around.
        const templateStartMs = scheduleEndMs - DAY_MS
        const template = rows.filter(p => {
          const startMs = new Date(p.start_time).getTime()
          const dur = Number(p.duration ?? 0)
          return (
            startMs >= templateStartMs &&
            startMs < scheduleEndMs &&
            Boolean(p.mp4_url) &&
            Number.isFinite(dur) &&
            dur > 0
          )
        })

        if (template.length === 0) {
          results.push({ channelId, channelName, status: 'no_valid_programs', message: 'No valid programs in the final day — skipped' })
          continue
        }

        let templateDurationMs = 0
        for (const p of template) {
          templateDurationMs += Number(p.duration!) * 1000
        }

        // Channels whose valid daily content is only seconds long (e.g. just a
        // standby clip) can't be scheduled — surface it clearly instead of
        // producing an absurd insert count.
        if (templateDurationMs < MIN_TEMPLATE_MINUTES * 60 * 1000) {
          results.push({
            channelId,
            channelName,
            status: 'template_too_short',
            message: `Valid content in final day totals ${(templateDurationMs / 60000).toFixed(1)} min — channel needs real programs with mp4_url + duration`,
          })
          continue
        }

        // If the channel has been dark, resume from the top of the current
        // hour — never backfill dead air in the past.
        let cursorMs = scheduleEndMs
        if (cursorMs < now) {
          const hourMs = 60 * 60 * 1000
          cursorMs = Math.floor(now / hourMs) * hourMs
        }

        // Repeat the day forward until covered ~3 days ahead.
        const daysNeeded = Math.max(1, Math.ceil((targetMs - cursorMs) / templateDurationMs))
        const estimatedInserts = daysNeeded * template.length

        if (estimatedInserts > MAX_INSERTS_PER_CHANNEL) {
          results.push({
            channelId,
            channelName,
            status: 'error',
            message: `Would need ${estimatedInserts} inserts — over safety limit`,
          })
          continue
        }

        const inserts: {
          channel_id: number
          start_time: string
          title: string | null
          mp4_url: string
          duration: number
        }[] = []

        for (let d = 0; d < daysNeeded; d++) {
          for (const p of template) {
            inserts.push({
              channel_id: channelId,
              start_time: new Date(cursorMs).toISOString(),
              title: p.title,
              mp4_url: p.mp4_url!,
              duration: Number(p.duration!),
            })
            cursorMs += Number(p.duration!) * 1000
          }
        }

        // Collision-proof: if a timestamp already exists, skip that row
        // instead of failing the whole batch. Honest logging: 'extended'
        // is only recorded when every batch actually succeeded.
        let insertFailed = false
        const BATCH_SIZE = 500
        for (let i = 0; i < inserts.length; i += BATCH_SIZE) {
          const batch = inserts.slice(i, i + BATCH_SIZE)
          const { error: insertError } = await supabase
            .from('programs')
            .upsert(batch, { onConflict: 'channel_id,start_time', ignoreDuplicates: true })
          if (insertError) {
            insertFailed = true
            results.push({ channelId, channelName, status: 'error', message: `Insert failed: ${insertError.message}` })
            break
          }
        }

        if (!insertFailed) {
          results.push({
            channelId,
            channelName,
            status: 'extended',
            message: `Repeated final day ${daysNeeded} time(s) — ${inserts.length} programs added`,
            programsAdded: inserts.length,
            newEndTime: new Date(cursorMs).toUTCString(),
          })
        }

      } catch (err: any) {
        results.push({ channelId, channelName, status: 'error', message: err.message || 'Unknown error' })
      }
    }

    try {
      await supabase.from('schedule_health_log').insert({
        run_at: new Date().toISOString(),
        channels_checked: results.length,
        channels_extended: results.filter(r => r.status === 'extended').length,
        channels_errored: results.filter(r => r.status === 'error').length,
        results_json: results,
      })
    } catch {
      // table doesn't exist yet — ignore
    }

    return NextResponse.json({
      ok: true,
      run_at: new Date().toISOString(),
      channels_checked: results.length,
      channels_extended: results.filter(r => r.status === 'extended').length,
      channels_errored: results.filter(r => r.status === 'error').length,
      results,
    })

  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 })
  }
}

export async function POST(req: Request) {
  return GET(req)
}
