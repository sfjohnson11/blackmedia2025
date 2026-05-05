import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { cookies } from 'next/headers'
import { canAccessChannel, isFreeChannel } from '@/lib/protected-channels'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const channelId = parseInt(searchParams.get('channelId') || '0')

  if (isFreeChannel(channelId)) {
    return NextResponse.json({ hasAccess: true, tier: 'free' })
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({
      hasAccess: false,
      reason: 'not_logged_in',
      upgrade_url: '/membership',
    })
  }

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role, membership_tier, membership_status')
    .eq('id', user.id)
    .single()

  const tier = profile?.role === 'admin'
    ? 'admin'
    : profile?.membership_status === 'active'
      ? (profile?.membership_tier as 'member' | 'constructiq' | 'admin')
      : 'free'

  const hasAccess = canAccessChannel(channelId, tier)

  return NextResponse.json({
    hasAccess,
    tier,
    reason: hasAccess ? null : 'no_membership',
    upgrade_url: hasAccess ? null : '/membership',
  })
}

export async function POST(req: NextRequest) {
  const { channelId } = await req.json()
  const id = parseInt(String(channelId))

  if (isFreeChannel(id)) {
    return NextResponse.json({ ok: true, tier: 'free' })
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({
      ok: false,
      error: 'Please log in to access this channel',
      upgrade_url: '/membership',
    }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role, membership_tier, membership_status')
    .eq('id', user.id)
    .single()

  const tier = profile?.role === 'admin'
    ? 'admin'
    : profile?.membership_status === 'active'
      ? (profile?.membership_tier as 'member' | 'constructiq' | 'admin')
      : 'free'

  const hasAccess = canAccessChannel(id, tier)

  if (!hasAccess) {
    return NextResponse.json({
      ok: false,
      error: 'Membership required to access this channel',
      upgrade_url: '/membership',
    }, { status: 403 })
  }

  return NextResponse.json({ ok: true, tier })
}
