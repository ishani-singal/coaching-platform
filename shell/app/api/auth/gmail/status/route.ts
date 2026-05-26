import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

  const service = createServiceClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data } = await service
    .from('coach_gmail_connections')
    .select('google_account_email')
    .eq('coach_id', user.id)
    .maybeSingle();

  return NextResponse.json({
    connected: !!data,
    email: data?.google_account_email ?? null,
  });
}
