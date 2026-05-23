import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const LICENSING_AGENT = process.env.AGENT_LICENSING_URL ?? 'http://localhost:3006';
const AUTH_TOKEN      = process.env.SKILLZ_AGENT_AUTH_TOKEN ?? '';

export async function POST(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  // Verify authenticated user
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ success: false, message: 'Unauthorised' }, { status: 401 });

  // Get pending license
  const licenseRes = await fetch(`${LICENSING_AGENT}/action`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${AUTH_TOKEN}` },
    body:    JSON.stringify({ userId: user.id, config: {}, action: 'get_pending_license', params: { inviteToken: token } }),
  }).then(r => r.json()) as { success: boolean; data?: Record<string, unknown>; message?: string };

  if (!licenseRes.success || !licenseRes.data) {
    return NextResponse.json({ success: false, message: licenseRes.message ?? 'Invite not found' }, { status: 404 });
  }

  const license = licenseRes.data;
  if (license.status !== 'pending') {
    return NextResponse.json({ success: false, message: 'Already activated' }, { status: 400 });
  }

  // Only allow free licenses here
  const fee = license.license_fee_amount as number | null;
  if (fee && fee > 0) {
    return NextResponse.json({ success: false, message: 'This license requires payment' }, { status: 400 });
  }

  // Update the licensee to the actual user (in case they were placeholder)
  await supabase
    .from('program_licenses')
    .update({ licensee_coach_id: user.id })
    .eq('license_id', license.license_id as string)
    .eq('licensee_coach_id', '00000000-0000-0000-0000-000000000000');

  // Activate
  const activateRes = await fetch(`${LICENSING_AGENT}/action`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${AUTH_TOKEN}` },
    body:    JSON.stringify({ userId: user.id, config: {}, action: 'activate_license', params: { licenseId: license.license_id as string } }),
  }).then(r => r.json()) as { success: boolean; message: string };

  return NextResponse.json(activateRes);
}
