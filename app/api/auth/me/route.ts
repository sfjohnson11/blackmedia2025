import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { cookies } from 'next/headers'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ profile: null })

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('id, email, name, full_name, role, membership_tier, membership_status, membership_ends_at')
    .eq('id', user.id)
    .single()

  return NextResponse.json({ profile })
}
