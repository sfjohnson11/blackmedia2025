// app/api/admin/stats/route.ts
import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET() {
  const [
    { count: channelCount, error: chErr },
    { count: programCount, error: prErr },
    { count: activeChannelCount, error: actErr },
  ] = await Promise.all([
    supabase.from('channels').select('*', { count: 'exact', head: true }),
    supabase.from('programs').select('*', { count: 'exact', head: true }),
    supabase.from('channels').select('*', { count: 'exact', head: true }).eq('is_active', true),
  ]);

  if (chErr || prErr || actErr) {
    return NextResponse.json(
      { error: chErr?.message || prErr?.message || actErr?.message },
      { status: 500 }
    );
  }

  return NextResponse.json({
    channelCount: channelCount ?? 0,
    programCount: programCount ?? 0,
    activeChannelCount: activeChannelCount ?? 0,
  });
}
