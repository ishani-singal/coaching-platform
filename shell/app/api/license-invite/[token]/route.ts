import { NextRequest, NextResponse } from 'next/server';

const LICENSING_AGENT = process.env.AGENT_LICENSING_URL ?? 'http://localhost:3006';
const AUTH_TOKEN      = process.env.SKILLZ_AGENT_AUTH_TOKEN ?? '';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const r = await fetch(`${LICENSING_AGENT}/action`, {
    method:  'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${AUTH_TOKEN}`,
    },
    body: JSON.stringify({
      userId: '00000000-0000-0000-0000-000000000000',
      config: {},
      action: 'get_pending_license',
      params: { inviteToken: token },
    }),
  }).then(r => r.json()) as { success: boolean; data?: Record<string, unknown>; message?: string };

  if (!r.success || !r.data) {
    return NextResponse.json({ error: r.message ?? 'Invite not found' }, { status: 404 });
  }

  const license = r.data;

  // Enrich with program title + licensor name
  const { createClient } = await import('@/lib/supabase/server');
  const supabase = await createClient();

  const [{ data: prog }, { data: licensor }] = await Promise.all([
    supabase.from('programs').select('title').eq('program_id', license.program_id as string).single(),
    supabase.from('user_profiles').select('name').eq('user_id', license.licensor_coach_id as string).single(),
  ]);

  return NextResponse.json({
    invite: {
      ...license,
      programTitle:  prog?.title ?? null,
      licensorName:  licensor?.name ?? null,
    },
  });
}
