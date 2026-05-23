import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { publishWebsite, configureBridge } from '@coaching/tools';

configureBridge({ mode: 'http', authToken: process.env.SKILLZ_AGENT_AUTH_TOKEN });

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });

  await publishWebsite(user.id);
  return NextResponse.json({ success: true });
}
