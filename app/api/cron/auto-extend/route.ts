import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const MAX_INSERTS_PER_CHANNEL = 2000
const EXTEND_DAYS = 7
const HOURS_THRESHOLD = 48

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
  status: 'extended' | 'ok' | 'error' | 'no_programs' | 'no_valid_programs'
  message: string
  programsAdded?: number
  newEndTime?: string
}

export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const results: ChannelResult[] = []
  const now = Date.now()
  const thresholdMs = now + HOURS_THRESHOLD * 60 * 60 * 1000

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
        const { data: programs, error: programsError } = await supabase
          .from('programs')
          .select('channel_id, title, mp4_url, start_time, duration')
          .eq('channel_id', channelId)
          .order('start_time', { ascending: true })

        if (programsError) {
          results.push({ channelId, channelName, status: 'error', message: programsError.message })
          continue
        }

        if (!programs || programs.length === 0) {
          results.push({ channelId, channelName, status: 'no_programs', message: 'No programs found — skipped' })
          continue
        }

        const rows = programs as ProgramRow[]

        let currentEndMs = 0
        for (const p of rows) {
          const startMs = new Date(p.start_time).getTime()
          const durSec = Number(p.duration ?? 0)
          const endMs = startMs + durSec * 1000
          if (endMs > currentEndMs) currentEndMs = endMs
        }

        if (currentEndMs > thresholdMs) {
          results.push({
            channelId,
            channelName,
            status: 'ok',
            message: `Schedule runs until ${new Date(currentEndMs).toUTCString()} — no action needed`,
          })
          continue
        }

        const validRows = rows.filter(p => {
          const dur = Number(p.duration ?? 0)
          return Boolean(p.mp4_url) && Number.isFinite(dur) && dur > 0
        })

        if (validRows.length === 0) {
          results.push({ channelId, channelName, status: 'no_valid_programs', message: 'No valid programs with duration + mp4 URL — skipped' })
          continue
        }

        let templateDurationMs = 0
        for (const p of validRows) {
          templateDurationMs += Number(p.duration!) * 1000
        }

        if (templateDurationMs <= 0) {
          results.push({ channelId, channelName, status: 'error', message: 'Template duration is 0 — skipped' })
          continue
        }

        const extendMs = EXTEND_DAYS * 24 * 60 * 60 * 1000
        const blocksNeeded = Math.ceil(extendMs / templateDurationMs)
        const estimatedInserts = blocksNeeded * validRows.length

        if (estimatedInserts > MAX_INSERTS_PER_CHANNEL) {
          results.push({
            channelId,
            channelName,
            status: 'error',
            message: `Would need ${estimatedInserts} inserts — over safety limit. Template may be too short.`,
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

        let cursorMs = currentEndMs

        for (let block = 0; block < blocksNeeded; block++) {
          for (const p of validRows) {
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

        const BATCH_SIZE = 500
        for (let i = 0; i < inserts.length; i += BATCH_SIZE) {
          const batch = inserts.slice(i, i + BATCH_SIZE)
          const { error: insertError } = await supabase.from('programs').insert(batch)
          if (insertError) {
            results.push({ channelId, channelName, status: 'error', message: `Insert failed: ${insertError.message}` })
            break
          }
        }

        const newEndTime = new Date(cursorMs).toUTCString()
        results.push({
          channelId,
          channelName,
          status: 'extended',
          message: `Extended by ${blocksNeeded} block(s) — ${inserts.length} programs added`,
          programsAdded: inserts.length,
          newEndTime,
        })

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
