import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireAdmin } from '@/lib/require-admin'

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

// A "real" program has a video URL that is NOT the standby clip and a positive
// duration. Standby clips must never be scheduled forward - counting them as
// valid content is what let channels fall into a standby-only rotation.
function isRealProgram(p: { mp4_url: string | null; duration: number | null }): boolean {
  const u = String(p.mp4_url || '')
  return u.length > 0 && !/standby/i.test(u) && Number(p.duration ?? 0) > 0
}

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

  // Allowed callers: Vercel's nightly cron (bearer secret) OR a logged-in
  // admin clicking from the dashboard. Everyone else is rejected.
  const secretOk = Boolean(cronSecret) && authHeader === `Bearer ${cronSecret}`
  if (!secretOk) {
    const gate = await requireAdmin()
    if (!gate.ok) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
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
            isRealProgram(p) &&
            Number.isFinite(dur)
          )
        })

        let workingTemplate = template
        let templateDurationMs = 0
        for (const p of workingTemplate) {
          templateDurationMs += Number(p.duration!) * 1000
        }

        let recovered = false

        // SELF-HEAL: if the recent rotation has no real content (e.g. a
        // standby-only day got photocopied forward), dig back through this
        // channel's own history for its most recent real day of programming
        // and use THAT as the template instead of giving up.
        if (templateDurationMs < MIN_TEMPLATE_MINUTES * 60 * 1000) {
          let foundDay: ProgramRow[] = []
          let cursor: string | null = null
          for (let page = 0; page < 12 && foundDay.length === 0; page++) {
            let q = supabase
              .from('programs')
              .select('channel_id, title, mp4_url, start_time, duration')
              .eq('channel_id', channelId)
              .order('start_time', { ascending: false })
              .limit(500)
            if (cursor) q = q.lt('start_time', cursor)
            const { data: hist } = await q
            if (!hist || hist.length === 0) break
            cursor = hist[hist.length - 1].start_time
            const real = (hist as ProgramRow[]).filter(isRealProgram)
            if (real.length > 0) {
              const newestEnd =
                new Date(real[0].start_time).getTime() + Number(real[0].duration!) * 1000
              foundDay = real
                .filter(p => new Date(p.start_time).getTime() >= newestEnd - DAY_MS)
                .reverse()
            }
          }

          let foundMs = 0
          for (const p of foundDay) foundMs += Number(p.duration!) * 1000

          if (foundMs >= MIN_TEMPLATE_MINUTES * 60 * 1000) {
            workingTemplate = foundDay
            templateDurationMs = foundMs
            recovered = true
            // Clear future junk rows (standby clips, missing urls, zero
            // durations) so the restored lineup plays clean.
            const hourStart = Math.floor(now / 3600000) * 3600000
            await supabase
              .from('programs')
              .delete()
              .eq('channel_id', channelId)
              .gte('start_time', new Date(hourStart).toISOString())
              .or('mp4_url.is.null,mp4_url.ilike.%standby%,duration.is.null,duration.lte.0')
          } else {
            results.push({
              channelId,
              channelName,
              status: 'no_valid_programs',
              message: 'No real programs found anywhere in history - channel needs content uploaded',
            })
            continue
          }
        }

        // If the channel has been dark, resume from the top of the current
        // hour — never backfill dead air in the past.
        let cursorMs = scheduleEndMs
        if (recovered) cursorMs = 0 // junk rotation cleared - restart from the current hour
        if (cursorMs < now) {
          const hourMs = 60 * 60 * 1000
          cursorMs = Math.floor(now / hourMs) * hourMs
        }

        // Repeat the day forward until covered ~3 days ahead.
        const daysNeeded = Math.max(1, Math.ceil((targetMs - cursorMs) / templateDurationMs))
        const estimatedInserts = daysNeeded * workingTemplate.length

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
          for (const p of workingTemplate) {
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
            message: recovered
              ? `RECOVERED real shows from history - ${inserts.length} programs back on air`
              : `Repeated final day ${daysNeeded} time(s) — ${inserts.length} programs added`,
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
