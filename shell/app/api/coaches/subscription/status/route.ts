import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import Stripe from 'stripe';

function serviceClient() {
  return createServiceClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error('STRIPE_SECRET_KEY is not set');
  return new Stripe(key, { apiVersion: '2023-10-16' });
}

/**
 * GET /api/coaches/subscription/status
 * Returns the coach's current platform subscription state.
 */
export async function GET(req: NextRequest) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const service = serviceClient();
  const { data: sub } = await service
    .from('coach_platform_subscriptions')
    .select('*')
    .eq('coach_id', user.id)
    .maybeSingle();

  const { data: chatSettings } = await service
    .from('coach_chat_settings')
    .select('free_message_limit, free_cost_limit_cents, paid_chat_price_usd, stripe_price_id, upsell_message')
    .eq('coach_id', user.id)
    .maybeSingle();

  return NextResponse.json({
    subscription:  sub ?? null,
    chatSettings:  chatSettings ?? null,
  });
}
