import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const LICENSING_AGENT = process.env.AGENT_LICENSING_URL ?? 'http://localhost:3006';
const PAYMENT_AGENT   = process.env.AGENT_PAYMENT_URL   ?? 'http://localhost:3007';
const AUTH_TOKEN      = process.env.SKILLZ_AGENT_AUTH_TOKEN ?? '';
const APP_URL         = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

export async function POST(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  // Verify authenticated user
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

  // Get pending license
  const licenseRes = await fetch(`${LICENSING_AGENT}/action`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${AUTH_TOKEN}` },
    body:    JSON.stringify({ userId: user.id, config: {}, action: 'get_pending_license', params: { inviteToken: token } }),
  }).then(r => r.json()) as { success: boolean; data?: Record<string, unknown>; message?: string };

  if (!licenseRes.success || !licenseRes.data) {
    return NextResponse.json({ error: licenseRes.message ?? 'Invite not found' }, { status: 404 });
  }

  const license = licenseRes.data;
  if (license.status !== 'pending') {
    return NextResponse.json({ error: 'This invite has already been used' }, { status: 400 });
  }

  const amount   = license.license_fee_amount as number;
  const currency = (license.license_fee_currency as string) ?? 'USD';

  // Fetch program title for description
  const { data: prog } = await supabase.from('programs').select('title').eq('program_id', license.program_id as string).single();
  const description = `License: ${prog?.title ?? 'Program'}`;

  // Create payment link via payment agent
  const payRes = await fetch(`${PAYMENT_AGENT}/action`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${AUTH_TOKEN}` },
    body:    JSON.stringify({
      userId: user.id,
      config: {},
      action: 'create_payment_link',
      params: {
        amount:      Math.round(amount * 100),  // convert to smallest unit
        currency,
        description,
        redirectUrl: `${APP_URL}/license-invite/${token}?paid=1`,
        licenseId:   license.license_id as string,
      },
    }),
  }).then(r => r.json()) as { success: boolean; data?: { paymentLinkUrl?: string }; message?: string };

  if (!payRes.success || !payRes.data?.paymentLinkUrl) {
    return NextResponse.json({ error: payRes.message ?? 'Failed to create checkout' }, { status: 500 });
  }

  return NextResponse.json({ url: payRes.data.paymentLinkUrl });
}
