import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET() {
  const now = Date.now()

  const { data: channels, error } = await supabase
    .from('channels')
    .select('id, name')
    .order('id', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const health = []

  for (const channel of channels || []) {
    const channelId = parseInt(String(channel.id), 10)

    const { data: programs } = await supabase
      .from('programs')
      .select('start_time, duration')
      .eq('channel_id', channelId)
      .order('start_time', { ascending: false })
      .limit(200)

    if (!programs || programs.length === 0) {
      health.push({
        channelId,
        channelName: channel.name,
        status: 'no_content',
        endTime: null,
        hoursRemaining: 0,
        programCount: 0,
      })
      continue
    }

    let currentEndMs = 0
    for (const p of programs) {
      const startMs = new Date(p.start_time).getTime()
      const durSec = Number(p.duration ?? 0)
      const endMs = startMs + durSec * 1000
      if (endMs > currentEndMs) currentEndMs = endMs
    }

    const hoursRemaining = Math.max(0, (currentEndMs - now) / (1000 * 60 * 60))

    const status =
      hoursRemaining <= 0 ? 'expired' :
      hoursRemaining < 24 ? 'critical' :
      hoursRemaining < 48 ? 'warning' :
      hoursRemaining < 168 ? 'good' : 'great'

    const { count } = await supabase
      .from('programs')
      .select('*', { count: 'exact', head: true })
      .eq('channel_id', channelId)

    health.push({
      channelId,
      channelName: channel.name,
      status,
      endTime: new Date(currentEndMs).toISOString(),
      hoursRemaining: Math.round(hoursRemaining * 10) / 10,
      programCount: count || 0,
    })
  }

  return NextResponse.json({ ok: true, health, checkedAt: new Date().toISOString() })
}
